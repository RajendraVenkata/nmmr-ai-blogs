# MNNR AI Blogs — News-Style Redesign Design / Spec

**Date:** 2026-05-31
**Status:** Approved design — pre-implementation
**Builds on:** Phase 1 + Phase 2 (both merged to `main`)

## 1. Goal

Restyle the app to a clean editorial/news look (reference: cybernews.com): a dark
sticky top bar with a centered wordmark and search, a two-column home page with a
large lead article and a sidebar, bold typography, category chips, and article-grade
markdown rendering. Theme applied app-wide; the editorial *layout* applies to the
reader pages.

## 2. Visual language (app-wide)

- **Palette:**
  - **Black** (`#0a0a0a`): top nav bar, category chips, primary buttons.
  - **Red** (`#e11d2a`): brand accent, used sparingly — logo mark, active nav item,
    headline hover underline, the notification/live dot.
  - **Blue** (`#2563eb`): inline content links (sidebar items, in-text links).
  - **White** background, near-black text (`#111827`), gray-600 body/meta.
- **Typography:** Inter via `next/font/google`. Bold, tight headlines; comfortable
  gray body. Article bodies use the Tailwind **typography (`prose`) plugin**.
- **Top nav (dark, sticky):**
  - Left: **Menu** button (hamburger) opening a dropdown — Home, plus role-aware
    Studio / Admin / Account, and Sign in / Sign out.
  - Center: **MNNR AI Blogs** wordmark (with a small red mark).
  - Right: **search** icon (toggles the home-feed filter) and an account link.
  - Replaces the current `Nav` everywhere (Studio/Admin included).

## 3. Home page — editorial layout

- Container `max-w-6xl`. Desktop: two columns (~2/3 main + 1/3 sidebar). Mobile:
  single column, sidebar below.
- **Lead article** = newest published post: large hero cover image with the
  category chip overlaid top-left, bold headline, byline + date (small clock icon),
  excerpt, linking to the post.
- **Remaining posts**: cards (cover thumb, chip, title, meta) in a list/grid.
- **Sidebar:**
  - **Latest posts** — the most recent titles + dates.
  - **Topics** — distinct tag chips collected from posts; clicking filters the feed.
- **Search**: the nav search icon toggles a text input that filters the visible feed
  client-side by title/excerpt. No backend/full-text search.

## 4. Post detail

Category chip → bold headline → byline + date (clock icon) → hero cover image →
`prose` markdown body → share buttons → comments. Same content and logic as today,
restyled.

## 5. Cover images

Posts already have an unused `coverImageKey` (S3 key). No schema change.

- **Editor**: add a dedicated **Cover image** upload that sets `coverImageKey`
  (separate from inline body media). Existing inline image/video embedding stays.
- **Rendering**: a `CoverImage` component resolves the S3 key to a URL (Amplify
  Storage `getUrl`) and renders it. **Fallback** when a post has no cover: a clean
  colored placeholder block stamped with the category label — the layout never
  looks broken.

## 6. Studio & Admin

Adopt the shared theme (new nav, Inter font, button/input styling, chips) but keep
their existing functional table/form **layouts**. The editorial two-column grid is
only for the reader pages (home, post detail). The editor additionally gains the
cover-image upload (Section 5).

## 7. Components & files

- **Rebuilt:** `src/components/Nav.tsx` (dark editorial bar + menu dropdown + search
  toggle).
- **New components:**
  - `CategoryChip` — black uppercase chip from a label.
  - `PostMeta` — byline + date with a clock icon.
  - `CoverImage` — resolves `coverImageKey` → URL with colored-placeholder fallback.
  - `ArticleCard` — lead and standard card variants.
  - `Sidebar` — Latest posts + Topics.
  - `MenuDropdown` — nav menu (role-aware links + sign in/out).
  - `SearchContext`/`SearchFilter` — shares the search query between the nav icon and
    the home feed (React context provider in the layout).
- **Pure logic (TDD):** `src/lib/format.ts`
  - `categoryLabel(tags?: string[]): string` — first tag uppercased, else `'BLOG'`.
  - `formatDate(iso?: string | null): string` — e.g. `29 May 2026`; empty string for
    missing/invalid input.
  - `collectTopics(posts): string[]` — distinct tags across posts, in first-seen order.
  - `filterPosts(posts, query): Post[]` — case-insensitive match on title/excerpt;
    empty query returns all.
- **Pages:** restyle `src/app/page.tsx` (home), `src/app/posts/[slug]/page.tsx`
  (detail), `src/app/layout.tsx` (font + search provider). Light restyle of Studio
  and Admin pages (shared classes; cover upload in `PostEditor`).
- **Config/deps:** add `@tailwindcss/typography`; configure it and the theme tokens
  in `tailwind.config.ts` and `src/app/globals.css`; load Inter in `layout.tsx`.

## 8. Testing

Vitest unit tests for `src/lib/format.ts` (`categoryLabel`, `formatDate`,
`collectTopics`, `filterPosts`). `npm run build` for compile verification; manual
check in the dev server for layout/responsiveness.

## 9. Out of scope

No new data model, no server-side/full-text search, no dark mode, no pagination.
