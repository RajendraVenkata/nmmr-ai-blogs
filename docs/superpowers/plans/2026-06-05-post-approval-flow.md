# Post Approval Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLI-pushed posts land in a new `PENDING_REVIEW` status (hidden publicly); a ContentAdmin/SystemAdmin approves (→ `PUBLISHED`) or rejects (→ `DRAFT`) them in a new `/admin/posts` queue.

**Architecture:** Add `PENDING_REVIEW` to the `Post.status` enum. `upload-post.sh` defaults pushes to that status (with a `--publish` bypass). A pure `pendingReview` filter + a `PendingPosts` admin component (mirroring `ModerationList`) drive the review queue; public reads already show only `PUBLISHED`, so nothing else changes.

**Tech Stack:** Next.js 14, Amplify Gen 2 (AppSync/DynamoDB), bash + python (the CLI), vitest.

**Branch:** `post-approval-flow` (already created; spec committed there).

---

## File Structure

- `src/lib/posts.ts` (modify) — add `pendingReview`.
- `tests/posts.test.ts` (modify) — test `pendingReview` + `publishedOnly` exclusion.
- `amplify/data/resource.ts` (modify) — add `PENDING_REVIEW` to the `Post.status` enum.
- `blogs/upload-post.sh` (modify) — default status `PENDING_REVIEW`, `--status`/`--publish`, conditional `publishedAt`.
- `src/components/PendingPosts.tsx` (create) — the review queue UI.
- `src/app/admin/posts/page.tsx` (create) — the admin page.
- `src/components/AdminNav.tsx` (modify) — add a **Pending** link.

---

## Task 1: `pendingReview` helper

**Files:** Modify `src/lib/posts.ts`, `tests/posts.test.ts`. TDD.

- [ ] **Step 1: Write the failing test** — append to `tests/posts.test.ts` (add `pendingReview` to the existing `'@/lib/posts'` import; `publishedOnly` is already imported):

```typescript
describe('pendingReview', () => {
  const rows = [
    { status: 'PENDING_REVIEW' },
    { status: 'PUBLISHED' },
    { status: 'DRAFT' },
  ];
  it('selects only PENDING_REVIEW items', () => {
    expect(pendingReview(rows)).toEqual([{ status: 'PENDING_REVIEW' }]);
  });
  it('publishedOnly excludes PENDING_REVIEW', () => {
    expect(publishedOnly(rows)).toEqual([{ status: 'PUBLISHED' }]);
  });
});
```

(If `tests/posts.test.ts` does not already import `describe`/`it`/`expect` or `publishedOnly`, add them — check the file's existing imports first and extend them rather than duplicating.)

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/posts.test.ts`
Expected: FAIL — `pendingReview` is not exported.

- [ ] **Step 3: Implement** — in `src/lib/posts.ts`, add after `notDeleted`:

```typescript
export function pendingReview<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'PENDING_REVIEW');
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run tests/posts.test.ts` then `npx vitest run`
Expected: PASS (whole suite).

- [ ] **Step 5: Commit**

```bash
git add src/lib/posts.ts tests/posts.test.ts
git commit -m "feat: add pendingReview post filter"
```

---

## Task 2: Add `PENDING_REVIEW` to the Post status enum

**Files:** Modify `amplify/data/resource.ts`. No unit test; verify by type-check/build.

- [ ] **Step 1: Edit the enum** — in `amplify/data/resource.ts`, the `Post` model has:

```typescript
      status: a.enum(['DRAFT', 'PUBLISHED', 'DELETED']),
```

Change it to:

```typescript
      status: a.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'DELETED']),
```

(Change only the `Post` model's `status`. Leave `Comment`/`UserProfile`/`AccessRequest` enums untouched.)

- [ ] **Step 2: Type-check the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat: add PENDING_REVIEW to the Post status enum"
```

> Note: the generated client types now include `'PENDING_REVIEW'` as a valid `Post.status`
> filter/update value (needed by Task 4). If a later `npm run build` rejects
> `'PENDING_REVIEW'`, regenerate types with `npx ampx sandbox --once`, then rebuild.

---

## Task 3: CLI — default to `PENDING_REVIEW` with a `--publish` bypass

**Files:** Modify `blogs/upload-post.sh`. No unit test; verify with `--dry-run`.

READ `blogs/upload-post.sh` first. Make these targeted edits:

- [ ] **Step 1: Add the `STATUS` default** — in the defaults block (near `POST_ID="${POST_ID:-}"`), add:

