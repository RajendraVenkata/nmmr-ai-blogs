# Post Approval Flow — editorial review for CLI-pushed posts

**Date:** 2026-06-05
**Status:** Approved (design)
**Repo:** `nmmr-ai-blogs`

## Summary

Make a post pushed from the command line land in a new `PENDING_REVIEW` state instead of
going straight live. Pending posts are hidden from the public (pages already show only
`PUBLISHED`); a ContentAdmin or SystemAdmin reviews them in a new `/admin/posts` queue and
**Approves** (→ `PUBLISHED`) or **Rejects** (→ `DRAFT`). This mirrors the Coder
access-request gate, applied to content.

## Context & a key caveat

`blogs/upload-post.sh` writes posts **directly to DynamoDB** with raw AWS credentials
(`aws dynamodb put-item`), bypassing AppSync authorization. So this approval gate is a
**workflow convention, not a hard security control**: the CLI writes a non-public status,
the post stays hidden, and an admin flips it to `PUBLISHED`. Someone with the DynamoDB
credentials could still write `PUBLISHED` directly. That is acceptable for an editorial
review.

The pieces this builds on:
- `Post.status` enum is `['DRAFT', 'PUBLISHED', 'DELETED']` (`amplify/data/resource.ts`).
- Public reads filter to `PUBLISHED` via `publishedOnly` (`src/lib/posts.ts`), used by the
  home feed (`src/app/page.tsx`) and the post detail server fetch (`src/lib/serverClient.ts`).
- The admin moderation flow (`src/components/ModerationList.tsx`, `/admin/moderation`,
  gated by `RequireRole allow={canModerate}` + `AdminNav`) lists soft-deleted items and
  restores them via `Post.update` — the exact pattern this reuses.
- `upload-post.sh` currently hardcodes `status: PUBLISHED` and always stamps `publishedAt`.

## Design

### 1. Schema — `amplify/data/resource.ts`

Add `PENDING_REVIEW` to the `Post.status` enum:
`a.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'DELETED'])`. No authorization change: the
`ContentWriter`/`ContentAdmin`/`SystemAdmin` group already has `update`, so an approver
flips a post's status with an ordinary `Post.update` (the same call `ModerationList` uses to
restore). Requires a backend redeploy so the generated enum type includes the new value.

### 2. CLI — `blogs/upload-post.sh`

- Default the pushed status to **`PENDING_REVIEW`**. Add a `--status <STATUS>` flag and a
  `--publish` shorthand (`= --status PUBLISHED`) so an admin can intentionally bypass review.
- Set `publishedAt` **only** when the resolved status is `PUBLISHED` (pending posts get no
  `publishedAt`; it is stamped on approval). `createdAt`/`updatedAt` stay as now.
- The plan/dry-run output prints the resolved status so the operator sees where it will land.

### 3. Pure helper — `src/lib/posts.ts`

Add `pendingReview<T extends HasStatus>(items: T[]): T[]` returning items with
`status === 'PENDING_REVIEW'`. `publishedOnly` already returns only `PUBLISHED`, so a
`PENDING_REVIEW` post is excluded from every public surface with **no change** to the home
feed or post detail route.

### 4. Admin review queue — component + page + nav

- `src/components/PendingPosts.tsx` (client, mirrors `ModerationList`): loads posts via
  `client.models.Post.list({})` (userPool auth → the `ContentAdmin`/`SystemAdmin` group can
  read all posts, including non-public ones), filters with `pendingReview`, and renders each:
  title, author, excerpt, and a **collapsible inline preview** of `bodyMarkdown` via
  `MarkdownView` (so the admin reads the full post without it being publicly reachable). Each
  row has:
  - **Approve** → `Post.update({ id, status: 'PUBLISHED', publishedAt: new Date().toISOString() })`.
  - **Reject** → `Post.update({ id, status: 'DRAFT' })`.
  A per-row `busy` state disables the buttons during the update, then the list reloads.
- `src/app/admin/posts/page.tsx`: `RequireRole allow={canModerate}` + `AdminNav` +
  `<PendingPosts />`, following the moderation page pattern.
- `src/components/AdminNav.tsx`: add a **Pending** link (`/admin/posts`).

## Data flow

`upload-post.sh` (default) → `Post{ status: PENDING_REVIEW, publishedAt: null }` → hidden on
all public surfaces → a ContentAdmin opens `/admin/posts` → previews the body inline →
**Approve** → `Post.update` sets `PUBLISHED` + `publishedAt` → the post is now live on the
feed and its detail page. **Reject** → status `DRAFT` (the author can revise and re-push).

## Error handling

| Situation | Behavior |
|-----------|----------|
| Approve/Reject update fails | The row's `busy` state clears (parity with `ModerationList`); the post stays `PENDING_REVIEW` |
| Post pushed with `--publish` | Skips the queue by design (goes straight to `PUBLISHED`) |
| Public visits a pending post URL | Already 404s / is hidden — `publishedOnly` and the detail fetch only return `PUBLISHED` |
| Non-admin visits `/admin/posts` | Behind `RequireRole allow={canModerate}` — does not render |

## Testing

- **Vitest (`tests/posts.test.ts`):** `pendingReview` returns only `PENDING_REVIEW` items;
  `publishedOnly` excludes a `PENDING_REVIEW` item (stays hidden). (The existing
  filter tests in this file remain unchanged.)
- **CLI:** verified with `--dry-run` — the built DynamoDB item shows `status: PENDING_REVIEW`
  and no `publishedAt` by default, and `status: PUBLISHED` with a `publishedAt` under
  `--publish`.
- **Admin page/component:** build-verified plus manual.
- **Manual:** push a post via the CLI (default) → confirm it is `PENDING_REVIEW` and not
  visible on the home feed or at its slug; as a ContentAdmin open `/admin/posts`, preview it,
  **Approve** → confirm it appears publicly with a `publishedAt`; **Reject** another → confirm
  it becomes `DRAFT`.

## Out of scope (deferred)

- The in-app **studio** still lets a `ContentWriter` self-publish (its editor status dropdown
  offers Draft/Published). Gating that path (a "Submit for review" option, or removing
  self-publish for writers) is a separate, larger change to the authoring UX and AppSync
  authorization.
- Email/notification on submission or decision, and an audit trail of who approved/rejected
  (the Coder flow records `decidedBy`/`decidedAt`; posts have no equivalent fields yet).
