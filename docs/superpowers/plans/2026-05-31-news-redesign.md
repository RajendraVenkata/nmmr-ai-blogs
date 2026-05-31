# News-Style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the app to a clean editorial/news look — dark sticky nav with centered wordmark + search, a two-column home (lead article + sidebar), category chips, cover images, and article-grade markdown.

**Architecture:** Pure CSS/component changes on top of the existing data layer. A `format.ts` helper library (TDD) supplies category labels, date formatting, topic collection, and feed filtering. A React `SearchContext` shares the nav search query with the home feed. Cover images reuse the existing `coverImageKey` field with a placeholder fallback. No backend/schema change.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS + `@tailwindcss/typography`, `aws-amplify` v6 (Storage `getUrl`), Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-31-news-redesign-design.md`

**Working directory:** repo root `nmmr-ai-blogs/` (branch `news-redesign`). All paths relative to it.

> **Build-reliability note:** the spec mentioned Inter via `next/font/google`; this plan
> instead uses a system sans-serif stack in `globals.css` to avoid a build-time font
> fetch (which fails in offline CI). Same clean, bold look; no network dependency.

---

## File structure

```
tailwind.config.ts                 # MODIFY: brand/link colors + typography plugin
src/app/globals.css                # MODIFY: light theme, system font, drop dark media query
src/app/layout.tsx                 # MODIFY: SearchProvider wrap + wider main container
src/lib/format.ts                  # NEW: categoryLabel, formatDate, collectTopics, filterPosts
src/lib/SearchContext.tsx          # NEW: search query/visibility context
src/components/CategoryChip.tsx     # NEW
src/components/PostMeta.tsx         # NEW (byline + date + clock icon)
src/components/CoverImage.tsx       # NEW (S3 key → url, placeholder fallback)
src/components/ArticleCard.tsx      # NEW (lead + standard variants)
src/components/Sidebar.tsx          # NEW (latest posts + topics)
src/components/Nav.tsx              # REPLACE (dark editorial bar + menu + search)
src/app/page.tsx                   # REPLACE (two-column editorial home)
src/app/posts/[slug]/page.tsx       # REPLACE (chip + hero + prose)
src/components/PostEditor.tsx       # MODIFY: cover-image upload + coverImageKey in PostDraft
src/app/studio/posts/new/page.tsx   # MODIFY: thread coverImageKey
src/app/studio/posts/[id]/edit/page.tsx  # MODIFY: thread coverImageKey
tests/format.test.ts               # NEW
```

---

## Task 1: Theme foundation (Tailwind, globals, layout)

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1: Install the typography plugin**

```bash
npm install -D @tailwindcss/typography
```

- [ ] **Step 2: Replace `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#e11d2a",
        link: "#2563eb",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

- [ ] **Step 3: Replace `src/app/globals.css`** (light theme, system font, no dark media query)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #111827;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    Helvetica, Arial, sans-serif;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 4: Replace `src/app/layout.tsx`** (search provider + wider container)

```tsx
import type { Metadata } from 'next';
import './globals.css';
import '@aws-amplify/ui-react/styles.css';
import ConfigureAmplify from '@/components/ConfigureAmplify';
import Nav from '@/components/Nav';
import { SearchProvider } from '@/lib/SearchContext';

export const metadata: Metadata = {
  title: 'MNNR AI Blogs',
  description: 'Role-based blogging on AWS Amplify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <ConfigureAmplify />
        <SearchProvider>
          <Nav />
          <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
        </SearchProvider>
      </body>
    </html>
  );
}
```

> This references `@/lib/SearchContext` and the new `Nav` (Tasks 3–4). The build is
> verified at the end of Task 4 once those exist. Do not build between Steps here.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/app/layout.tsx package.json package-lock.json && git commit -m "feat(web): add news theme tokens, typography plugin, and search provider wrap"
```

---

## Task 2: `format.ts` helpers (TDD)

**Files:**
- Create: `tests/format.test.ts`, `src/lib/format.ts`

- [ ] **Step 1: Write the failing test** — `tests/format.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { categoryLabel, formatDate, collectTopics, filterPosts } from '@/lib/format';

