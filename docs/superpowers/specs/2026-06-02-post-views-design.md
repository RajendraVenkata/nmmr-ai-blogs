# Post Views — Design

**Date:** 2026-06-02
**Status:** Approved

## Problem

Posts now show comments and likes but have no view count. Add an anonymous,
once-per-visitor view counter displayed on each post page.

## Decisions (confirmed)

- **Counting:** once per visitor per post — increment the first time a browser opens a
  post, then remember it in `localStorage` so refreshes/revisits don't re-count. Anonymous.
- **Placement:** post page only (next to likes). Not on listing cards.
- **Storage:** a single counter row per post (`PostView`), *not* a row-per-view (views are
  high-volume; row-per-view would balloon and make counting expensive).

## Architecture

### 1. Data model (`amplify/data/resource.ts`)

```ts
PostView: a
  .model({
    count: a.integer().required(),
  })
  .authorization((allow) => [
    allow.publicApiKey().to(['create', 'read', 'update']),
  ]),
```

- Row id = the post's id (one `PostView` per post). The component passes `id: postId`
  explicitly on create, so the counter row and its post share the same id.
- `publicApiKey` create/read/update enables anonymous viewing. Counts are intentionally
  "soft" — a determined user could tamper via the public API (acceptable for a blog;
  hardening would require a custom resolver, deferred).
- Default auth mode stays `userPool`; all view reads/writes pass `authMode: 'apiKey'`.

This is a **backend change** → ships on the next `git push` (Amplify pipeline-deploy
provisions a `PostView` table and regenerates `amplify_outputs.json`).

### 2. Pure helpers (`src/lib/views.ts`) — unit-tested

```ts
export function viewedKey(postId: string): string;   // `viewed:${postId}`
export function formatViews(n: number): string;       // "1 view" | "N views"
```

### 3. Component (`src/components/ViewCounter.tsx`)

`ViewCounter({ postId }: { postId: string })`, a client component:

- **On mount:** `client.models.PostView.get({ id: postId }, { authMode: 'apiKey' })`
  → `count = row?.count ?? 0`; set displayed count.
- **Increment once per browser:** if `localStorage.getItem(viewedKey(postId))` is absent:
  - if the row exists → `update({ id: postId, count: count + 1 }, { authMode: 'apiKey' })`
  - else → `create({ id: postId, count: 1 }, { authMode: 'apiKey' })`
  - then `localStorage.setItem(viewedKey(postId), '1')` and optimistically show `count + 1`.
- **Safety:** all `localStorage` access is `typeof window` guarded and `try/catch`ed
  (private mode); all data calls are `try/catch`ed so a failure leaves the display at its
  current value and never throws into render. A create that races another first-viewer
  (duplicate id) is caught and ignored (the other viewer's increment stands).
- **Render:** an eye icon + `formatViews(count)`, muted styling consistent with the
  share row.

### 4. Placement (`src/app/posts/[slug]/PostDetailClient.tsx`)

Render `<ViewCounter postId={post.id} />` in the existing like/share flex row, after
`<LikeButton>`, so the row reads: like · views · share.

## Out of scope (YAGNI)

- View counts on home/listing `PostCard`s.
- Unique-by-account or by-IP dedupe (per-browser `localStorage` is the agreed definition).
- Real-time/live updates; atomic server-side increment (a custom resolver) — deferred.

## Error handling

- `localStorage` and all `PostView` reads/writes are wrapped; failures degrade to showing
  the last known count (or 0) without breaking the page.
- A logged-out or first-ever visitor with no row sees `0 views`, then `1 view` after the
  create completes.

## Testing

- **Unit:** `tests/views.test.ts` — `viewedKey` (format) and `formatViews`
  (0/1/many: "0 views", "1 view", "2 views").
- **Manual (post-deploy):** first visit shows the count incremented by one; a refresh does
  not increment again (localStorage guard); clearing the key (or another browser) counts
  again; the count renders next to likes.

## Files

| File | Change |
|------|--------|
| `amplify/data/resource.ts` | Add `PostView` model |
| `src/lib/views.ts` | New — `viewedKey`, `formatViews` |
| `tests/views.test.ts` | New — helper tests |
| `src/components/ViewCounter.tsx` | New — display + once-per-visitor increment |
| `src/app/posts/[slug]/PostDetailClient.tsx` | Render `<ViewCounter>` in the like/share row |

## Deployment

- Front-end + backend change. `git push` triggers Amplify pipeline-deploy (adds the
  `PostView` table). No data migration.
