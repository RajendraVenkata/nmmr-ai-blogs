# Cognito-Native Relay Auth — drop the shared HS256 secret

**Date:** 2026-06-05
**Status:** Approved (design)
**Repos:** `nmmr-terminal` (primary), `nmmr-ai-blogs`
**Builds on:** [2026-06-05-coder-terminals-design.md](2026-06-05-coder-terminals-design.md)
**Supersedes:** the "Option A" HS256 mint described there.

## Summary

Make the relay verify Cognito **ID tokens** (RS256) directly against the Cognito JWKS,
and have the browser present its own Cognito idToken instead of a blog-minted HS256
token. This removes the shared secret (`TERMINAL_JWT_SECRET` / relay `JWT_SECRET`) from
both repos, deletes the blog's token-mint route and helpers, and makes the relay
authoritative for the `Coder` group check. The blog is the relay's only consumer, so this
is a clean cutover (no dual-mode).

## Context

Today (Option A):

- The blog mints a 5-minute HS256 token in `POST /api/terminal-token`
  (`src/lib/terminalToken.ts` `authorizeTerminalRequest`/`authorizeManageRequest`) signed
  with `TERMINAL_JWT_SECRET`, payload `{ id, email, role }`, and checks the `Coder` group.
- The browser uses that token for the WebSocket terminal; management routes
  (`/api/containers`, `/api/containers/stop`) proxy server-to-server with a minted token
  (`src/lib/manageAuth.ts` `mintManageToken`, `src/lib/relayProxy.ts`).
- The relay verifies HS256 with the shared `JWT_SECRET` (`src/auth.ts` `validateToken`,
  `getBearerUser`) and extracts `{ id, email, role }`. The relay does **not** check `Coder`
  today — the blog does.

The Cognito pool for this app: `user_pool_id = us-east-1_iAxZ1rSuh`,
`user_pool_client_id = 2p80hgloji5a19gksi148r827j`, region `us-east-1`
(from `amplify_outputs.json`). The browser already holds the Cognito idToken client-side
(Amplify with `ssr: true`; `useCurrentUser` reads `fetchAuthSession`).

## Design

### 1. Relay — verify Cognito idTokens (`nmmr-terminal`)