describe('categoryLabel', () => {
  it('uppercases the first non-empty tag', () => {
    expect(categoryLabel(['security', 'ai'])).toBe('SECURITY');
  });
  it('falls back to BLOG when there are no tags', () => {
    expect(categoryLabel([])).toBe('BLOG');
    expect(categoryLabel(undefined)).toBe('BLOG');
    expect(categoryLabel([null, '  '])).toBe('BLOG');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as "29 May 2026"', () => {
    expect(formatDate('2026-05-29T10:00:00Z')).toBe('29 May 2026');
  });
  it('returns empty string for missing or invalid input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('collectTopics', () => {
  it('returns distinct tags in first-seen order', () => {
    const posts = [
      { tags: ['a', 'b'] },
      { tags: ['b', 'c'] },
      { tags: null },
    ];
    expect(collectTopics(posts)).toEqual(['a', 'b', 'c']);
  });
});

describe('filterPosts', () => {
  const posts = [
    { title: 'AI safety', excerpt: 'about ai', tags: ['ai'] },
    { title: 'Cooking', excerpt: 'food stuff', tags: ['life'] },
  ];
  it('returns all posts for an empty query', () => {
    expect(filterPosts(posts, '')).toHaveLength(2);
  });
  it('matches title, excerpt, or tag case-insensitively', () => {
    expect(filterPosts(posts, 'AI').map((p) => p.title)).toEqual(['AI safety']);
    expect(filterPosts(posts, 'food').map((p) => p.title)).toEqual(['Cooking']);
    expect(filterPosts(posts, 'life').map((p) => p.title)).toEqual(['Cooking']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/format.test.ts`
Expected: FAIL — cannot resolve `@/lib/format`.

- [ ] **Step 3: Write `src/lib/format.ts`**

```ts
export function categoryLabel(tags?: (string | null | undefined)[] | null): string {
  const first = (tags ?? []).find((t) => !!t && t.trim().length > 0);
  return first ? first.trim().toUpperCase() : 'BLOG';
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface HasTags {
  tags?: (string | null)[] | null;
}

export function collectTopics<T extends HasTags>(posts: T[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of posts) {
    for (const t of p.tags ?? []) {
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

export interface Searchable {
  title?: string | null;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
}

export function filterPosts<T extends Searchable>(posts: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return posts;
  return posts.filter((p) => {
    const hay = [p.title ?? '', p.excerpt ?? '', ...(p.tags ?? []).map((t) => t ?? '')]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass (Phase 1+2 suites plus the new format tests).

- [ ] **Step 6: Commit**

```bash
git add tests/format.test.ts src/lib/format.ts && git commit -m "feat: add formatting and feed-filter helpers"
```

---

## Task 3: Search context + presentational primitives

**Files:**
- Create: `src/lib/SearchContext.tsx`, `src/components/CategoryChip.tsx`, `src/components/PostMeta.tsx`, `src/components/CoverImage.tsx`

- [ ] **Step 1: Create `src/lib/SearchContext.tsx`**

```tsx
'use client';

import { createContext, useContext, useState } from 'react';

interface SearchCtx {
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const Ctx = createContext<SearchCtx>({
  query: '',
  setQuery: () => {},
  open: false,
  setOpen: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ query, setQuery, open, setOpen }}>{children}</Ctx.Provider>
  );
}

export function useSearch() {
  return useContext(Ctx);
}
```

- [ ] **Step 2: Create `src/components/CategoryChip.tsx`**

```tsx
export default function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-block bg-black px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Create `src/components/PostMeta.tsx`**

```tsx
import { formatDate } from '@/lib/format';

export default function PostMeta({
  authorName,
  date,
}: {
  authorName?: string | null;
  date?: string | null;
}) {
  const d = formatDate(date);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
      {authorName && (
        <span>
          by <span className="font-medium text-gray-700">{authorName}</span>
        </span>
      )}
      {d && (
        <span className="flex items-center gap-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {d}
        </span>
      )}
    </p>
  );
}
```

- [ ] **Step 4: Create `src/components/CoverImage.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';

export default function CoverImage({
  coverKey,
  label,
  className = '',
}: {
  coverKey?: string | null;
  label: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (coverKey) {
      getUrl({ path: coverKey })
        .then(({ url }) => {
          if (active) setUrl(url.toString());
        })
        .catch(() => {
          if (active) setUrl(null);
        });
    } else {
      setUrl(null);
    }
    return () => {
      active = false;
    };
  }, [coverKey]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={label} className={`${className} object-cover`} />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-600`}
    >
      <span className="text-sm font-bold uppercase tracking-wide text-white/80">{label}</span>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/SearchContext.tsx src/components/CategoryChip.tsx src/components/PostMeta.tsx src/components/CoverImage.tsx && git commit -m "feat(web): add search context, category chip, post meta, and cover image"
```

---

## Task 4: Rebuild the nav (dark bar + menu dropdown + search)

**Files:**
- Replace: `src/components/Nav.tsx`

- [ ] **Step 1: Replace `src/components/Nav.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'aws-amplify/auth';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useSearch } from '@/lib/SearchContext';
import { canAuthor, canGrantRoles } from '@/lib/roles';

export default function Nav() {
  const { user } = useCurrentUser();
  const { query, setQuery, open, setOpen } = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a] text-white">
      <nav className="mx-auto flex max-w-6xl items-center px-4 py-3">
        <div className="relative flex-1">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 text-sm"
            aria-label="Menu"
          >
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
            </span>
            Menu
          </button>
          {menuOpen && (
            <div className="absolute left-0 mt-2 w-48 rounded bg-white py-2 text-sm text-gray-900 shadow-lg">
              <Link href="/" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Home</Link>
              {user && canAuthor(user.role) && (
                <Link href="/studio" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Studio</Link>
              )}
              {user && canGrantRoles(user.role) && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Admin</Link>
              )}
              {user && (
                <Link href="/account" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Account</Link>
              )}
              {user ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                >
                  Sign out
                </button>
              ) : (
                <Link href="/auth" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Sign in</Link>
              )}
            </div>
          )}
        </div>

        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="inline-block h-4 w-4 rounded-sm bg-brand" />
          MNNR AI Blogs
        </Link>

        <div className="flex flex-1 items-center justify-end gap-4">
          <button aria-label="Search" onClick={() => setOpen(!open)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
          {user ? (
            <Link href="/account" className="hidden text-sm sm:inline">{user.email || 'Account'}</Link>
          ) : (
            <Link href="/auth" className="text-sm">Sign in</Link>
          )}
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-6xl px-4 py-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              className="w-full rounded bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Build & verify** (this validates Tasks 1, 3, 4 together)

Run: `npm run build`
Expected: compiles. Pre-existing `react-hooks/exhaustive-deps` warnings elsewhere are acceptable.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.tsx && git commit -m "feat(web): rebuild nav as dark editorial bar with menu and search"
```

---

## Task 5: Editorial home page (ArticleCard + Sidebar + feed)

**Files:**
- Create: `src/components/ArticleCard.tsx`, `src/components/Sidebar.tsx`
- Replace: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/ArticleCard.tsx`**

```tsx
'use client';

import Link from 'next/link';
import CoverImage from '@/components/CoverImage';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import { categoryLabel } from '@/lib/format';

export interface ArticleCardPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
  coverImageKey?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
}

export default function ArticleCard({
  post,
  variant = 'standard',
}: {
  post: ArticleCardPost;
  variant?: 'lead' | 'standard';
}) {
  const label = categoryLabel(post.tags ?? []);

  if (variant === 'lead') {
    return (
      <article className="space-y-3">
        <Link href={`/posts/${post.slug}`} className="block">
          <div className="relative">
            <CoverImage coverKey={post.coverImageKey} label={label} className="aspect-[16/9] w-full rounded" />
            <div className="absolute left-3 top-3">
              <CategoryChip label={label} />
            </div>
          </div>
        </Link>
        <Link href={`/posts/${post.slug}`}>
          <h2 className="text-3xl font-extrabold leading-tight decoration-brand hover:underline">
            {post.title}
          </h2>
        </Link>
        <PostMeta authorName={post.authorName} date={post.publishedAt} />
        {post.excerpt && <p className="text-gray-600">{post.excerpt}</p>}
      </article>
    );
  }

  return (
    <article className="flex gap-4 border-b pb-4">
      <Link href={`/posts/${post.slug}`} className="shrink-0">
        <CoverImage coverKey={post.coverImageKey} label={label} className="h-24 w-36 rounded" />
      </Link>
      <div className="space-y-1">
        <CategoryChip label={label} />
        <Link href={`/posts/${post.slug}`}>
          <h3 className="text-lg font-bold leading-snug decoration-brand hover:underline">
            {post.title}
          </h3>
        </Link>
        <PostMeta authorName={post.authorName} date={post.publishedAt} />
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Create `src/components/Sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useSearch } from '@/lib/SearchContext';
import { formatDate, collectTopics } from '@/lib/format';

interface SidebarPost {
  id: string;
  slug: string;
  title: string;
  publishedAt?: string | null;
  tags?: (string | null)[] | null;
}

export default function Sidebar({ posts }: { posts: SidebarPost[] }) {
  const { setQuery, setOpen } = useSearch();
  const latest = posts.slice(0, 5);
  const topics = collectTopics(posts);

  return (
    <aside className="space-y-8">
      <section>
        <h2 className="mb-3 border-b pb-1 text-lg font-bold">Latest posts</h2>
        <ul className="space-y-3">
          {latest.map((p) => (
            <li key={p.id}>
              <Link href={`/posts/${p.slug}`} className="font-medium text-link hover:underline">
                {p.title}
              </Link>
              <div className="text-xs text-gray-400">{formatDate(p.publishedAt)}</div>
            </li>
          ))}
          {latest.length === 0 && <li className="text-sm text-gray-400">Nothing yet.</li>}
        </ul>
      </section>
      {topics.length > 0 && (
        <section>
          <h2 className="mb-3 border-b pb-1 text-lg font-bold">Topics</h2>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setQuery(t);
                  setOpen(true);
                }}
                className="rounded-full border px-3 py-1 text-xs hover:border-brand hover:text-brand"
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Replace `src/app/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import { filterPosts } from '@/lib/format';
import { useSearch } from '@/lib/SearchContext';
import ArticleCard, { type ArticleCardPost } from '@/components/ArticleCard';
import Sidebar from '@/components/Sidebar';

export default function Home() {
  const [posts, setPosts] = useState<ArticleCardPost[]>([]);
  const { query } = useSearch();

  useEffect(() => {
    client.models.Post.list({ authMode: 'apiKey' }).then(({ data }) => {
      const visible = publishedOnly(data as ArticleCardPost[]).sort((a, b) =>
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
      setPosts(visible);
    });
  }, []);

  const filtered = filterPosts(posts, query);
  const lead = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        {lead ? (
          <>
            <ArticleCard post={lead} variant="lead" />
            <div className="space-y-4">
              {rest.map((p) => (
                <ArticleCard key={p.id} post={p} variant="standard" />
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-500">
            {query ? 'No posts match your search.' : 'No posts published yet.'}
          </p>
        )}
      </div>
      <Sidebar posts={posts} />
    </div>
  );
}
```

- [ ] **Step 4: Build & verify**

Run: `npm run build`
Expected: compiles; `/` present.

- [ ] **Step 5: Commit**

```bash
git add src/components/ArticleCard.tsx src/components/Sidebar.tsx src/app/page.tsx && git commit -m "feat(web): editorial home page with lead article and sidebar"
```

---

## Task 6: Restyle the post-detail page

**Files:**
- Replace: `src/app/posts/[slug]/page.tsx`

- [ ] **Step 1: Replace `src/app/posts/[slug]/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import { categoryLabel } from '@/lib/format';
import MarkdownView from '@/components/MarkdownView';
import ShareButtons from '@/components/ShareButtons';
import Comments from '@/components/Comments';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import CoverImage from '@/components/CoverImage';

interface PostRow {
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

export default function PostDetail() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    client.models.Post.list({
      filter: { slug: { eq: params.slug } },
      authMode: 'apiKey',
    }).then(({ data }) => {
      const match = publishedOnly(data as PostRow[])[0];
      if (match) setPost(match);
      else setNotFound(true);
    });
  }, [params.slug]);

  if (notFound) return <p className="py-8">Post not found.</p>;
  if (!post) return <p className="py-8">Loading…</p>;

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const label = categoryLabel(post.tags ?? []);

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <CategoryChip label={label} />
      <h1 className="text-4xl font-extrabold leading-tight">{post.title}</h1>
      <PostMeta authorName={post.authorName} date={post.publishedAt} />
      <CoverImage coverKey={post.coverImageKey} label={label} className="aspect-[16/9] w-full rounded" />
      <ShareButtons url={url} title={post.title} />
      <MarkdownView markdown={post.bodyMarkdown} />
      <div className="pt-8">
        <Comments postId={post.id} />
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Build & verify**

Run: `npm run build`
Expected: compiles; `/posts/[slug]` present.

- [ ] **Step 3: Commit**

```bash
git add "src/app/posts/[slug]/page.tsx" && git commit -m "feat(web): restyle post detail with chip, hero cover, and prose"
```

---

## Task 7: Cover-image upload in the editor

**Files:**
- Modify: `src/components/PostEditor.tsx`, `src/app/studio/posts/new/page.tsx`, `src/app/studio/posts/[id]/edit/page.tsx`

- [ ] **Step 1: Replace `src/components/PostEditor.tsx`** (adds `coverImageKey` + cover upload)

```tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { uploadData, getUrl } from 'aws-amplify/storage';
import '@uiw/react-md-editor/markdown-editor.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export interface PostDraft {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  status: 'DRAFT' | 'PUBLISHED';
  coverImageKey?: string | null;
}

export default function PostEditor({
  initial,
  onSave,
}: {
  initial: PostDraft;
  onSave: (draft: PostDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PostDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      setUploadError('');
      const key = `media/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      await uploadData({ path: key, data: file }).result;
      const { url } = await getUrl({ path: key });
      const isVideo = file.type.startsWith('video/');
      const snippet = isVideo
        ? `\n<video src="${url.toString()}" controls width="100%"></video>\n`
        : `\n![${file.name}](${url.toString()})\n`;
      setDraft((d) => ({ ...d, bodyMarkdown: d.bodyMarkdown + snippet }));
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverUpload(file: File) {
    setCoverUploading(true);
    try {
      setUploadError('');
      const key = `media/cover-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      await uploadData({ path: key, data: file }).result;
      setDraft((d) => ({ ...d, coverImageKey: key }));
    } catch {
      setUploadError('Cover upload failed. Please try again.');
    } finally {
      setCoverUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded border p-2 text-lg"
        placeholder="Title"
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <input
        className="w-full rounded border p-2"
        placeholder="Excerpt"
        value={draft.excerpt}
        onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
      />
      <label className="block text-sm">
        Cover image:{' '}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
        />
        {coverUploading && <span className="ml-2 text-gray-500">Uploading…</span>}
        {draft.coverImageKey && <span className="ml-2 text-green-600">Cover set ✓</span>}
      </label>
      <label className="block text-sm">
        Upload image/video into body:{' '}
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading && <span className="ml-2 text-gray-500">Uploading…</span>}
        {uploadError && <span className="ml-2 text-red-600">{uploadError}</span>}
      </label>
      <div data-color-mode="light">
        <MDEditor
          height={400}
          value={draft.bodyMarkdown}
          onChange={(v) => setDraft({ ...draft, bodyMarkdown: v ?? '' })}
        />
      </div>
      <div className="flex items-center gap-3">
        <select
          className="rounded border p-2"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value as PostDraft['status'] })}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/studio/posts/new/page.tsx`** (thread `coverImageKey`)

```tsx
'use client';

import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import PostEditor, { type PostDraft } from '@/components/PostEditor';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor } from '@/lib/roles';
import { uniqueSlug } from '@/lib/slug';

export default function NewPostPage() {
  return (
    <RequireRole allow={canAuthor}>
      <NewPostInner />
    </RequireRole>
  );
}

function NewPostInner() {
  const router = useRouter();
  const { user } = useCurrentUser();

  async function save(draft: PostDraft) {
    if (!user) return;
    const { data: existing } = await client.models.Post.list({
      filter: { status: { ne: 'DELETED' } },
    });
    const slugs = (existing ?? []).map((p) => p.slug);
    const slug = uniqueSlug(draft.title, slugs);
    await client.models.Post.create({
      ...draft,
      slug,
      authorId: user.userId,
      authorName: user.email,
      publishedAt: draft.status === 'PUBLISHED' ? new Date().toISOString() : null,
    });
    router.push('/studio');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New post</h1>
      <PostEditor
        initial={{ title: '', excerpt: '', bodyMarkdown: '', status: 'DRAFT', coverImageKey: null }}
        onSave={save}
      />
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/studio/posts/[id]/edit/page.tsx`** (thread `coverImageKey`)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import PostEditor, { type PostDraft } from '@/components/PostEditor';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canEditPost } from '@/lib/roles';

export default function EditPostPage() {
  return (
    <RequireRole allow={canAuthor}>
      <EditPostInner />
    </RequireRole>
  );
}

function EditPostInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [originalPublishedAt, setOriginalPublishedAt] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    client.models.Post.get({ id: params.id }).then(({ data }) => {
      if (!data || !user) return;
      if (!canEditPost(user.role, user.userId, data)) {
        setDenied(true);
        return;
      }
      setOriginalPublishedAt(data.publishedAt ?? null);
      setDraft({
        title: data.title,
        excerpt: data.excerpt ?? '',
        bodyMarkdown: data.bodyMarkdown,
        status: data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        coverImageKey: data.coverImageKey ?? null,
      });
    });
  }, [params.id, user?.userId]);

  async function save(next: PostDraft) {
    await client.models.Post.update({
      id: params.id,
      title: next.title,
      excerpt: next.excerpt,
      bodyMarkdown: next.bodyMarkdown,
      status: next.status,
      coverImageKey: next.coverImageKey ?? null,
      publishedAt:
        next.status === 'PUBLISHED'
          ? (originalPublishedAt ?? new Date().toISOString())
          : null,
    });
    router.push('/studio');
  }

  if (denied) return <p className="py-8">You can&apos;t edit this post.</p>;
  if (!draft) return <p className="py-8">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit post</h1>
      <PostEditor initial={draft} onSave={save} />
    </div>
  );
}
```

- [ ] **Step 4: Build & verify**

Run: `npm run build`
Expected: compiles; studio routes present.

- [ ] **Step 5: Commit**

```bash
git add src/components/PostEditor.tsx src/app/studio/posts/new/page.tsx "src/app/studio/posts/[id]/edit/page.tsx" && git commit -m "feat(web): add cover-image upload and persist coverImageKey"
```

---

## Task 8: README note + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a UI section to `README.md`**

Append:
```markdown

## UI

News/editorial theme: dark sticky nav (Menu dropdown + centered wordmark + search),
two-column home page (lead article + Latest/Topics sidebar), category chips from the
post's first tag, cover images (set per post in the editor; a colored placeholder is
shown when absent), and article-grade markdown via the Tailwind typography plugin.
The nav search icon filters the home feed client-side.
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all unit tests pass (including `tests/format.test.ts`).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds; routes include `/`, `/posts/[slug]`, `/account`, `/admin/*`, `/studio/*`.

- [ ] **Step 4: Commit**

```bash
git add README.md && git commit -m "docs: document the news-style UI"
```

---

## Self-review — spec coverage

| Spec requirement | Task |
|---|---|
| Theme palette (black/red/blue), light bg | Task 1 (tokens), used across components |
| System sans typography + `prose` plugin | Task 1 (font + plugin); `MarkdownView` already uses `prose` |
| Dark sticky nav: Menu dropdown, centered wordmark, search, account | Task 4 |
| Search toggles client-side feed filter | Tasks 3 (context), 4 (input), 5 (`filterPosts`) |
| Home: lead article + cards + sidebar (Latest + Topics) | Task 5 |
| Category chip from first tag, fallback BLOG | Task 2 (`categoryLabel`), 3 (`CategoryChip`) |
| Byline + date with clock icon | Task 3 (`PostMeta`) |
| Cover image via `coverImageKey` + placeholder fallback | Task 3 (`CoverImage`), 7 (editor sets key) |
| Post detail restyle (chip, hero, prose) | Task 6 |
| Topics collected from tags; click filters | Task 2 (`collectTopics`), 5 (`Sidebar`) |
| Studio/Admin adopt theme (nav, font, buttons) | Tasks 1, 4 (global); 7 (editor button → black) |
| Tests for helpers | Task 2 |

**Out of scope (per spec):** no schema change, no server/full-text search, no dark mode, no pagination.
