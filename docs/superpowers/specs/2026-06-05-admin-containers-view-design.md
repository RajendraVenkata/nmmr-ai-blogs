# Admin All-Containers View — see and stop any user's container

**Date:** 2026-06-05
**Status:** Approved (design)
**Repos:** `nmmr-terminal` (relay endpoints), `nmmr-ai-blogs` (proxy + admin page)
**Builds on:** [2026-06-05-my-containers-view-design.md](2026-06-05-my-containers-view-design.md), [2026-06-05-cognito-native-auth-design.md](2026-06-05-cognito-native-auth-design.md)

## Summary

Give a SystemAdmin an `/admin/containers` page that lists **every** running lab container
across all users — with the owner's email, lab, and start time — and a **Stop** button for
any of them. The relay gains an admin-scoped pair of endpoints (returning all containers /
stopping any), separate from the existing per-user endpoints, gated on the `SystemAdmin`
Cognito group. The browser talks only to the blog, which proxies server-to-server to the
relay (same pattern as "My containers").

## Context

- The relay already exposes per-user `GET /api/containers` (filtered to the caller via
  `mapUserContainers`) and `POST /api/containers/stop` (ownership-checked), both verifying a
  Cognito ID token and enforcing the `Coder` group (`requireCoder`). `findManagedContainers()`
  returns every managed container with `nmmr.userId` / `nmmr.labId` labels.
- The blog proxies those via `/api/containers` + `/api/containers/stop`
  (`src/lib/manageAuth.ts` `getManageAuth`, `src/lib/relayProxy.ts`), and renders
  `MyContainers` on `/account`.
- Admin pages follow a fixed pattern: `RequireRole allow={canGrantRoles}` (SystemAdmin) +
  `AdminNav` (`/admin/requests`, `/admin/users`, `/admin/moderation`). `roles.ts` exports
  `roleFromGroups`, `canGrantRoles` (SystemAdmin only). `UserProfile` (id = Cognito sub) holds
  `email` and is listable by SystemAdmins.

## Design

### 1. Relay — admin endpoints (`nmmr-terminal`)

Pure, unit-tested helpers alongside the existing ones:

- `requireAdmin(groups: string[]): boolean` (in `src/cognito-claims.ts`) = `groups.includes('SystemAdmin')`.
- `mapAllContainers(managed)` (in `src/container-query.ts`) — like `mapUserContainers` but with
  **no user filter** and an added `userId`:
  `{ containerId, userId, labId, createdAt, running }` (from `Id`, `nmmr.userId`, `nmmr.labId`,
  `Created`, `State`).

Endpoints in `src/server.ts` (each: verify the Cognito ID token via `getBearerUser`, then
require `SystemAdmin`):

- `GET /api/admin/containers` → `401` if unverified, `403` if not `SystemAdmin`, else
  `{ containers: mapAllContainers(findManagedContainers()) }`.
- `POST /api/admin/containers/stop` `{ containerId }` → `401`/`403` as above; `400` if no
  `containerId`; look the id up in `findManagedContainers()` — if absent, `404`
  (`{ error: 'Not found' }`); otherwise `destroyContainer(containerId)`, drop the matching
  session (`removeSession(owner.userId, owner.labId)`), return `{ stopped: true }`. No
  ownership check — an admin may stop any container.

### 2. Blog — admin proxy routes (`nmmr-ai-blogs`)

- `getAdminAuth(request)` (in `src/lib/adminAuth.ts`) — reads the Cognito session idToken;
  returns `{ status: 401 }` if unauthenticated, `{ status: 403 }` unless
  `canGrantRoles(roleFromGroups(groups))` (SystemAdmin), else `{ status: 200, token: idToken.toString() }`.
  Mirrors `getManageAuth` but checks SystemAdmin instead of Coder.
- `src/app/api/admin/containers/route.ts` (`GET`) → `getAdminAuth` → `proxyToRelay('/api/admin/containers', { method: 'GET', token })`.
- `src/app/api/admin/containers/stop/route.ts` (`POST`, forwards `{ containerId }`) →
  `getAdminAuth` → `proxyToRelay('/api/admin/containers/stop', …)`.

### 3. Blog — admin page (`nmmr-ai-blogs`)

- `src/components/AdminContainers.tsx` (client): on mount, `GET /api/admin/containers` and
  `client.models.UserProfile.list()`; builds a `userId → email` map; renders a table — owner
  email (falling back to `userId`), lab display name (`TERMINAL_LABS`), "started …"
  (`relativeTimeFromSeconds`), and a **Stop** button (`POST /api/admin/containers/stop` →
  refresh). Empty state "No active containers."; a "Couldn't reach the lab service." message on
  fetch failure (mirrors `MyContainers`).
- `src/app/admin/containers/page.tsx`: `RequireRole allow={canGrantRoles}` + `AdminNav` +
  `<AdminContainers />`, following the moderation/users page pattern.
- `src/components/AdminNav.tsx`: add a **Containers** link (`/admin/containers`).

## Data flow

SystemAdmin opens `/admin/containers` → `AdminContainers` calls `/api/admin/containers` (blog
verifies SystemAdmin, forwards the session idToken) → relay verifies the token + re-checks
`SystemAdmin` → returns all containers → blog maps `userId → email` from `UserProfile` and
renders. **Stop** → `/api/admin/containers/stop` → relay verifies admin → `destroyContainer`.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Non-admin | Page is behind `RequireRole` (never renders); blog routes `403`; relay independently `403`s a non-admin token |
| Not signed in | Blog routes `401` |
| Relay unreachable | `proxyToRelay` `502` → "Couldn't reach the lab service." |
| Stop of a non-managed id | Relay `404` (`Not found`), surfaced; list refreshes |
| No containers | Empty-state copy |

## Testing

- **Relay (node:test):** `requireAdmin` is true only for `SystemAdmin`; `mapAllContainers`
  returns every user's containers (no filter), includes `userId`, and maps `running` from
  `State`.
- **Blog (vitest):** the admin gate reuses the already-tested `roleFromGroups` / `canGrantRoles`.
  Routes and the component are build-verified.
- **Manual:** with two different users' containers running, as a SystemAdmin confirm
  `/admin/containers` lists both with the owners' emails; **Stop** one and confirm the correct
  container disappears (and `docker ps` no longer shows it); confirm a non-admin can reach
  neither the page nor `GET /api/admin/containers` (relay `403`).

## Out of scope (still deferred)

Bulk "stop all", container logs/`exec`, live auto-refresh, per-container disk quotas, email
notifications, and the `getLabConfig` hardening follow-up.