- New dependency: `aws-jwt-verify` (Amazon's official verifier).
- New module `src/cognito-verify.ts`:
  - Creates a singleton `CognitoJwtVerifier.create({ userPoolId, tokenUse: 'id', clientId })`
    from `config.cognitoUserPoolId` / `config.cognitoClientId`.
  - Exports `async verifyToken(token: string): Promise<RelayUser>` that calls
    `verifier.verify(token)` and maps the claims via the pure helper below. Throws on an
    invalid/expired token (the verifier checks signature, `iss`, `aud`, `token_use`, `exp`).
- Pure, unit-tested helpers in `src/cognito-claims.ts`:
  - `userFromClaims(claims): RelayUser` where `RelayUser = { id: string; email: string; groups: string[] }`,
    mapping `sub → id`, `email → email`, `cognito:groups → groups` (defaulting `[]`).
  - `requireCoder(groups: string[]): boolean` = `groups.includes('Coder')`.
- `src/config.ts`: add `cognitoUserPoolId` (env `COGNITO_USER_POOL_ID`) and `cognitoClientId`
  (env `COGNITO_CLIENT_ID`); remove `jwtSecret`. `validateConfig()` fails fast (clear error,
  `process.exit(1)`) if either Cognito value is missing.
- `src/auth.ts`: replace `validateToken` (HS256) and `getBearerUser` with Cognito-based
  equivalents. `getBearerUser(req)` becomes `async` and returns `RelayUser | null` after
  `verifyToken`.
- Enforcement (relay is now authoritative for `Coder`):
  - **WebSocket connect** (`src/server.ts`): after `verifyToken`, reject with close code
    `4003` if `requireCoder(user.groups)` is false (in addition to the existing
    invalid-token rejection).
  - **Management endpoints** (`GET /api/containers`, `POST /api/containers/stop`): `401` if
    the token fails to verify, `403` if not a `Coder`.
- Remove `JWT_SECRET` from `config.ts` and document `COGNITO_USER_POOL_ID` /
  `COGNITO_CLIENT_ID` in `.env.example`.

### 2. Blog — stop minting, present the idToken (`nmmr-ai-blogs`)

- **WebSocket path:** `src/components/TerminalEmbed.tsx` obtains the idToken from
  `fetchAuthSession()` (`tokens?.idToken?.toString()`) and connects with
  `?token=<idToken>&labId=…` directly — no call to `/api/terminal-token`. If there is no
  idToken (signed out), it shows the existing "Coder access required" placeholder (the
  component already gates on `canUseContainers(user.groups)`).
- **Delete** `src/app/api/terminal-token/route.ts`, `src/lib/terminalToken.ts`, and
  `tests/terminalToken.test.ts`.
- **Management proxy:** replace `src/lib/manageAuth.ts` `mintManageToken` with
  `getManageAuth(request)` that reads the Cognito session server-side, returns
  `{ status: 403 }` if the user is not a `Coder` (cheap pre-check; relay stays
  authoritative), otherwise `{ status: 200, token: <session idToken> }`. The proxy routes
  (`src/app/api/containers/route.ts`, `…/stop/route.ts`) forward that idToken to the relay
  unchanged (`proxyToRelay` is unchanged).
- Remove `TERMINAL_JWT_SECRET` from `.env.local` and the README; the relay no longer shares
  a secret with the blog.

### 3. Data flow

A Coder opens a post → `TerminalEmbed` reads its Cognito idToken → connects
`wss://…?token=<idToken>&labId=python-basics` → the relay verifies the token against the
Cognito JWKS, checks `cognito:groups` contains `Coder`, and spawns the container. Management:
browser → blog proxy route (reads the session idToken, pre-checks `Coder`) → relay (verifies
+ re-checks `Coder`) → list/stop.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Invalid / expired idToken | Relay: WS close `4003`; management `401` |
| Authenticated but not a `Coder` | Relay: WS close `4003`; management `403`; blog UI shows the placeholder |
| Relay missing `COGNITO_*` config | `validateConfig()` exits at startup with a clear error |
| Cognito JWKS unreachable | `verifier.verify` throws → treated as an invalid token (rejected); `aws-jwt-verify` caches the JWKS after first fetch |

## Security notes / tradeoffs

- **Shared secret removed** from both repos — the primary goal.
- **Token lifetime widens** from the old 5-minute minted token to the Cognito idToken's
  ~1-hour lifetime, so a leaked token has a wider window. Accepted cost of dropping the
  secret; revocation is coarser (sign-out / token expiry). Documented.
- **No new client exposure:** the idToken is already in the browser; it travels to the relay
  over `wss` (TLS), exactly where the minted token used to.

## Testing

- **Relay (node:test):** `userFromClaims` maps `sub`/`email`/`cognito:groups` (and defaults
  groups to `[]` when absent); `requireCoder` is true only when `Coder` is present. The live
  `verifier.verify` call is integration — covered by the manual e2e, not unit-tested.
- **Blog (vitest):** removing `terminalToken.ts`/its test keeps the suite green; the `Coder`
  pre-check reuses the already-tested `canUseContainers`. (Net: the `authorizeTerminalRequest`
  /`authorizeManageRequest` suites are deleted with their module.)
- **Manual e2e:** as a Coder, launch a terminal (verify it connects and the relay log shows a
  verified Cognito sub); sign out / use a non-Coder and confirm the **relay** rejects the WS
  (close `4003`) — i.e. enforcement no longer depends on the blog; confirm "My containers"
  list/stop still works; grep both repos to confirm no `JWT_SECRET` / `TERMINAL_JWT_SECRET`
  remains.

## Out of scope (still deferred)

Access-token (vs id-token) verification, multi-pool support, dual-mode HS256 fallback (not
needed — the blog is the only consumer), email notifications, the admin all-containers view,
and per-container disk quotas.
