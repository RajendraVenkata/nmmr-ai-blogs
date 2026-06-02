# Post Likes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sign-in-required, toggleable "like" with a visible count to each blog post.

**Architecture:** A new `Like` Amplify model stores one row per (user, post) using a deterministic id `"<postId>::<userId>"`, so one-like-per-user is structurally enforced and toggle is a plain create/delete. A `LikeButton` client component (mirroring `Comments.tsx`) reads the count via `apiKey`, toggles via owner-auth create/delete, and renders in the post's share row.

**Tech Stack:** AWS Amplify Gen 2 (`@aws-amplify/backend`, `aws-amplify/data`), Next.js 14 client components, vitest.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `amplify/data/resource.ts` | (modify) add `Like` model |
| `src/lib/likes.ts` | (new) pure helpers: `likeId`, `userHasLiked` |
| `tests/likes.test.ts` | (new) unit tests for helpers |
| `src/components/LikeButton.tsx` | (new) heart + count, toggle UI |
| `src/components/PostDetailClient.tsx` | (modify) render `<LikeButton>` in the share row |

**Note:** `client.models.Like` is typed from the schema in `resource.ts` at compile time, so `tsc`/`build` recognize it without a deploy. The actual `Like` DynamoDB table is provisioned when the backend deploys (on `git push`).

---

## Task 1: Add the `Like` model

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1: Add the model to the schema**

In `amplify/data/resource.ts`, add this model inside the `a.schema({ ... })` object, immediately after the `Comment` model block (before `AccessRequest`):

```ts
  Like: a
    .model({
      postId: a.id().required(),
      userId: a.string().required(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read']),
      allow.owner().to(['create', 'read', 'delete']),
    ]),
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat: add Like model for post likes"
```

---

## Task 2: Pure like helpers (TDD)

**Files:**
- Create: `src/lib/likes.ts`
- Test: `tests/likes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/likes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { likeId, userHasLiked, type LikeRow } from '@/lib/likes';

describe('likeId', () => {
  it('joins postId and userId with the separator', () => {
    expect(likeId('p1', 'u1')).toBe('p1::u1');
  });
});

describe('userHasLiked', () => {
  const rows: LikeRow[] = [
    { id: 'p1::u1', postId: 'p1', userId: 'u1' },
    { id: 'p1::u2', postId: 'p1', userId: 'u2' },
  ];
  it('true when the user has a like row for the post', () => {
    expect(userHasLiked(rows, 'p1', 'u1')).toBe(true);
  });
  it('false when the user has not liked', () => {
    expect(userHasLiked(rows, 'p1', 'u3')).toBe(false);
  });
  it('false for empty rows', () => {
    expect(userHasLiked([], 'p1', 'u1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/likes.test.ts`
Expected: FAIL — cannot resolve `@/lib/likes`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/likes.ts`:

```ts
export const LIKE_ID_SEP = '::';

export interface LikeRow {
  id: string;
  postId: string;
  userId: string;
}

export function likeId(postId: string, userId: string): string {
  return `${postId}${LIKE_ID_SEP}${userId}`;
}

export function userHasLiked(rows: LikeRow[], postId: string, userId: string): boolean {
  const id = likeId(postId, userId);
  return rows.some((r) => r.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/likes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/likes.ts tests/likes.test.ts
git commit -m "feat: pure helpers for post likes"
```

---

## Task 3: `LikeButton` component

**Files:**
- Create: `src/components/LikeButton.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/LikeButton.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { likeId, userHasLiked, type LikeRow } from '@/lib/likes';

export default function LikeButton({ postId }: { postId: string }) {
  const { user } = useCurrentUser();
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await client.models.Like.list({
        filter: { postId: { eq: postId } },
        authMode: 'apiKey',
      });
      const rows = data as LikeRow[];
      setCount(rows.length);
      setLiked(user ? userHasLiked(rows, postId, user.userId) : false);
    } catch {
      // keep current state if the read fails
    }
  }, [postId, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);
    const id = likeId(postId, user.userId);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      if (next) {
        await client.models.Like.create({ id, postId, userId: user.userId });
      } else {
        await client.models.Like.delete({ id });
      }
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const heart = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}
         stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500" title="Sign in to like">
        {heart}
        <span>{count}</span>
        <span className="text-xs">Sign in to like</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this post' : 'Like this post'}
      className={`flex items-center gap-2 text-sm transition-colors disabled:opacity-60 ${
        liked ? 'text-primary' : 'text-gray-500 hover:text-primary'
      }`}
    >
      {heart}
      <span>{count}</span>
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (`client.models.Like` is typed from the schema added in Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/components/LikeButton.tsx
git commit -m "feat: LikeButton component"
```

---

## Task 4: Render the like button in the post

**Files:**
- Modify: `src/components/PostDetailClient.tsx`

- [ ] **Step 1: Import `LikeButton`**

In `src/components/PostDetailClient.tsx`, add this import alongside the other component imports (e.g. after the `ShareButtons` import):

```tsx
import LikeButton from '@/components/LikeButton';
```

- [ ] **Step 2: Replace the share line with a like + share row**

Find this line:

```tsx
      <ShareButtons url={url} title={post.title} />
```

Replace it with:

```tsx
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LikeButton postId={post.id} />
        <ShareButtons url={url} title={post.title} />
      </div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/PostDetailClient.tsx
git commit -m "feat: show like button in the post share row"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit suite**

Run: `npm run test`
Expected: all tests pass, including `tests/likes.test.ts` (4 tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (pre-existing warnings in `account`/`studio` pages are fine).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `client.models.Like` resolves and `/posts/[slug]` still builds.

- [ ] **Step 4: Post-deploy manual check (after `git push`)**

After Amplify deploys (provisions the `Like` table):
- Open a post signed out → heart + count visible, "Sign in to like", no toggle.
- Sign in → click heart → fills, count +1; reload → still filled, count persists.
- Click again → outline, count −1.
- Confirm a user cannot exceed +1 (deterministic id prevents duplicates).

---

## Self-Review Notes

- **Spec coverage:** `Like` model + auth + deterministic id (T1); `likes.ts` helpers + tests (T2); `LikeButton` with apiKey read, optimistic toggle, signed-out count-only (T3); placement in share row (T4); build/test verification + deploy note (T5). All spec sections mapped.
- **Type consistency:** `LikeRow` and `likeId`/`userHasLiked` signatures defined in T2 are used identically in T3. `client.models.Like.create({ id, postId, userId })` / `.delete({ id })` match the T1 model fields.
- **Placeholder scan:** none — all steps contain concrete code/commands.