```bash
STATUS="${STATUS:-PENDING_REVIEW}"
```

- [ ] **Step 2: Add the flags** — in the `while [[ $# -gt 0 ]]` arg-parsing `case`, add these two cases (next to `--id`):

```bash
    --status)         STATUS="$2"; shift 2 ;;
    --publish)        STATUS="PUBLISHED"; shift ;;
```

- [ ] **Step 3: Pass `STATUS` into the python heredoc** — find the `eval "$(POST_ID="$POST_ID" AUTHOR_NAME="$AUTHOR_NAME" AUTHOR_ID="$AUTHOR_ID" MD_DIR="$MD_DIR" COVER_OVERRIDE="$COVER_OVERRIDE" python3 - ...` line and add `STATUS="$STATUS"` to that env list:

```bash
eval "$(POST_ID="$POST_ID" AUTHOR_NAME="$AUTHOR_NAME" AUTHOR_ID="$AUTHOR_ID" \
        MD_DIR="$MD_DIR" COVER_OVERRIDE="$COVER_OVERRIDE" STATUS="$STATUS" \
        python3 - "$MD_FILE" "$ITEM_JSON" <<'PY'
```

- [ ] **Step 4: Use the status in the python item builder** — inside the python heredoc:

(a) After the existing `post_id = ...` / `iso = ...` lines, add:
```python
status = os.environ.get("STATUS", "PENDING_REVIEW")
```

(b) In the `item = { ... }` dict, change the status line and REMOVE the unconditional `publishedAt`:
```python
    "status":       {"S": status},
```
(delete the `"publishedAt":  {"S": iso},` line from the dict literal).

(c) After the `item = { ... }` dict is built (next to the other conditional `if excerpt:` / `if cover_key:` blocks), add:
```python
if status == "PUBLISHED":
    item["publishedAt"] = {"S": iso}
```

(d) Add `STATUS` to the shell vars the python prints at the end (next to `print(f"SLUG=...")` etc.):
```python
print(f"STATUS={sh(status)}")
```

- [ ] **Step 5: Show status in the plan output** — in the `echo "About to publish:"` block, add a line (e.g. after the `Slug:` line):

```bash
echo "  Status:     $STATUS"
```

- [ ] **Step 6: Verify with a dry-run**

Run (default → pending):
```bash
./blogs/upload-post.sh --dry-run blogs/try-it-live-embedded-terminals.post.md
```
Expected: the plan prints `Status: PENDING_REVIEW`; open the printed `*.ddb-item.json` and confirm `"status":{"S":"PENDING_REVIEW"}` and NO `publishedAt` key.

Then verify the bypass:
```bash
./blogs/upload-post.sh --dry-run --publish blogs/try-it-live-embedded-terminals.post.md
```
Expected: `Status: PUBLISHED`, and the item JSON has `"status":{"S":"PUBLISHED"}` WITH a `publishedAt`.

Delete the dry-run artifacts: `rm -f blogs/*.ddb-item.json`.

- [ ] **Step 7: Commit**

```bash
git add blogs/upload-post.sh
git commit -m "feat: CLI pushes posts as PENDING_REVIEW by default (--publish to bypass)"
```

---

## Task 4: `PendingPosts` review component

**Files:** Create `src/components/PendingPosts.tsx`. No automated test (DOM); verify by build.

