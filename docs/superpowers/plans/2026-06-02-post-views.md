# Post Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an anonymous, once-per-visitor view count on each blog post page.

**Architecture:** A new `PostView` counter model holds one row per post (`id = postId`, `count`). A `ViewCounter` client component reads the count for display and increments it the first time a browser opens the post (guarded by `localStorage`), all via public-API-key. It renders next to the like button in the post's share row.

**Tech Stack:** AWS Amplify Gen 2 data (`aws-amplify/data`), Next.js 14 client components, `localStorage`, vitest.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `amplify/data/resource.ts` | (modify) add `PostView` model |
| `src/lib/views.ts` | (new) pure helpers: `viewedKey`, `formatViews` |
| `tests/views.test.ts` | (new) unit tests |
| `src/components/ViewCounter.tsx` | (new) display + once-per-visitor increment |
| `src/app/posts/[slug]/PostDetailClient.tsx` | (modify) render `<ViewCounter>` in the like/share row |

**Note:** `client.models.PostView` is typed from the schema in `resource.ts` at compile time, so `tsc`/`build` recognize it without a deploy. The `PostView` table is provisioned when the backend deploys (`git push`).

---

## Task 1: Add the `PostView` model

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1: Add the model**

In `amplify/data/resource.ts`, add this model inside `a.schema({ ... })`, immediately after the `Like` model block:

```ts
  PostView: a
    .model({
      count: a.integer().required(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['create', 'read', 'update']),
    ]),
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat: add PostView counter model"
```

---

## Task 2: Pure view helpers (TDD)

**Files:**
- Create: `src/lib/views.ts`
- Test: `tests/views.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/views.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { viewedKey, formatViews } from '@/lib/views';

describe('viewedKey', () => {
  it('namespaces the post id', () => {
    expect(viewedKey('abc')).toBe('viewed:abc');
  });
});

describe('formatViews', () => {
  it('uses singular for exactly one', () => {
    expect(formatViews(1)).toBe('1 view');
  });
  it('uses plural for zero', () => {
    expect(formatViews(0)).toBe('0 views');
  });
  it('uses plural for many', () => {
    expect(formatViews(42)).toBe('42 views');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/views.test.ts`
Expected: FAIL — cannot resolve `@/lib/views`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/views.ts`:

```ts
export function viewedKey(postId: string): string {
  return `viewed:${postId}`;
}

export function formatViews(n: number): string {
  return `${n} ${n === 1 ? 'view' : 'views'}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/views.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/views.ts tests/views.test.ts
git commit -m "feat: pure helpers for post views"
```

---

## Task 3: `ViewCounter` component

**Files:**
- Create: `src/components/ViewCounter.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/ViewCounter.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { viewedKey, formatViews } from '@/lib/views';

export default function ViewCounter({ postId }: { postId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const { data: row } = await client.models.PostView.get(
          { id: postId },
          { authMode: 'apiKey' },
        );
        const current = row?.count ?? 0;

        // Has this browser already counted a view for this post?
        let alreadyViewed = false;
        try {
          alreadyViewed = window.localStorage.getItem(viewedKey(postId)) !== null;
        } catch {
          alreadyViewed = true; // no storage (private mode) -> don't double count
        }

        if (alreadyViewed) {
          if (active) setCount(current);
          return;
        }

        // First view from this browser: increment once.
        if (active) setCount(current + 1); // optimistic
        try {
          if (row) {
            await client.models.PostView.update(
              { id: postId, count: current + 1 },
              { authMode: 'apiKey' },
            );
          } else {
            await client.models.PostView.create(
              { id: postId, count: 1 },
              { authMode: 'apiKey' },
            );
          }
          try {
            window.localStorage.setItem(viewedKey(postId), '1');
          } catch {
            // ignore storage failures
          }
        } catch {
          // increment failed (e.g. a create race with another first-viewer):
          // fall back to showing the value we read.
          if (active) setCount(current);
        }
      } catch {
        // read failed: leave count unknown (renders nothing)
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [postId]);

  if (count === null) return null;

  return (
    <span className="flex items-center gap-2 text-sm text-gray-500" aria-label={formatViews(count)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" aria-hidden="true">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>{formatViews(count)}</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (`client.models.PostView` is typed from the schema added in Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/components/ViewCounter.tsx
git commit -m "feat: ViewCounter component"
```

---

## Task 4: Render the view counter in the post

**Files:**
- Modify: `src/app/posts/[slug]/PostDetailClient.tsx`

- [ ] **Step 1: Import `ViewCounter`**

In `src/app/posts/[slug]/PostDetailClient.tsx`, add this import next to the `LikeButton` import:

```tsx
import ViewCounter from '@/components/ViewCounter';
```

- [ ] **Step 2: Render it after `<LikeButton>` in the like/share row**

Find this block:

```tsx
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LikeButton postId={post.id} />
        <ShareButtons url={url} title={post.title} />
      </div>
```

Replace it with:

```tsx
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LikeButton postId={post.id} />
        <ViewCounter postId={post.id} />
        <ShareButtons url={url} title={post.title} />
      </div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/posts/[slug]/PostDetailClient.tsx
git commit -m "feat: show view count in the post like/share row"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit suite**

Run: `npm run test`
Expected: all tests pass, including `tests/views.test.ts` (4 tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (pre-existing warnings in `account`/`studio` pages are fine).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `client.models.PostView` resolves and `/posts/[slug]` builds.

- [ ] **Step 4: Post-deploy manual check (after `git push`)**

After Amplify deploys (provisions the `PostView` table):
- Open a post → "N views" appears next to likes; the count is one higher than before.
- Refresh → the count does NOT increase again (localStorage guard).
- Open in a different browser / clear the `viewed:<postId>` key → counts again.

---

## Self-Review Notes

- **Spec coverage:** `PostView` model + publicApiKey create/read/update (T1); `views.ts` helpers + tests (T2); `ViewCounter` with apiKey get, once-per-visitor increment via localStorage, create/update branches, optimistic display, full try/catch + `typeof window`/storage guards, `count === null` → render nothing (T3); placement after `<LikeButton>` (T4); build/test/lint verification + deploy note (T5). All spec sections mapped.
- **Type consistency:** `viewedKey`/`formatViews` signatures from T2 used identically in T3. `client.models.PostView.get({ id })` / `.update({ id, count })` / `.create({ id, count })` match the T1 model (`count: integer!`, id = postId).
- **Placeholder scan:** none — every step has concrete code/commands.
- **Note:** the `window.localStorage` access in T3 is inside `useEffect` (client-only) and `try/catch`-guarded, so SSR never touches it.
