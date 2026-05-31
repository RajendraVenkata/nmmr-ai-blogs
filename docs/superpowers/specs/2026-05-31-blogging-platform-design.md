# MNNR AI Blogs — Design / Spec

**Date:** 2026-05-31
**Status:** Approved design — pre-implementation
**Source idea:** `idea.txt`

## 1. Goal

A role-based blogging platform where designated writers author posts (primarily
Markdown, with embedded images/video), readers register to read and comment, and
system administrators control who gets elevated access. Content is stored in
DynamoDB and is **never hard-deleted** — deletions are soft (status flag).
Built on Next.js, deployed on AWS Amplify.

## 2. Tech stack & key decisions

| Decision | Choice | Notes |
|---|---|---|
| Backend | **AWS Amplify Gen 2** | Code-first TypeScript backend in `amplify/`; auth + data + storage deploy with the app. |
| Data layer | **Amplify Data (AppSync GraphQL)** | Auto-provisions DynamoDB tables with per-model, per-role auth rules. Data lives in DynamoDB. |
| Auth | **Amazon Cognito** | Email sign-up/sign-in. Cognito **groups** are the authorization mechanism. |
| Frontend | **Next.js 14 App Router**, TypeScript, Tailwind | Public pages SSR'd for SEO/sharing; authoring/admin pages client-gated by role. |
| Markdown render | `react-markdown` + `remark-gfm` + sanitized `rehype-raw` | Safe rendering of embedded images/video/iframes. |
| Markdown edit | Markdown editor with live preview + S3 upload button | Inserts uploaded media reference into the markdown. |
| Hosting | Amplify Hosting (deferred) | Build locally against Amplify sandbox first; wire real deploy as a follow-up. |
| Testing | Vitest unit tests for pure logic | Sandbox for manual end-to-end review. |

## 3. Architecture

```
Next.js (App Router)
  ├─ Public SSR pages: feed, post detail (share + comments)
  ├─ Authenticated client pages: /account, /studio, /admin
  └─ Amplify client (auth session, Data GraphQL, Storage uploads)
            │
   AWS Amplify Gen 2 backend (amplify/)
  ├─ auth      → Cognito user pool + groups: SystemAdmin, ContentAdmin, ContentWriter
  ├─ data      → AppSync GraphQL → DynamoDB tables (UserProfile, Post, Comment, AccessRequest)
  ├─ storage   → S3 bucket for images/video
  └─ functions
        ├─ set-user-role (Cognito Admin API; group membership changes)
        └─ bootstrap/post-confirmation (auto-promote seed-email list to SystemAdmin)
```

## 4. Roles

Authorization mechanism = **Cognito groups**. The `UserProfile` DynamoDB record
mirrors each user's role as the application-facing source of truth.

- **Reader** — any authenticated user (no group). Read published posts, comment.
- **ContentWriter** — create/edit **own** posts.
- **ContentAdmin** — create/edit/soft-delete **any** post; moderate comments.
- **SystemAdmin** — everything, **plus the only role that can grant roles**.

**System-admin bootstrap:** a configured seed-email allowlist auto-promotes those
users to `SystemAdmin` on sign-up (satisfies "system admins controlled outside the
normal grant flow, multiple allowed"). Their `UserProfile` records carry the role.

## 5. Data models (DynamoDB via Amplify Data)

**UserProfile**
- `id` (= Cognito sub), `email`, `displayName`
- `role` enum: `READER` | `CONTENT_WRITER` | `CONTENT_ADMIN` | `SYSTEM_ADMIN`
- `status` enum: `ACTIVE` | `DELETED`
- `createdAt`

**Post**
- `id`, `slug`, `title`, `bodyMarkdown`, `excerpt`, `coverImageKey`, `tags[]`
- `status` enum: `DRAFT` | `PUBLISHED` | `DELETED`
- `authorId`, `authorName`, `publishedAt`, `createdAt`, `updatedAt`

**Comment**
- `id`, `postId`, `authorId`, `authorName`, `body`
- `status` enum: `ACTIVE` | `DELETED`
- `createdAt`

**AccessRequest** *(Phase 2)*
- `id`, `userId`, `userEmail`, `requestedRole`, `reason`
- `status` enum: `PENDING` | `APPROVED` | `REJECTED`
- `decidedBy`, `decidedAt`, `createdAt`

## 6. Authorization rules & soft-delete

- **Posts:** guests read only `PUBLISHED`. Create/edit: `ContentWriter` (own),
  `ContentAdmin`/`SystemAdmin` (any).
- **Comments:** any authenticated user creates; author / `ContentAdmin` /
  `SystemAdmin` may soft-delete.
- **Role grants:** `SystemAdmin` only.
- **Never hard-delete:** the AppSync `delete` operation is granted to **no one**.
  "Delete" is an update that sets `status = DELETED` + `deletedAt`. All read
  queries filter out `DELETED`. This structurally enforces the no-delete rule.

## 7. Pages / routes

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Published-posts feed |
| `/posts/[slug]` | public | Post detail, comments, LinkedIn/X/Facebook share |
| `/auth` | public | Sign in / sign up (Amplify Authenticator) |
| `/account` | authed | Profile; (Phase 2) request access |
| `/studio` | writer+ | Authoring dashboard (list own/all posts) |
| `/studio/posts/new` | writer+ | Create post |
| `/studio/posts/[id]/edit` | writer+ | Edit post |
| `/admin` | SystemAdmin | Assign roles; (Phase 2) access-request queue |

## 8. Social sharing

Share buttons on post detail build share URLs from the post's public URL + title:
- LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=...`
- X: `https://twitter.com/intent/tweet?url=...&text=...`
- Facebook: `https://www.facebook.com/sharer/sharer.php?u=...`

## 9. Phasing

**Phase 1 (MVP — this build)**
- Cognito auth + groups + seed-email SystemAdmin bootstrap
- Markdown authoring with S3 image/video upload + embed
- Public feed + post detail
- Comments
- Soft-delete everywhere
- Social share (LinkedIn / X / Facebook)
- Minimal SystemAdmin role-assignment screen (so writers can be granted access)

**Phase 2 (next)**
- Self-service access-request workflow (`AccessRequest` model + `/account` request UI)
- Full admin console + comment/post moderation views

## 10. Testing

Vitest unit tests for pure logic:
- slug generation
- social share-URL builders
- markdown sanitization schema (allowed tags/attributes)
- role/permission helpers
- soft-delete query filters

Amplify sandbox for manual end-to-end verification.
