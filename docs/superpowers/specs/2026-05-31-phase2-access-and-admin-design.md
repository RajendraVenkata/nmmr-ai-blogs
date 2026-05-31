# MNNR AI Blogs — Phase 2 Design / Spec

**Date:** 2026-05-31
**Status:** Approved design — pre-implementation
**Builds on:** Phase 1 (`2026-05-31-blogging-platform-design.md`, shipped via PR #1)

## 1. Goal

Add the self-service access-request workflow and the full admin console deferred
from Phase 1: users request elevated roles, system admins approve/reject from a
queue and manage roles from a user table, and moderators view and restore
soft-deleted content. In-app only (no email).

## 2. Decisions (confirmed)

| Decision | Choice |
|---|---|
| Requestable roles | `ContentWriter` and `ContentAdmin` (never `SystemAdmin`) |
| Admin console scope | Request queue + user table + content moderation |
| Deleted content | Moderators can **view and restore** |
| Notifications | In-app only (status shown on `/account`); no email/SES |
| Role authority | Cognito groups remain source of truth; `UserProfile.role` is a display mirror |
| Restore target | Deleted post → `DRAFT`; deleted comment → `ACTIVE` |

## 3. Backend change (one redeploy)

Add an **`AccessRequest`** model to `amplify/data/resource.ts`:

- `userId` (string, required), `userEmail` (string), `requestedRole` enum
  [`CONTENT_WRITER`, `CONTENT_ADMIN`], `reason` (string), `status` enum
  [`PENDING`, `APPROVED`, `REJECTED`], `decidedBy` (string), `decidedAt`
  (datetime). (`createdAt` is provided automatically by Amplify.)
- **Authorization:**
  - `allow.owner().to(['create', 'read'])` — a user creates and reads their own requests.
  - `allow.groups(['SystemAdmin']).to(['read', 'update'])` — system admins read all and decide.
  - **No `delete`** granted (consistent with the never-hard-delete rule).

No other model changes. `setUserRole` and `UserProfile` are unchanged structurally;
Phase 2 begins populating and reading `UserProfile`.

## 4. UserProfile population (no new Lambda)

`UserProfile` already permits `allow.owner().to(['read','create','update'])` and
`allow.groups(['SystemAdmin']).to(['read','update'])`.

- On first authenticated load, the client **upserts the current user's
  `UserProfile`** (`id` = Cognito sub, `email`, `role` = role derived from groups,
  `status` = `ACTIVE`). Implemented as an `ensureProfile()` step in the
  current-user hook: `get({id})`; if absent, `create`; if the mirrored role drifts
  from the group-derived role, `update`.
- When a SystemAdmin changes a user's role (queue approval or user table), the
  admin client updates that user's `UserProfile.role` mirror alongside calling the
  `setUserRole` mutation.
- **Authorization remains Cognito-group based** (enforced at AppSync). The mirror
  is for display/enumeration only — the admin user table reads `UserProfile.list()`
  (SystemAdmin can read all).

## 5. Self-service access requests — `/account`

Extend the existing account page:

- **Request access form** — visible to users whose current role is below
  `ContentAdmin`. Offers only roles above the current one
  (`requestableRoles(currentRole)`): a Reader can request `ContentWriter` or
  `ContentAdmin`; a ContentWriter can request `ContentAdmin`; a ContentAdmin or
  SystemAdmin sees no form. Submitting creates an `AccessRequest` with
  `status=PENDING`, `userId`, `userEmail`, `requestedRole`, `reason`.
- **My requests list** — the user's own `AccessRequest` records with status
  (Pending / Approved / Rejected) and requested role. A pending request for a given
  role disables re-requesting that role.

## 6. Admin console

Replaces the Phase 1 single-screen manual user-id box. A shared **AdminNav**
links the sub-routes. Access-request and user management require `SystemAdmin`;
moderation requires `ContentAdmin` or above.

- **`/admin/requests`** (SystemAdmin) — queue of `PENDING` requests showing user,
  requested role, reason, date.
  - **Approve** → `setUserRole(userId, requestedRole)` mutation, then
    `AccessRequest.update({ status: APPROVED, decidedBy, decidedAt })`, then
    `UserProfile.update({ id: userId, role: requestedRole })` (mirror).
  - **Reject** → `AccessRequest.update({ status: REJECTED, decidedBy, decidedAt })`.
- **`/admin/users`** (SystemAdmin) — table of all users from `UserProfile.list()`:
  email, current role, and a role dropdown. Changing the role calls
  `setUserRole(userId, role)` then updates the `UserProfile.role` mirror. This
  replaces the Phase 1 manual user-id entry box.
- **`/admin/moderation`** (ContentAdmin+) — two sections listing **soft-deleted**
  posts and comments (`status === 'DELETED'`). Each row has **Restore**:
  - Post → `update({ id, status: 'DRAFT' })` (admin re-publishes deliberately).
  - Comment → `update({ id, status: 'ACTIVE' })`.

`/admin` redirects to / links the three sub-routes.

## 7. New / changed files

- `amplify/data/resource.ts` — add `AccessRequest` model (redeploy).
- `src/lib/access.ts` (pure logic, TDD):
  - `canRequestRole(currentRole, target)` — target must be above current and not `SYSTEM_ADMIN`.
  - `requestableRoles(currentRole)` — roles a user may request.
  - `pendingRequests(list)` — filter `status === 'PENDING'`.
  - `deletedItems(list)` — filter `status === 'DELETED'`.
  - `restoreStatusForPost()` → `'DRAFT'`, `restoreStatusForComment()` → `'ACTIVE'`.
- `src/lib/useCurrentUser.ts` — add `ensureProfile()` upsert on load.
- Components: `AccessRequestForm`, `MyRequests`, `AdminNav`, `RequestQueue`,
  `UserTable`, `ModerationList`.
- Pages: extend `src/app/account/page.tsx`; replace `src/app/admin/page.tsx`
  (becomes console landing/redirect); add `src/app/admin/requests/page.tsx`,
  `src/app/admin/users/page.tsx`, `src/app/admin/moderation/page.tsx`.

## 8. Authorization summary

- Create/read own `AccessRequest`: any authenticated user (owner).
- Read all / decide `AccessRequest`: `SystemAdmin` only.
- List `UserProfile` / change roles: `SystemAdmin` only.
- View/restore deleted content: `ContentAdmin` or `SystemAdmin` (UI-gated;
  AppSync already grants these groups `update` on Post/Comment).

## 9. Testing

Vitest unit tests for `src/lib/access.ts` (requestable-role matrix, status
filters, restore-target mapping). `npm run build` for compile verification.
Manual sandbox round-trip: a Reader requests ContentWriter → SystemAdmin approves
in the queue → the Reader (after re-login) gains Studio access; restore a
soft-deleted post from moderation.

## 10. Out of scope (later phases)

Email notifications (Amazon SES), SSR + OpenGraph meta for share previews.
