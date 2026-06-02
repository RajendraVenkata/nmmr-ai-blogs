# Social Share Previews (Open Graph) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render server-side, post-specific Open Graph + Twitter Card metadata so sharing a post to LinkedIn/X/Facebook shows the post's title, excerpt, and cover image (or a branded fallback card).

**Architecture:** Split the post route into a server component (data fetch + `generateMetadata`) and a client component (existing interactive UI, fed `post` as a prop). Server reads use a public-API-key Amplify client; the cover's `og:image` is a guest-credential signed S3 URL minted server-side (no bucket changes). Posts without a cover get a generated `ImageResponse` card.

**Tech Stack:** Next.js 14.2 App Router, `@aws-amplify/adapter-nextjs` (data + server context), `next/og`, vitest.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/posts.ts` | (modify) add shared `PostRow` type |
| `src/lib/postMetadata.ts` | (new) pure `buildPostMetadata()` — post → Next `Metadata` |
| `src/lib/serverClient.ts` | (new) API-key Amplify data client + `getPublishedPostBySlug()` |
| `src/lib/amplifyServer.ts` | (new) `runWithAmplifyServerContext` + `getSignedMediaUrl()` |
| `tests/postMetadata.test.ts` | (new) unit tests for `buildPostMetadata` |
| `src/app/posts/[slug]/page.tsx` | (rewrite) server component + `generateMetadata` |
| `src/app/posts/[slug]/PostDetailClient.tsx` | (new) existing UI, `post` prop |
| `src/app/posts/[slug]/og/route.tsx` | (new) `ImageResponse` fallback card |
| `src/app/layout.tsx` | (modify) add `metadataBase` |

**Note on params:** Next 14.2 `params` is synchronous — `{ params }: { params: { slug: string } }`, no `await`.

---

## Task 1: Shared `PostRow` type

**Files:**
- Modify: `src/lib/posts.ts`

- [ ] **Step 1: Add the `PostRow` interface**

Append to `src/lib/posts.ts` (keep existing `HasStatus`, `publishedOnly`, `notDeleted`):

```ts
export interface PostRow {
  id: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
  coverImageKey?: string | null;
  status?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/posts.ts
git commit -m "feat: add shared PostRow type"
```

---

## Task 2: Pure metadata builder (TDD)

**Files:**
- Create: `src/lib/postMetadata.ts`
- Test: `tests/postMetadata.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/postMetadata.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPostMetadata } from '@/lib/postMetadata';
import type { PostRow } from '@/lib/posts';

const base: PostRow = {
  id: '1',
  slug: 'hello-world',
  title: 'Hello World',
  bodyMarkdown: '# hi',
  excerpt: 'A short excerpt',
  tags: ['ai'],
  coverImageKey: 'media/cover.jpg',
  status: 'PUBLISHED',
  authorName: 'Rajendra',
  publishedAt: '2026-06-01T00:00:00.000Z',
};

