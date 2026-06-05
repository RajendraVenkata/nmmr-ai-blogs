# Coder Terminals — embedding live Docker shells in blog posts

**Date:** 2026-06-05
**Status:** Approved (design) — thin vertical slice
**Repos touched:** `nmmr-ai-blogs` (primary), `nmmr-terminal` (relay)

## Summary

Let a holder of a new orthogonal `Coder` capability open a published blog post that
contains a ` ```terminal ` fenced block, click **Launch**, and get their own live
Docker shell (xterm.js) wired to the existing `nmmr-terminal` relay. This is a thin
vertical slice that proves the full pipe — capability → server-side auth bridge →
embedded terminal → relay → per-user container — end to end. Management UI, a
Coder-specific access-request flow, and Cognito-native relay auth are explicitly
deferred to later phases.

## Context

### `nmmr-terminal` (the relay) as it exists today

- WebSocket relay (Node, `localhost:8080`), fronted by Cloudflare Tunnel at
  `wss://terminal.nmmr.tech`.
- A browser connects with `wss://…?token=<JWT>&labId=<x>`; the relay validates the
  JWT, then spawns or re-attaches a per-user Docker container named
  `nmmr-<userId>-<labId>` (reused if already running) and pipes stdin/stdout over the
  socket.
- **Auth:** HS256 JWT signed with a shared secret (`JWT_SECRET`, equal to
  nmmr-training's `AUTH_SECRET`); payload `{ id, email, role }`. See
  `src/auth.ts`.
- **Images:** `nmmr-python-lab`, `nmmr-node-lab`, `nmmr-linux-lab` (see
  `src/lab-cache.ts` `DEFAULT_LABS`).
- **Limits:** 1 container per user, 20 total, 0.5 CPU / 256m, 30-min idle reaper,
  `networkEnabled: false` by default.
- It is the **backend only** — the xterm.js client lives in a different app
  (nmmr-training), so the blog must ship its own terminal UI.

### `nmmr-ai-blogs` as it exists today

- Next.js 14 + Amplify Gen 2. Auth is Cognito (groups `SystemAdmin`,
  `ContentAdmin`, `ContentWriter`; role enum `READER → CONTENT_WRITER →
  CONTENT_ADMIN → SYSTEM_ADMIN` in `src/lib/roles.ts`).
- Posts are markdown rendered through `react-markdown` + `rehype-sanitize`
  (`src/components/MarkdownView.tsx`).
- An access-request + admin console flow already exists (`/account`, `/admin/*`),
  including a Cognito-group-mutating Lambda at
  `amplify/functions/set-user-role/`.

## The core problem: auth mismatch

The relay trusts an **HS256** token signed with a shared secret; the blog issues
**Cognito (RS256)** tokens. The chosen bridge (Option A) is for the blog to mint a
short-lived HS256 token, server-side, from the authenticated Cognito session, signed
with the shared secret. This reuses the relay's existing contract with no protocol
change. (Cognito-native relay verification — Option B — is deferred.)

## Design

### 1. Coder capability — `nmmr-ai-blogs` backend

The `Coder` capability is **orthogonal** to the role ladder: any user, including a
`READER`, can hold it, and the `role` enum is unchanged.

- `amplify/auth/resource.ts`: add `'Coder'` to `groups`.
- `src/lib/roles.ts`: add `canUseContainers(groups: string[]): boolean` returning
  `groups.includes('Coder')`.
- `amplify/data/resource.ts`: add `isCoder: a.boolean()` to `UserProfile` (a mirror
  for the admin list; the Cognito group remains the authority).
- New SystemAdmin-only mutation `setCoderAccess(userId: string, enabled: boolean)`
  backed by a Lambda (sibling of `set-user-role`) that calls Cognito
  `AdminAddUserToGroup` / `AdminRemoveUserFromGroup` for the `Coder` group and
  upserts `UserProfile.isCoder`. Auth: `allow.groups(['SystemAdmin'])`.
- `/admin/users` (`src/components/UserTable.tsx`): add a per-user **Coder** toggle
  that calls `setCoderAccess`.

### 2. Auth bridge — terminal token mint (blog, server-side)

- New route handler `src/app/api/terminal-token/route.ts` (`POST`, runs
  server-side only):
  1. Read the Cognito session via the existing server context
     (`src/lib/amplifyServer.ts`). No session → **401**.
  2. Read `cognito:groups`; not in `Coder` → **403**.
  3. Validate the requested `labId` against the allowlist
     (`python-basics`, `node-basics`, `linux-basics`) → unknown → **400**.
  4. Mint an **HS256 JWT** `{ id: <sub>, email, role }` with `expiresIn: '5m'`,
     signed with `TERMINAL_JWT_SECRET`. Return `{ token }`.
- New dependency: `jsonwebtoken` (+ `@types/jsonwebtoken`).
- New secret: `TERMINAL_JWT_SECRET` — an Amplify secret that **must equal** the
  relay's `JWT_SECRET`. It is only ever read server-side and never sent to the
  client.

### 3. Terminal embed — blog frontend

- `src/components/MarkdownView.tsx`: override the `code` renderer. When the fenced
  language is `terminal`, parse the body (a simple `lab: <id>` line) and render
  `<TerminalEmbed lab={labId} />` instead of a `<code>` block. A normal fenced
  block still renders as code. No `Post` schema change; no `rehype-sanitize`
  conflict because the substitution happens in the React component map, not in raw
  HTML.
- `src/components/TerminalEmbed.tsx` (client component, dynamically imported with
  `ssr: false`):
  - Not signed in, or signed in without `Coder` → a placeholder card: "Coder
    access required to run this terminal" with a link to `/account`.
  - `Coder` → a **Launch terminal** button. On click: `POST /api/terminal-token`
    with the `labId`; on success open `wss://<NEXT_PUBLIC_TERMINAL_WS_URL>?token=
    …&labId=…` and attach an `@xterm/xterm` terminal (with `@xterm/addon-fit`).
    Pipe keystrokes → WS and WS data → terminal. Show status
    (connecting / connected / at-capacity / expired / error) and offer relaunch.
- New dependencies: `@xterm/xterm`, `@xterm/addon-fit`.
- New public env var: `NEXT_PUBLIC_TERMINAL_WS_URL` (e.g. `wss://terminal.nmmr.tech`,
  or `ws://localhost:8080` for local e2e).

### 4. Relay changes — `nmmr-terminal`

- `src/server.ts`: add a **labId allowlist** (the `DEFAULT_LABS` keys, or an env
  `ALLOWED_LABS`); reject unknown `labId` with a clear error frame before creating a
  container.
- Keep **1 container per user** (already the behavior — each user gets their own).
- `networkEnabled` stays `false`; package installs (`pip install`, `npm install`)
  will not work in the slice. Documented as a known limitation.
- Document that `JWT_SECRET` must match the blog's `TERMINAL_JWT_SECRET`.

## Data flow

1. An author publishes a post containing a ` ```terminal\nlab: python-basics\n``` `
   fence.
2. A `Coder` opens the post; `MarkdownView` renders the fence as `TerminalEmbed`.
3. The user clicks **Launch** → `POST /api/terminal-token` (server verifies `Coder`,
   validates `labId`, mints a 5-min HS256 token).
4. The browser opens `wss://terminal.nmmr.tech?token=…&labId=python-basics`.
5. The relay validates the token, checks the allowlist, spawns/attaches
   `nmmr-<sub>-python-basics`, streams to xterm.js.
6. After 30 min idle, the relay's reaper destroys the container.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Not signed in / not `Coder` | Placeholder card + link to `/account` |
| Token mint failure (5xx) | Inline error in the embed, retry button |
| Disallowed `labId` | 400 from the route / error frame from the relay, shown in the pane |
| Relay errors (missing token / at capacity / auth failed) | Message shown in the terminal pane, relaunch offered |
| Token expiry | Only matters at connect; live sessions persist |

## Testing

- **Blog (vitest):**
  - `canUseContainers` returns true only when `Coder` is present.
  - `/api/terminal-token`: 401 with no session, 403 when not `Coder`, 400 for a bad
    `labId`, 200 with a token that decodes under `TERMINAL_JWT_SECRET` to the right
    claims and ~5-min expiry (Amplify server context mocked).
  - `MarkdownView`: a `terminal` fence renders `TerminalEmbed`; a normal fence still
    renders a code block.
- **Relay (`nmmr-terminal`):** the allowlist guard rejects an unknown `labId`.
- **Manual e2e:** run the relay + Docker locally with the shared secret, run the blog
  sandbox, grant self `Coder`, open a post with a `terminal` fence, launch a python
  terminal, run `python hello.py`.

## Deployment & secrets

- **Blog:** add `TERMINAL_JWT_SECRET` (Amplify secret) and
  `NEXT_PUBLIC_TERMINAL_WS_URL`. After adding `jsonwebtoken` / `@xterm/*`,
  regenerate `package-lock.json` (`npm install --package-lock-only`) and verify with
  a real `npm ci` — Amplify Hosting runs `npm ci` and fails on lockfile drift.
- **Relay:** ensure `JWT_SECRET` matches the blog's `TERMINAL_JWT_SECRET`; set
  `ALLOWED_LABS` if used.

## Deferred (later phases)

- A Coder-specific access-request flow (slice: SystemAdmin grants directly).
- A "my containers" view to list/stop running containers.
- Cognito-native relay auth (Option B — verify the Cognito RS256 token against JWKS;
  drops the shared secret).
- Multiple simultaneous labs/containers per user, network-enabled labs, and package
  installs.
