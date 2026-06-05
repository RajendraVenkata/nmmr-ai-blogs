# Coder Access Requests — self-serve requests for the Coder capability

**Date:** 2026-06-05
**Status:** Approved (design)
**Repo:** `nmmr-ai-blogs`
**Builds on:** [2026-06-05-coder-terminals-design.md](2026-06-05-coder-terminals-design.md)

## Summary

Let any signed-in user request the orthogonal `Coder` capability from `/account`, and
let a SystemAdmin approve or reject it from `/admin/requests` — reusing the existing
`AccessRequest` model, request form, "my requests" list, and admin queue. Approval
grants the `Coder` Cognito group via the existing `setCoderAccess` mutation. This
completes the self-serve governance UX for Coder access; until now Coder could only be
granted directly by a SystemAdmin toggling it in `/admin/users`.

## Context

The access-request infrastructure already exists and is role-centric:

- `AccessRequest` model (`amplify/data/resource.ts`): `requestedRole: a.enum(
  ['CONTENT_WRITER', 'CONTENT_ADMIN'])`, plus `userId`, `userEmail`, `reason`,
  `status` (`PENDING`/`APPROVED`/`REJECTED`), `decidedBy`, `decidedAt`. Auth: owner
  create/read, SystemAdmin read/update.
- `src/lib/access.ts`: `requestableRoles(currentRole)` returns roles strictly above
  the user's current role; `pendingRequests(items)` filters `status === 'PENDING'`.
- `src/components/AccessRequestForm.tsx`: a dropdown from `requestableRoles(user.role)`
  that creates an `AccessRequest`; blocks duplicate pending requests at submit time.
- `src/components/MyRequests.tsx`: lists the user's requests (shows `requestedRole`).
- `src/components/RequestQueue.tsx` (admin): lists pending requests; `approve()` calls
  `setUserRole({ userId, role: requestedRole })`, marks the request `APPROVED`, and
  best-effort mirrors `UserProfile.role`.

`Coder` is **not** a role in the `READER → … → SYSTEM_ADMIN` ladder; it is an
orthogonal Cognito group granted by the `setCoderAccess(userId, enabled)` mutation and
mirrored to `UserProfile.isCoder`. The design challenge is representing a Coder request
in a role-centric model. **Chosen approach (A):** add `'CODER'` as a value of the
existing `requestedRole` enum and branch the approval action on it. This is a
one-enum-value change with maximal reuse of the existing form, queue, list, and
dedupe logic.

## Working assumptions

- Any signed-in user can request Coder, including a `READER` (it is an orthogonal
  capability). A user who already holds `Coder` is not offered the option.
- Requests only **grant** Coder. Revocation stays admin-only via the existing
  `/admin/users` toggle.
- Email notifications remain out of scope (separately deferred).

## Design

### 1. Schema (backend)

`amplify/data/resource.ts`: extend exactly one enum on `AccessRequest`:

```typescript
requestedRole: a.enum(['CONTENT_WRITER', 'CONTENT_ADMIN', 'CODER']),
```

No other model field changes. Requires a backend redeploy (`npx ampx sandbox`) so the
generated `Schema` types accept `'CODER'`.

### 2. Eligibility + labels — `src/lib/access.ts` (pure, unit-tested)

Add three pure helpers:

- `requestOptions(currentRole: Role, isCoder: boolean): RequestOption[]` where
  `RequestOption = { value: string; label: string }`. Returns the existing
  higher-than-current roles (each `{ value: roleString, label: requestLabel(role) }`),
  **plus** `{ value: 'CODER', label: 'Coder access' }` appended when `isCoder` is
  false. This is the single source of truth for what the form offers.
- `requestLabel(value: string): string` — maps `'CODER'` → `'Coder access'`,
  `'CONTENT_WRITER'` → `'Content Writer'`, `'CONTENT_ADMIN'` → `'Content Admin'`, and
  falls back to the raw value otherwise. Used by the form, `MyRequests`, and the queue.
- `isCoderRequest(requestedRole: string | null | undefined): boolean` — returns
  `requestedRole === 'CODER'`. Drives the approval branch.

`requestableRoles` is retained (the new `requestOptions` builds on it).

### 3. Request form — `src/components/AccessRequestForm.tsx`

- Build the dropdown from `requestOptions(user.role, canUseContainers(user.groups))`
  (the component already receives `user`; `user.groups` exists). Render each option's
  `label`, submit its `value`.
- Local state holds the selected `value: string` (a role string or `'CODER'`).
- Submit is otherwise unchanged: it creates `AccessRequest` with
  `requestedRole: value` and `status: 'PENDING'`. The existing
  `pendingRoles.includes(value)` guard already dedupes `'CODER'` because `pendingRoles`
  is derived from `requestedRole` strings.
- The existing `if (options.length === 0) return null;` still applies (a user with the
  top role and already-Coder sees no form).

### 4. Approval branch — `src/components/RequestQueue.tsx`

In `approve(r)`:

- If `isCoderRequest(r.requestedRole)`:
  - `await client.mutations.setCoderAccess({ userId: r.userId, enabled: true })`
  - mark the `AccessRequest` `APPROVED` with `decidedBy` / `decidedAt` (as today)
  - best-effort `client.models.UserProfile.update({ id: r.userId, isCoder: true })`
- Else: the existing `setUserRole` + `UserProfile.role` path, unchanged.

`reject(r)` is unchanged. Both the queue and `MyRequests` display
`requestLabel(r.requestedRole)` instead of the raw value.

## Data flow

`/account` → the "Request access" dropdown includes **Coder access** (omitted once the
user is a Coder) → submit → `AccessRequest { requestedRole: 'CODER', status: 'PENDING' }`
→ SystemAdmin at `/admin/requests` → **Approve** → `setCoderAccess(enabled: true)` +
request `APPROVED` + `UserProfile.isCoder = true` → the user signs out and back in so the
`Coder` group is in their token → embedded terminals unlock.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Duplicate pending Coder request | Blocked at submit by the existing guard ("already have a pending request") |
| User already holds Coder | `requestOptions` omits the Coder option |
| `setCoderAccess` fails during approval | `busy` state clears (parity with the current queue); Cognito remains authoritative |

## Testing

- **Vitest (`tests/access.test.ts`)**, pure helpers only (node test env, matching the
  existing suite):
  - `requestOptions`: a `READER` who is not a Coder gets `CONTENT_WRITER`,
    `CONTENT_ADMIN`, and `Coder access`; a `READER` who is already a Coder gets the
    roles but **no** Coder option; a `CONTENT_ADMIN` who is not a Coder gets only the
    Coder option (no role is above `CONTENT_ADMIN` that is requestable).
  - `requestLabel`: `'CODER'` → `'Coder access'`; role values → friendly labels;
    unknown → passthrough.
  - `isCoderRequest`: true only for `'CODER'`.
- The approval branch is covered by the `isCoderRequest` unit plus manual verification.
  No component tests (consistent with the existing codebase).
- **Manual:** as a non-Coder, request Coder at `/account`; as a SystemAdmin, approve at
  `/admin/requests`; confirm the requester gains the `Coder` group (terminals unlock
  after re-login) and that `/admin/users` shows the Coder box ticked.

## Out of scope (still deferred)

Email notifications for decisions, revocation-via-request, auto-approval, and the
remaining Coder-terminals deferrals (a "my containers" view, Cognito-native relay
auth, networked containers).
