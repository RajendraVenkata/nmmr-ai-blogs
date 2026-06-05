# My Containers View — let a Coder see and stop their running container

**Date:** 2026-06-05
**Status:** Approved (design)
**Repos:** `nmmr-ai-blogs` (primary), `nmmr-terminal` (relay)
**Builds on:** [2026-06-05-coder-terminals-design.md](2026-06-05-coder-terminals-design.md)

## Summary

Give a `Coder` a "My containers" section on `/account` that lists their running lab
container(s) — lab name and when it started — with a **Stop** button. The browser talks
only to the blog; the blog proxies, server-to-server, to new authenticated HTTP
endpoints on the relay. Since the relay enforces one container per user, this is usually
a single row or an empty state, but the design handles a list.

## Context

The relay (`nmmr-terminal`) already tracks containers but exposes no management API:

- `src/container-manager.ts` has `findManagedContainers()` (queries Docker for label
  `nmmr.managed=true`; each result carries labels `nmmr.userId` / `nmmr.labId`, an `.Id`,
  a `.Created` unix-seconds timestamp, and a `.State`), plus `destroyContainer(id)` and
  `getContainerInfo(userId, labId)`.
- `src/session-store.ts` tracks in-memory sessions keyed by `userId:labId`.
- `src/server.ts` serves only `GET /health` (global, unauthenticated), `POST /api/ollama`,
  and the WebSocket upgrade. Auth elsewhere uses `validateToken` (`src/auth.ts`) on an
  HS256 JWT whose payload is `{ id, email, role }`.

The blog already mints such a token server-side: `POST /api/terminal-token` checks the
Cognito session + `Coder` group and signs a 5-minute token with `TERMINAL_JWT_SECRET`
(pure decision in `src/lib/terminalToken.ts`). The terminal WebSocket runs browser →
relay directly; but simple REST management is cleaner proxied through the blog.

**Chosen topology:** browser → blog (server-to-server) → relay. No CORS, and the relay
token never reaches client JavaScript — the same trust model as `/api/terminal-token`.

## Design

### 1. Relay — authenticated container endpoints (`nmmr-terminal`)

Two endpoints in `src/server.ts`, each requiring `Authorization: Bearer <token>`
(validated with the existing `validateToken`). No CORS headers are needed because the
caller is the blog's server, not a browser.

- `GET /api/containers` — list the caller's containers. Source of truth is
  `findManagedContainers()` filtered to `nmmr.userId === token.id`. Returns
  `{ containers: [{ containerId, labId, createdAt, running }] }` where `createdAt` is the
  Docker `.Created` value (unix seconds) and `running` is `.State === 'running'`.
- `POST /api/containers/stop` with body `{ containerId }` — verify the container's
  `nmmr.userId` label matches `token.id`; if so `destroyContainer(containerId)` and remove
  any matching session, return `{ stopped: true }`. If the container is not owned by the
  caller (or not found), return `403` with `{ error: 'Not found' }`.

New pure, unit-tested helpers in `src/container-query.ts`:

- `mapUserContainers(managed, userId)` — filters the `findManagedContainers()` result to
  the user and maps each to `{ containerId, labId, createdAt, running }`.
- `userOwnsContainer(managed, userId, containerId)` — true iff a managed container with
  that id has `nmmr.userId === userId`.

`server.ts` wires these with the live Docker list; the helpers take a minimal shape
(`{ Id, Labels, Created, State }`) so they can be tested without Docker.

A shared `getBearerUser(req)` reads the `Authorization: Bearer <token>` header and runs
`validateToken`, returning the user or `null` (→ `401`).

### 2. Blog — management-token mint + proxy routes

- `src/lib/terminalToken.ts` gains `authorizeManageRequest({ sub, email, groups, secret })`
  — a sibling of `authorizeTerminalRequest` without the lab check: `401` (no sub), `403`
  (not Coder), `500` (no secret), else `200` with a freshly minted 5-minute token. Both
  functions share a private mint of `{ id, email, role }` so signing stays DRY.
- `src/lib/relayProxy.ts` — a small server-side helper
  `proxyToRelay(path, { method, token, body? })` that `fetch`es
  `${process.env.TERMINAL_HTTP_URL}${path}` with the bearer token and returns
  `{ status, body }`, translating a fetch failure into a `502`.
- Two App Router handlers, each reading the Cognito session via the existing
  `runWithAmplifyServerContext` + `fetchAuthSession`, calling `authorizeManageRequest`,
  and on `200` forwarding via `proxyToRelay`:
  - `src/app/api/containers/route.ts` — `GET` → relay `GET /api/containers`.
  - `src/app/api/containers/stop/route.ts` — `POST` (forwards `{ containerId }`) → relay
    `POST /api/containers/stop`.

New server-only env var `TERMINAL_HTTP_URL` (e.g. `https://terminal.nmmr.tech`; local
`http://localhost:8080`). It has no `NEXT_PUBLIC_` prefix and never reaches the client.

### 3. Blog — `MyContainers` UI

`src/components/MyContainers.tsx` (client component): if the user is not a Coder it
renders nothing. Otherwise, on mount it `GET`s `/api/containers` and renders a list — each
row shows the lab display name (via `TERMINAL_LABS` from `src/lib/terminalEmbed.ts`), a
relative "started …" label, and a **Stop** button that `POST`s `/api/containers/stop`
with the `containerId` and refreshes the list. Empty state: "No active containers." The
component is added to `src/app/account/page.tsx` for signed-in users.

## Data flow

`/account` → `MyContainers` → `GET /api/containers` (blog: Cognito + Coder check → mint
token → relay `GET /api/containers` filtered by user) → list rendered. **Stop** → `POST
/api/containers/stop` (blog → relay verifies ownership → `destroyContainer`) → list
refreshes.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Not signed in / not Coder | Blog routes return `401` / `403`; `MyContainers` renders nothing |
| Relay unreachable | `proxyToRelay` returns `502`; UI shows "Couldn't reach the lab service." |
| Stop of an unowned/missing container | Relay returns `403`; surfaced inline, list refreshes |
| No containers | Empty-state copy |

## Testing

- **Relay (`nmmr-terminal`, node:test):** `mapUserContainers` filters to the user and maps
  fields correctly (including `running` from `State`); `userOwnsContainer` is true only for
  a container the user owns and false for another user's id or an unknown id.
- **Blog (vitest):** `authorizeManageRequest` returns `401` without a subject, `403` for a
  non-Coder, `500` without a secret, and `200` with a token that decodes under the secret to
  the right claims with ~5-minute expiry.
- Route handlers and the component are verified by build plus the manual check below.
- **Manual:** as a Coder, launch a terminal in a post; on `/account` confirm the container
  is listed with its lab name; click **Stop** and confirm the row disappears and
  `docker ps` no longer shows `nmmr-<id>-<lab>`.

## Out of scope (still deferred)

An admin "all containers" view, container restart/logs, more than one container per user
(the relay limit stays 1), and the remaining Coder-terminals deferrals (networked
containers, Cognito-native relay auth, email notifications).
