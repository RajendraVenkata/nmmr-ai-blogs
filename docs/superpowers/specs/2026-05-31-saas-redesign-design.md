# MNMR AI Blogs — SaaS Redesign Design / Spec

**Date:** 2026-05-31
**Status:** Approved design — pre-implementation
**Reference:** https://nmmr.tech/ (home) and https://nmmr.tech/login (login)
**Replaces:** the dark editorial/news theme

## 1. Goal

Restyle the app to the clean, light enterprise-SaaS look of nmmr.tech: a light top
nav with Sign In / Get Started, a hero + feature cards + post card-grid home, and a
custom centered login/register experience (replacing the Amplify Authenticator).

## 2. Decisions (confirmed)

| Decision | Choice |
|---|---|
| Primary/accent color | Indigo `#4f46e5` |
| Google login | Styled **placeholder** (shows "Google sign-in not configured yet"); email/password fully works |
| Scope | Public + auth pages fully themed; Studio/Admin adopt nav/buttons, keep layouts |
| Auth | Replace Amplify `Authenticator` with custom `/login`, `/register`, `/forgot` using Amplify Auth APIs |
| Backend | No schema/backend change |

## 3. Visual language (app-wide)

- **Light theme**: white background, `gray-50` section bands, near-black text
  (`#111827`), gray-500 secondary.
- **Primary** indigo `#4f46e5` (hover `#4338ca`) for buttons, links, active states.
- **Cards**: `rounded-xl border border-gray-200 bg-white shadow-sm`, hover lift.
- System sans font; Tailwind **typography (`prose`)** plugin retained for articles.

## 4. Top nav (light)

White, sticky, subtle bottom border. `max-w-6xl` container.
- Left: brand **MNMR AI Blogs** (links home). Inline links: Home; plus **Studio**
  (authors) and **Admin** (system admins) when authorized.
- Right (guests): a ghost **Sign In** link (→ `/login`) and a filled indigo
  **Get Started** button (→ `/register`).
- Right (signed in): account email (→ `/account`) and **Sign out**.
- Replaces the dark editorial bar everywhere. No search icon in the nav.

## 5. Home page

1. **Hero** — bold headline (e.g. "Hands-on insights on AI and engineering"),
   subhead ("Practical articles from people building real systems."), two CTAs:
   filled **Get Started** (→ `/register`) and ghost **Read the blog** (anchors to the
   articles section).
2. **Feature cards** — three `rounded-xl` cards in a row (icon + title + blurb),
   e.g. "Practical guides", "From practitioners", "Always current".
3. **Latest articles** — section heading + a small search input (local state +
   `filterPosts`) + a responsive **3-column grid** of `PostCard`s
   (cover image, category chip, title, excerpt, byline/date), newest first.
   Empty state when no posts / no matches.
4. **Footer** — minimal: copyright + tagline.

## 6. Post detail

Centered `max-w-3xl` article, indigo accents: category chip → headline → `PostMeta`
→ cover image → share buttons → `prose` markdown → comments. (Content/logic
unchanged from current; restyled.)

## 7. Auth (custom — the nmmr.tech/login look)

A shared **`AuthCard`** layout: centered card (`max-w-md`), brand, heading,
subcopy, form, indigo primary button, error/notice area.

- **`/login`** — "Sign in to MNMR AI Blogs" / "Enter your credentials to access your
  account". Fields: email, password. Inline **Forgot password?** (→ `/forgot`).
  Indigo **Sign in** (`signIn`). **"Or continue with"** divider. **Continue with
  Google** button → shows "Google sign-in not configured yet." Footer: "Don't have
  an account? **Register**" (→ `/register`). On success → `/account`. If
  `signIn` reports the account is unconfirmed, show the confirmation-code step.
- **`/register`** — name (optional), email, password. `signUp` → emailed code step
  (`confirmSignUp`) → then `signIn` → `/account`. Footer link to `/login`.
- **`/forgot`** — email → `resetPassword` (sends code) → code + new password
  (`confirmResetPassword`) → `/login`.
- **`/auth`** — redirects to `/login` (existing links keep working). Nav and
  guards point to `/login`.

All via `aws-amplify/auth` v6 APIs: `signIn`, `signUp`, `confirmSignUp`,
`resetPassword`, `confirmResetPassword`. Username = email (pool uses email login).

## 8. Components & files

- **New:** `Nav` (rebuilt, light), `Hero`, `FeatureCards`, `PostCard`, `Footer`,
  `AuthCard`, pages `/login`, `/register`, `/forgot`; `/auth` becomes a redirect.
- **Retire (delete):** `ArticleCard`, `Sidebar`, `SearchContext` (the dark-theme
  pieces); remove `SearchProvider` from `layout.tsx`.
- **Reuse:** `CategoryChip`, `PostMeta`, `CoverImage`, `MarkdownView`,
  `ShareButtons`, `Comments`, `RequireRole`, `useCurrentUser`, `lib/format.ts`,
  `lib/posts.ts`.
- **Theme:** `tailwind.config.ts` add `primary` (#4f46e5) and `primaryDark`
  (#4338ca); keep typography plugin. `globals.css` light theme (already light).
- **Pure logic (TDD):** `src/lib/authErrors.ts` — `authErrorMessage(err): string`
  mapping common Cognito errors (`UserNotConfirmedException`,
  `NotAuthorizedException`, `UsernameExistsException`,
  `CodeMismatchException`, `UserNotFoundException`, etc.) to friendly text, with a
  generic fallback.

## 9. Testing

Vitest unit tests for `src/lib/authErrors.ts`. `npm run build` for compile checks.
Manual check in the dev server: home hero/cards/grid, post detail, and the
login/register/forgot flows (register a user end-to-end).

## 10. Out of scope

Real Google OAuth (placeholder only), schema/backend changes, dark mode,
pagination.
