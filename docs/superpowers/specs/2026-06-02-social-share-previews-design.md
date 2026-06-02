# Social Share Previews (Open Graph) — Design

**Date:** 2026-06-02
**Status:** Approved

## Problem

When sharing an individual blog post to LinkedIn/X/Facebook, the share dialog shows the
generic, site-wide preview ("NMMR AI Blogs" / "Hands-on insights on AI and engineering")
with no image, instead of the post's own title, excerpt, and cover image.

### Root cause

`src/app/posts/[slug]/page.tsx` is a **client component** (`'use client'`) that fetches the
post in `useEffect`. Social crawlers do not execute JavaScript — they read only the
server-rendered HTML, which carries just the static metadata from `src/app/layout.tsx` and no
`og:image`. There are no per-post Open Graph tags in the initial HTML.

## Goal

Each published post page emits server-rendered, post-specific Open Graph + Twitter Card
metadata so the share preview shows:
- the post **title**
- the post **excerpt** as description (fallback: site description)
- the post **cover image** (fallback: an auto-generated branded card)

### Non-goals / known limitations
- The "Share your thoughts…" comment text box cannot be pre-filled — hard platform restriction.
- LinkedIn caches previews; already-shared URLs need a refresh via the LinkedIn Post Inspector.

## Approach

### 1. Split the post route into server + client

- **`src/app/posts/[slug]/page.tsx`** → **server component**:
  - Fetches the post once by slug using a public-API-key server client.
  - If no published post matches → `notFound()`.
  - Exports `generateMetadata({ params })` (see §3).
  - Renders `<PostDetailClient post={post} />`, passing the fetched post down.
- **`src/app/posts/[slug]/PostDetailClient.tsx`** → **client component**:
  - Holds the existing interactive UI (CategoryChip, title, PostMeta, CoverImage,
    ShareButtons, MarkdownView, Comments).
  - Receives `post` as a prop — no `useEffect` fetch, no `useParams`, no "Loading…" state.
  - Computes the share `url` from `window.location.href` (unchanged client behavior).

**Bonus:** passing server-fetched data into the (server-rendered) client component means the
initial HTML now contains the real title and body, improving SEO and removing the load flash.

### 2. Supporting infrastructure

- **`src/lib/serverClient.ts`** — `generateServerClientUsingApiKey({ config: outputs })` from
  `@aws-amplify/adapter-nextjs/data`. Cookie-free public reads; queries pass `authMode: 'apiKey'`
  (default auth mode is `userPool`, so this is required). Reused by the OG image route.
- **`src/lib/amplifyServer.ts`** — `createServerRunner({ config: outputs })` exporting
  `runWithAmplifyServerContext`, so we can call `getUrl` from `aws-amplify/storage/server` with
  **guest credentials** (`nextServerContext: null`) to mint a signed cover URL server-side. No
  storage bucket policy changes — relies on existing `allow.guest.to(['read'])` on `media/*`.

### 3. Per-post metadata (`generateMetadata`)

```
title:       post.title
description: post.excerpt ?? siteDescription
alternates.canonical: /posts/<slug>
openGraph: { type: 'article', title, description, url, images: [ogImage],
             publishedTime: post.publishedAt, authors: [post.authorName] }
twitter:   { card: 'summary_large_image', title, description, images: [ogImage] }
```

**`ogImage` resolution:**
- If `post.coverImageKey` is set → fresh **signed S3 URL** via server-context `getUrl` (guest).
  Regenerated on every render, so any re-scrape gets a valid URL; expiry is irrelevant because
  the crawler fetches and caches at scrape time.
- Else → URL of the generated card (`/posts/<slug>/opengraph-image`).

### 4. Auto-generated fallback image

- **`src/app/posts/[slug]/opengraph-image.tsx`** — uses `next/og` `ImageResponse` to render a
  1200×630 branded card (post title + "NMMR AI Blogs"). Fetches the post title by slug via the
  server client. Used for posts without a cover image.

### 5. metadataBase

Add to `src/app/layout.tsx`:
```
metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rajendravenkata.com')
```
so relative metadata URLs resolve to absolute (required by crawlers).

## Files

| File | Change |
|------|--------|
| `src/app/posts/[slug]/page.tsx` | Rewrite as server component + `generateMetadata` |
| `src/app/posts/[slug]/PostDetailClient.tsx` | New — existing UI, `post` as prop |
| `src/app/posts/[slug]/opengraph-image.tsx` | New — `ImageResponse` fallback card |
| `src/lib/serverClient.ts` | New — API-key server data client |
| `src/lib/amplifyServer.ts` | New — `runWithAmplifyServerContext` |
| `src/app/layout.tsx` | Add `metadataBase` |

## Testing

- Unit: a pure helper that builds the metadata object from a post (title/description/image
  fallback logic) — testable without Next runtime.
- Manual: `npm run build` + run; view post page source and confirm `og:*`/`twitter:*` tags
  carry post-specific values; validate with LinkedIn Post Inspector after deploy.

## Deployment notes

- No backend (`amplify/`) changes; this is front-end only. A normal push/deploy ships it.
- `NEXT_PUBLIC_SITE_URL` optional; defaults to the production domain.