describe('buildPostMetadata', () => {
  it('uses post title and excerpt', () => {
    const m = buildPostMetadata({ post: base, ogImageUrl: 'https://img/x.jpg' });
    expect(m.title).toBe('Hello World');
    expect(m.description).toBe('A short excerpt');
  });

  it('falls back to site description when excerpt is empty', () => {
    const m = buildPostMetadata({ post: { ...base, excerpt: '   ' }, ogImageUrl: 'x' });
    expect(m.description).toBe('Hands-on insights on AI and engineering');
  });

  it('sets canonical and article OG with image and author', () => {
    const m = buildPostMetadata({ post: base, ogImageUrl: 'https://img/x.jpg' });
    expect(m.alternates?.canonical).toBe('/posts/hello-world');
    expect(m.openGraph?.type).toBe('article');
    expect(m.openGraph?.url).toBe('/posts/hello-world');
    expect((m.openGraph as any).authors).toEqual(['Rajendra']);
    expect((m.openGraph as any).images[0].url).toBe('https://img/x.jpg');
  });

  it('emits a summary_large_image twitter card', () => {
    const m = buildPostMetadata({ post: base, ogImageUrl: 'https://img/x.jpg' });
    expect((m.twitter as any).card).toBe('summary_large_image');
    expect((m.twitter as any).images).toEqual(['https://img/x.jpg']);
  });

  it('omits author when authorName is absent', () => {
    const m = buildPostMetadata({ post: { ...base, authorName: null }, ogImageUrl: 'x' });
    expect((m.openGraph as any).authors).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/postMetadata.test.ts`
Expected: FAIL — cannot resolve `@/lib/postMetadata`.

- [ ] **Step 3: Implement the builder**

Create `src/lib/postMetadata.ts`:

```ts
import type { Metadata } from 'next';
import type { PostRow } from './posts';

const SITE_NAME = 'NMMR AI Blogs';
const SITE_DESCRIPTION = 'Hands-on insights on AI and engineering';

export function buildPostMetadata({
  post,
  ogImageUrl,
}: {
  post: PostRow;
  ogImageUrl: string;
}): Metadata {
  const description = post.excerpt?.trim() || SITE_DESCRIPTION;
  const path = `/posts/${post.slug}`;
  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: post.title,
      description,
      url: path,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.publishedAt ?? undefined,
      authors: post.authorName ? [post.authorName] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImageUrl],
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/postMetadata.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/postMetadata.ts tests/postMetadata.test.ts
git commit -m "feat: pure Open Graph metadata builder for posts"
```

---

## Task 3: API-key server data client

**Files:**
- Create: `src/lib/serverClient.ts`

- [ ] **Step 1: Implement the server client + fetch helper**

Create `src/lib/serverClient.ts`:

```ts
import { cache } from 'react';
import { generateServerClientUsingApiKey } from '@aws-amplify/adapter-nextjs/data';
import outputs from '../../amplify_outputs.json';
import type { Schema } from '../../amplify/data/resource';
import { publishedOnly, type PostRow } from './posts';

const serverClient = generateServerClientUsingApiKey<Schema>({
  config: outputs,
});

// React cache dedupes the query within a single request (generateMetadata + page).
export const getPublishedPostBySlug = cache(
  async (slug: string): Promise<PostRow | null> => {
    const { data } = await serverClient.models.Post.list({
      filter: { slug: { eq: slug } },
    });
    return publishedOnly(data as PostRow[])[0] ?? null;
  },
);
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/serverClient.ts
git commit -m "feat: API-key Amplify server client for public post reads"
```

---

## Task 4: Server context + signed media URL

**Files:**
- Create: `src/lib/amplifyServer.ts`

- [ ] **Step 1: Implement the server runner + signed URL helper**

Create `src/lib/amplifyServer.ts`:

```ts
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { getUrl } from 'aws-amplify/storage/server';
import outputs from '../../amplify_outputs.json';

export const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
});

// Mints a short-lived signed URL for a media object using guest credentials
// (media/* allows guest read). Regenerated per render, so re-scrapes get a fresh URL.
export async function getSignedMediaUrl(key: string): Promise<string> {
  const { url } = await runWithAmplifyServerContext({
    nextServerContext: null,
    operation: (contextSpec) => getUrl(contextSpec, { path: key }),
  });
  return url.toString();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/amplifyServer.ts
git commit -m "feat: server context helper for guest-signed media URLs"
```

---

## Task 5: Extract `PostDetailClient`

**Files:**
- Create: `src/app/posts/[slug]/PostDetailClient.tsx`

- [ ] **Step 1: Create the client component**

Create `src/app/posts/[slug]/PostDetailClient.tsx` (the existing UI, now prop-driven — no fetch, no loading state, no `useParams`):

```tsx
'use client';

import { categoryLabel } from '@/lib/format';
import type { PostRow } from '@/lib/posts';
import MarkdownView from '@/components/MarkdownView';
import ShareButtons from '@/components/ShareButtons';
import Comments from '@/components/Comments';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import CoverImage from '@/components/CoverImage';

export default function PostDetailClient({ post }: { post: PostRow }) {
  const url =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://rajendravenkata.com/posts/${post.slug}`;
  const label = categoryLabel(post.tags ?? []);

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <CategoryChip label={label} />
      <h1 className="text-4xl font-extrabold leading-tight">{post.title}</h1>
      <PostMeta authorName={post.authorName} date={post.publishedAt} />
      <CoverImage
        coverKey={post.coverImageKey}
        label={label}
        className="aspect-[16/9] w-full rounded"
      />
      <ShareButtons url={url} title={post.title} />
      <MarkdownView markdown={post.bodyMarkdown} />
      <div className="pt-8">
        <Comments postId={post.id} />
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/posts/[slug]/PostDetailClient.tsx
git commit -m "feat: prop-driven PostDetailClient component"
```

---

## Task 6: Server post page with `generateMetadata`

**Files:**
- Modify (rewrite): `src/app/posts/[slug]/page.tsx`

- [ ] **Step 1: Replace the page with a server component**

Overwrite `src/app/posts/[slug]/page.tsx` (remove the old `'use client'` version entirely):

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPostBySlug } from '@/lib/serverClient';
import { getSignedMediaUrl } from '@/lib/amplifyServer';
import { buildPostMetadata } from '@/lib/postMetadata';
import PostDetailClient from './PostDetailClient';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) return { title: 'Post not found' };

  const ogImageUrl = post.coverImageKey
    ? await getSignedMediaUrl(post.coverImageKey)
    : `/posts/${post.slug}/og`;

  return buildPostMetadata({ post, ogImageUrl });
}

export default async function PostDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) notFound();
  return <PostDetailClient post={post} />;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/posts/[slug]/page.tsx
git commit -m "feat: server-render post page with per-post Open Graph metadata"
```

---

## Task 7: Generated fallback OG image

**Files:**
- Create: `src/app/posts/[slug]/og/route.tsx`

- [ ] **Step 1: Implement the ImageResponse route**

Create `src/app/posts/[slug]/og/route.tsx`:

```tsx
import { ImageResponse } from 'next/og';
import { getPublishedPostBySlug } from '@/lib/serverClient';

export const runtime = 'nodejs';
export const contentType = 'image/png';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const post = await getPublishedPostBySlug(params.slug);
  const title = post?.title ?? 'NMMR AI Blogs';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '80px',
          background: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, opacity: 0.85 }}>
          NMMR AI Blogs
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ display: 'flex', fontSize: 30, opacity: 0.7 }}>
          rajendravenkata.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/posts/[slug]/og/route.tsx
git commit -m "feat: generated fallback Open Graph card for coverless posts"
```

---

## Task 8: metadataBase in root layout

**Files:**
- Modify: `src/app/layout.tsx:7-10`

- [ ] **Step 1: Add metadataBase to the metadata export**

Replace the `metadata` export in `src/app/layout.tsx`:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rajendravenkata.com'),
  title: 'NMMR AI Blogs',
  description: 'Hands-on insights on AI and engineering',
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: set metadataBase so OG URLs resolve to absolute"
```

---

## Task 9: Full build + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit suite**

Run: `npm run test`
Expected: all tests pass, including `tests/postMetadata.test.ts`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/posts/[slug]` and `/posts/[slug]/og` appear as dynamic routes. This is the key check that the server/client boundary, Amplify server imports, and `next/og` route all compile together.

- [ ] **Step 4: Manual OG check (local)**

Run: `npm run start`, open a published post, View Source.
Expected: HTML contains `<meta property="og:title">` = post title, `og:description` = excerpt, `og:image`, `og:type` = article, and `twitter:card` = summary_large_image. The post title/body are present in the server HTML (no "Loading…").

- [ ] **Step 5: Post-deploy validation (after deploy)**

Paste a live post URL into the LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/) and re-scrape. Expected: card shows the post title, excerpt, and cover image (or the generated card for coverless posts).

---

## Self-Review Notes

- **Spec coverage:** route split (T5, T6), `generateMetadata` (T6), `serverClient` (T3), `amplifyServer` signed URL (T4), fallback image (T7), `metadataBase` (T8), pure builder + tests (T2) — all spec sections mapped.
- **Type consistency:** `PostRow` (T1) is the single shared shape used by `serverClient` (T3), `postMetadata` (T2), and `PostDetailClient` (T5). `getPublishedPostBySlug` and `getSignedMediaUrl` signatures match their call sites in T6/T7.
- **Risk flagged:** the `og` route uses `runtime = 'nodejs'` because it calls the Amplify SDK (not edge-compatible). If `next/og` fails to render on node in this Next version, fall back to a static default image referenced from `generateMetadata` instead of the dynamic route.