- [ ] **Step 1: Create `src/components/PendingPosts.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { pendingReview } from '@/lib/posts';
import MarkdownView from '@/components/MarkdownView';

interface PendingRow {
  id: string;
  title?: string | null;
  authorName?: string | null;
  excerpt?: string | null;
  bodyMarkdown?: string | null;
  status?: string | null;
}

export default function PendingPosts() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [busy, setBusy] = useState('');
  const [openId, setOpenId] = useState('');

  async function load() {
    const { data } = await client.models.Post.list({ filter: { status: { eq: 'PENDING_REVIEW' } } });
    setRows(pendingReview(data as PendingRow[]));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setBusy(id);
    try {
      await client.models.Post.update({ id, status: 'PUBLISHED', publishedAt: new Date().toISOString() });
      await load();
    } finally {
      setBusy('');
    }
  }

  async function reject(id: string) {
    setBusy(id);
    try {
      await client.models.Post.update({ id, status: 'DRAFT' });
      await load();
    } finally {
      setBusy('');
    }
  }

  return (
    <ul className="divide-y">
      {rows.map((p) => (
        <li key={p.id} className="py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{p.title ?? p.id}</div>
              {p.authorName && <div className="text-gray-500">by {p.authorName}</div>}
              {p.excerpt && <div className="text-gray-600">{p.excerpt}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button onClick={() => setOpenId(openId === p.id ? '' : p.id)} className="text-primary">
                {openId === p.id ? 'Hide' : 'Preview'}
              </button>
              <button
                disabled={busy === p.id}
                onClick={() => approve(p.id)}
                className="rounded bg-green-600 px-2 py-1 text-xs text-white"
              >
                Approve
              </button>
              <button
                disabled={busy === p.id}
                onClick={() => reject(p.id)}
                className="rounded bg-red-600 px-2 py-1 text-xs text-white"
              >
                Reject
              </button>
            </div>
          </div>
          {openId === p.id && p.bodyMarkdown && (
            <div className="mt-3 rounded border p-3">
              <MarkdownView markdown={p.bodyMarkdown} />
            </div>
          )}
        </li>
      ))}
      {rows.length === 0 && <li className="py-3 text-sm text-gray-500">No posts awaiting review.</li>}
    </ul>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds (`'PENDING_REVIEW'` resolves on the `Post.status` filter type from Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/components/PendingPosts.tsx
git commit -m "feat: add PendingPosts admin review queue"
```

---

## Task 5: `/admin/posts` page + nav link

**Files:** Create `src/app/admin/posts/page.tsx`. Modify `src/components/AdminNav.tsx`.

- [ ] **Step 1: Create `src/app/admin/posts/page.tsx`**

```tsx
'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import PendingPosts from '@/components/PendingPosts';
import { canModerate } from '@/lib/roles';

export default function AdminPostsPage() {
  return (
    <RequireRole allow={canModerate}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Pending posts</h2>
        <PendingPosts />
      </div>
    </RequireRole>
  );
}
```

- [ ] **Step 2: Add the nav link** — in `src/components/AdminNav.tsx`, add a Pending link after the Requests link:

```tsx
      <Link href="/admin/requests" className="text-primary">Requests</Link>
      <Link href="/admin/posts" className="text-primary">Pending</Link>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; `/admin/posts` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/posts/page.tsx src/components/AdminNav.tsx
git commit -m "feat: add /admin/posts pending-review page and nav link"
```

---

## Task 6: Verification

**Files:** none (verification only).

- [ ] **Step 1: Full automated verification**

```bash
npx vitest run     # green, incl. pendingReview + publishedOnly-exclusion
npm run build      # succeeds; /admin/posts present
```

- [ ] **Step 2: Manual end-to-end (requires the Amplify sandbox/deploy with the new enum)**

1. Regenerate the backend (`npx ampx sandbox`) so the `PENDING_REVIEW` enum value exists.
2. Push a post via the CLI with the default status:
   `./blogs/upload-post.sh <some>.post.md` → confirm it reports `Status: PENDING_REVIEW`.
3. Confirm the post is **not** on the home feed and its `/posts/<slug>` page 404s / is hidden.
4. As a **ContentAdmin** (or SystemAdmin), open `/admin/posts`: the post is listed; click
   **Preview** to read the body; click **Approve**.
5. Confirm the post is now live on the feed and at its slug, with a `publishedAt`.
6. Push another, click **Reject** in `/admin/posts`, and confirm its status becomes `DRAFT`
   (still hidden).
7. Confirm a non-moderator can't reach `/admin/posts` (RequireRole).

---

## Self-review notes

- **Spec coverage:** `PENDING_REVIEW` enum (Task 2); CLI default + `--publish` + conditional `publishedAt` (Task 3); `pendingReview` filter + `publishedOnly` exclusion test (Task 1); `PendingPosts` with inline preview + Approve/Reject (Task 4); `/admin/posts` gated by `canModerate` + nav link (Task 5); manual flow incl. non-moderator gating (Task 6). All spec sections map to a task.
- **Type consistency:** `pendingReview<T extends HasStatus>(items): T[]` (Task 1) used by `PendingPosts` (Task 4). Approve writes `status: 'PUBLISHED'` + `publishedAt`; Reject writes `status: 'DRAFT'` — all valid enum values post-Task-2. The CLI writes the status as a raw string (no type dependency).
- **Deferred (per spec):** gating the in-app studio self-publish path; email/notification on submit or decision; an approver audit trail on posts.
```
