# Post Likes — Design

**Date:** 2026-06-02
**Status:** Approved

## Problem

Posts support comments but have no lightweight way to show appreciation. Add a
sign-in-required, toggleable "like" on each post, with a visible count.

## Decisions (confirmed)

- **Who:** signed-in users only; one like per user; click to like / unlike (toggle).
- **Scope:** posts only (not comments; not home-listing counts).
- **Storage:** one `Like` record per (user, post), using a deterministic id —
  *not* a counter field on `Post` (a counter can't de-dupe or track per-user state).

## Architecture

### 1. Data model (`amplify/data/resource.ts`)

New model, following the `Comment` model's conventions:

```ts
Like: a
  .model({
    postId: a.id().required(),
    userId: a.string().required(),
  })
  .authorization((allow) => [
    allow.publicApiKey().to(['read']),   // counts visible to everyone (incl. logged-out)
    allow.authenticated().to(['read']),
    allow.owner().to(['create', 'read', 'delete']),  // sign in to like; remove only your own
  ]),
```

- `allow.owner()` adds an `owner` attribute and restricts create/delete to the creator.
- Default auth mode stays `userPool`; public reads pass `authMode: 'apiKey'` (as Comments do).
- **Deterministic id:** likes are created with `id = "<postId>::<userId>"`. This makes
  one-like-per-user structurally impossible to violate (same id = same row) and makes
  unlike a direct `delete({ id })` with no lookup. `userId` is also stored as a field
  for filtered listing.

This is a **backend change** → ships on the next `git push` (Amplify pipeline-deploy
provisions a new `Like` DynamoDB table + GraphQL types and regenerates `amplify_outputs.json`).

### 2. Pure helpers (`src/lib/likes.ts`) — unit-tested

```ts
export const LIKE_ID_SEP = '::';
export function likeId(postId: string, userId: string): string; // `${postId}::${userId}`
export interface LikeRow { id: string; postId: string; userId: string; }
export function userHasLiked(rows: LikeRow[], postId: string, userId: string): boolean;
```

Counting is just `rows.length` for a post's like list, so no dedicated count helper is
needed beyond `userHasLiked`.

### 3. Component (`src/components/LikeButton.tsx`)

`LikeButton({ postId }: { postId: string })`, mirroring `Comments.tsx` structure:

- Uses `useCurrentUser()`.
- **Load:** `client.models.Like.list({ filter: { postId: { eq: postId } }, authMode: 'apiKey' })`
  → `count = rows.length`; `liked = userHasLiked(rows, postId, user.userId)` (false if logged out).
- **Toggle (signed in):** optimistic update of `liked`/`count`, then:
  - like → `client.models.Like.create({ id: likeId(postId, userId), postId, userId })`
  - unlike → `client.models.Like.delete({ id: likeId(postId, userId) })`
  - on error → revert local state and re-`load()`.
- **Signed out:** render the heart + count, disabled, with a muted "Sign in to like"
  affordance (consistent with Comments' signed-out message).
- Heart icon: inline SVG, filled (primary color) when liked, outline otherwise.

### 4. Placement (`src/components/PostDetailClient.tsx`)

Render `<LikeButton postId={post.id} />` in the existing share row, alongside the share
icons, so likes and sharing sit together under the cover image.

## Out of scope (YAGNI)

- Like counts on home/listing `PostCard`s (would require a per-post count fetch).
- Liking comments.
- Real-time/live count updates (load on mount + after toggle is enough).

## Error handling

- All reads/writes wrapped so a failure never throws into render; on toggle failure,
  revert the optimistic change and reload the true count.
- Logged-out click never calls the API.

## Testing

- **Unit:** `tests/likes.test.ts` for `likeId` and `userHasLiked` (present / absent /
  empty / different user).
- **Manual (post-deploy):** like toggles fill/outline and increments/decrements; count
  persists on reload; a second tab/user sees the updated count after reload; logged-out
  visitors see the count but cannot toggle.

## Files

| File | Change |
|------|--------|
| `amplify/data/resource.ts` | Add `Like` model |
| `src/lib/likes.ts` | New — pure helpers |
| `tests/likes.test.ts` | New — helper tests |
| `src/components/LikeButton.tsx` | New — like UI |
| `src/components/PostDetailClient.tsx` | Render `<LikeButton>` in the share row |

## Deployment

- Front-end + backend change. `git push` triggers Amplify pipeline-deploy, which adds
  the `Like` table and serves the updated UI. No data migration needed.
