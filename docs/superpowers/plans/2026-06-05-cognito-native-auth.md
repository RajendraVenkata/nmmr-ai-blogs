# Cognito-Native Relay Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the relay verify Cognito ID tokens (RS256, via JWKS) and have the browser present its own idToken, removing the shared HS256 secret from both repos and making the relay authoritative for the `Coder` check.

**Architecture:** The relay uses `aws-jwt-verify` to verify Cognito idTokens against the user pool, reads `cognito:groups`, and enforces `Coder` on both the WebSocket connect and the management endpoints. The blog stops minting tokens: `TerminalEmbed` connects with the session idToken directly, and the management proxy forwards the session idToken. `TERMINAL_JWT_SECRET` / relay `JWT_SECRET` and the `/api/terminal-token` route are deleted.

**Tech Stack:** Node/TypeScript relay (`nmmr-terminal`), `aws-jwt-verify`, Node `node:test`; Next.js blog (`nmmr-ai-blogs`), Amplify Auth, vitest.

**Branch:** `cognito-native-auth` (already created; spec committed there).

**Repos:** `nmmr-terminal` (sibling at `../nmmr-terminal`; Tasks 1–4) and `nmmr-ai-blogs` (this repo; Tasks 5–7).

---

## File Structure

**`nmmr-terminal`:**
- `src/cognito-claims.ts` (create) — pure `userFromClaims`, `requireCoder`, `RelayUser` type.
- `src/cognito-claims.test.ts` (create) — node:test.
- `src/cognito-verify.ts` (create) — the `aws-jwt-verify` verifier + `verifyToken`.
- `src/config.ts` (modify) — add Cognito ids; remove `jwtSecret`; update `validateConfig`.
- `src/auth.ts` (modify) — replace HS256 logic with async Cognito `getBearerUser`.
- `src/server.ts` (modify) — verify + enforce `Coder` on WS and management endpoints.
- `package.json` (modify) — add `aws-jwt-verify`; add the new test file to the `test` script.
- `.env.example` (modify) — drop `JWT_SECRET`; add `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID`.

**`nmmr-ai-blogs`:**
- `src/components/TerminalEmbed.tsx` (modify) — connect with the session idToken.
- `src/app/api/terminal-token/route.ts` (delete), `src/lib/terminalToken.ts` (delete), `tests/terminalToken.test.ts` (delete).
- `src/lib/manageAuth.ts` (modify) — `getManageAuth` returns the session idToken.
- `src/app/api/containers/route.ts`, `src/app/api/containers/stop/route.ts` (modify) — use `getManageAuth`.
- `README.md` (modify) — drop the shared-secret note.

---

## Task 1: Relay — add `aws-jwt-verify` (`nmmr-terminal`)

All paths under `../nmmr-terminal`.

**Files:** Modify `package.json`, `package-lock.json`.

- [ ] **Step 1: Install the dependency**

```bash
npm install aws-jwt-verify
```

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require('aws-jwt-verify')"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add aws-jwt-verify for Cognito token verification"
```

---

## Task 2: Relay — pure claim helpers

All paths under `../nmmr-terminal`. TDD.

**Files:** Create `src/cognito-claims.ts`, `src/cognito-claims.test.ts`. Modify `package.json`.

- [ ] **Step 1: Add the test file to the `test` script** — change the `test` script to:

```json
    "test": "node --test -r ts-node/register src/lab-allowlist.test.ts src/container-query.test.ts src/network-mode.test.ts src/cognito-claims.test.ts",
```

- [ ] **Step 2: Write the failing test** — create `src/cognito-claims.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userFromClaims, requireCoder } from './cognito-claims';

test('userFromClaims maps sub, email, and groups', () => {
  assert.deepEqual(
    userFromClaims({ sub: 'u1', email: 'a@b.com', 'cognito:groups': ['Coder'] }),
    { id: 'u1', email: 'a@b.com', groups: ['Coder'] },
  );
});

test('userFromClaims defaults groups to [] and email to ""', () => {
  const u = userFromClaims({ sub: 'u1' });
  assert.deepEqual(u.groups, []);
  assert.equal(u.email, '');
});

test('requireCoder is true only when Coder is present', () => {
  assert.equal(requireCoder(['Coder']), true);
  assert.equal(requireCoder(['ContentWriter']), false);
  assert.equal(requireCoder([]), false);
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./cognito-claims`.

- [ ] **Step 4: Implement** — create `src/cognito-claims.ts`:

```typescript
export interface RelayUser {
  id: string;
  email: string;
  groups: string[];
}

/** Map verified Cognito ID-token claims to the relay's user shape. */
export function userFromClaims(claims: Record<string, unknown>): RelayUser {
  return {
    id: (claims.sub as string) || "",
    email: (claims.email as string) || "",
    groups: (claims["cognito:groups"] as string[]) || [],
  };
}

export function requireCoder(groups: string[]): boolean {
  return groups.includes("Coder");
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `npm test`
Expected: PASS (all relay tests including the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/cognito-claims.ts src/cognito-claims.test.ts package.json
git commit -m "feat: add pure Cognito claim helpers"
```

---

## Task 3: Relay — config + verifier

All paths under `../nmmr-terminal`. No unit test (JWKS verifier is integration); verify by build.

**Files:** Modify `src/config.ts`. Create `src/cognito-verify.ts`.

- [ ] **Step 1: Update `src/config.ts`** — remove the `jwtSecret` line:

```typescript
  // JWT — must match AUTH_SECRET from nmmr-training
  jwtSecret: process.env.JWT_SECRET || "",
```

and add (e.g. after the `port` line) the Cognito identifiers:

```typescript
  // Cognito — the relay verifies ID tokens issued by this user pool
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || "",
  cognitoClientId: process.env.COGNITO_CLIENT_ID || "",
```

Then replace the body of `validateConfig()` so it requires the Cognito config instead of the secret:

```typescript
export function validateConfig(): void {
  if (!config.cognitoUserPoolId || !config.cognitoClientId) {
    console.error("FATAL: COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID environment variables are required");
    process.exit(1);
  }
}
```

- [ ] **Step 2: Create `src/cognito-verify.ts`**

```typescript
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { config } from "./config";
import { userFromClaims, type RelayUser } from "./cognito-claims";

const verifier = CognitoJwtVerifier.create({
  userPoolId: config.cognitoUserPoolId,
  tokenUse: "id",
  clientId: config.cognitoClientId,
});

/** Verify a Cognito ID token (signature, iss, aud, token_use, exp) and map its claims. */
export async function verifyToken(token: string): Promise<RelayUser> {
  const claims = await verifier.verify(token);
  return userFromClaims(claims as unknown as Record<string, unknown>);
}

export type { RelayUser };
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `tsc` succeeds. (If `CognitoJwtVerifier.create` complains about types, ensure `aws-jwt-verify` is installed from Task 1.)

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/cognito-verify.ts
git commit -m "feat: add Cognito verifier and config; drop jwtSecret"
```

---

## Task 4: Relay — wire verification + Coder enforcement (`auth.ts`, `server.ts`, `.env.example`)

All paths under `../nmmr-terminal`. No unit test (HTTP/WS wiring); verify by build + `npm test`.

**Files:** Modify `src/auth.ts`, `src/server.ts`, `.env.example`.

- [ ] **Step 1: Replace `src/auth.ts` entirely** with the Cognito-based bearer helper (the HS256 `validateToken` / `UserPayload` are gone):

```typescript
import type { IncomingMessage } from "http";
import { verifyToken } from "./cognito-verify";
import type { RelayUser } from "./cognito-claims";

/** Extract and verify the user from an `Authorization: Bearer <token>` header. */
export async function getBearerUser(req: IncomingMessage): Promise<RelayUser | null> {
  const raw = req.headers["authorization"];
  const header = Array.isArray(raw) ? raw[0] : raw || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return null;
  try {
    return await verifyToken(match[1]);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Fix `src/server.ts` imports** — the file currently imports `{ validateToken, getBearerUser }` from `"./auth"`. Change that import to:

```typescript
import { getBearerUser } from "./auth";
import { verifyToken } from "./cognito-verify";
import { requireCoder } from "./cognito-claims";
```

- [ ] **Step 3: Update the WebSocket auth block** — in the `wss.on("connection", ...)` handler, the current block is:

```typescript
  // Authenticate user
  let user;
  try {
    user = validateToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    ws.send(JSON.stringify({ type: "error", message }));
    ws.close(4003, "Auth failed");
    return;
  }
```

Replace it with (verify Cognito token, then enforce `Coder`):

```typescript
  // Authenticate user (Cognito ID token) and require the Coder group
  let user;
  try {
    user = await verifyToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    ws.send(JSON.stringify({ type: "error", message }));
    ws.close(4003, "Auth failed");
    return;
  }
  if (!requireCoder(user.groups)) {
    ws.send(JSON.stringify({ type: "error", message: "Coder access required" }));
    ws.close(4003, "Not a coder");
    return;
  }
```

- [ ] **Step 4: Update the `GET /api/containers` auth** — the current block is:

```typescript
  if (req.url === "/api/containers" && req.method === "GET") {
    const user = getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
```

Replace the `const user = getBearerUser(req);` line and the `if (!user)` block with:

```typescript
  if (req.url === "/api/containers" && req.method === "GET") {
    const user = await getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (!requireCoder(user.groups)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Coder access required" }));
      return;
    }
```

- [ ] **Step 5: Update the `POST /api/containers/stop` auth** — that handler also begins with:

```typescript
    const user = getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
```

Replace it with:

```typescript
    const user = await getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (!requireCoder(user.groups)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Coder access required" }));
      return;
    }
```

- [ ] **Step 6: Update `.env.example`** — remove the `JWT_SECRET=...` line (and the coder-terminals comment above it added earlier), and add:

```bash
# Cognito user pool the relay verifies ID tokens against (from nmmr-ai-blogs amplify_outputs.json)
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 7: Build and test**

Run: `npm run build && npm test`
Expected: `tsc` succeeds; all node:test suites pass. (No `validateToken`/`JWT_SECRET` references remain — `grep -rn "validateToken\|jwtSecret\|JWT_SECRET" src/` should return nothing.)

- [ ] **Step 8: Commit**

```bash
git add src/auth.ts src/server.ts .env.example
git commit -m "feat: verify Cognito ID tokens and enforce Coder on the relay"
```

---

## Task 5: Blog — management proxy forwards the session idToken

All paths in this repo (`nmmr-ai-blogs`). Done first so `manageAuth.ts` no longer imports `terminalToken.ts` before Task 6 deletes it — each task ends with a green build.

**Files:** Modify `src/lib/manageAuth.ts`, `src/app/api/containers/route.ts`, `src/app/api/containers/stop/route.ts`.

- [ ] **Step 1: Replace `src/lib/manageAuth.ts`** with a session-idToken reader (no minting):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { canUseContainers } from '@/lib/roles';

export interface ManageAuth {
  status: number;
  token?: string;
  error?: string;
}

/** Read the Cognito session and return its ID token (with a cheap Coder pre-check). */
export async function getManageAuth(request: NextRequest): Promise<ManageAuth> {
  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const idToken = session?.tokens?.idToken;
  if (!idToken) return { status: 401, error: 'Unauthenticated' };

  const groups = (idToken.payload?.['cognito:groups'] as string[] | undefined) ?? [];
  if (!canUseContainers(groups)) return { status: 403, error: 'Coder access required' };

  return { status: 200, token: idToken.toString() };
}
```

- [ ] **Step 2: Update `src/app/api/containers/route.ts`** — replace its body with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getManageAuth } from '@/lib/manageAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function GET(request: NextRequest) {
  const auth = await getManageAuth(request);
  if (auth.status !== 200 || !auth.token) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/containers', { method: 'GET', token: auth.token });
  return NextResponse.json(relay.body, { status: relay.status });
}
```

- [ ] **Step 3: Update `src/app/api/containers/stop/route.ts`** — replace its body with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getManageAuth } from '@/lib/manageAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const containerId: string | undefined = body?.containerId;

  const auth = await getManageAuth(request);
  if (auth.status !== 200 || !auth.token) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/containers/stop', {
    method: 'POST',
    token: auth.token,
    body: { containerId },
  });
  return NextResponse.json(relay.body, { status: relay.status });
}
```

- [ ] **Step 4: Build and test**

Run: `npm run build && npx vitest run`
Expected: build succeeds; both `/api/containers*` routes are dynamic; vitest fully green. `grep -rn "terminalToken\|mintManageToken\|TERMINAL_JWT_SECRET" src/` should return nothing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manageAuth.ts src/app/api/containers/route.ts src/app/api/containers/stop/route.ts
git commit -m "feat: forward the session idToken from the management proxy"
```

---

## Task 6: Blog — connect with the session idToken; delete the mint route

All paths in this repo (`nmmr-ai-blogs`). Run after Task 5, so nothing imports `terminalToken.ts` when it is deleted.

**Files:** Modify `src/components/TerminalEmbed.tsx`. Delete `src/app/api/terminal-token/route.ts`, `src/lib/terminalToken.ts`, `tests/terminalToken.test.ts`.

- [ ] **Step 1: Update `TerminalEmbed.tsx` `launch()`** — replace the opening of `launch()` (from `setMessage('Requesting access…');` through `const { token } = await res.json();`) with a direct read of the Cognito idToken. The current code is:

```tsx
    setStatus('connecting');
    setMessage('Requesting access…');
    try {
      const res = await fetch('/api/terminal-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed' }));
        setStatus('error');
        setMessage(error ?? `Request failed (${res.status})`);
        return;
      }
      const { token } = await res.json();
```

Replace it with:

```tsx
    setStatus('connecting');
    setMessage('Connecting…');
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) {
        setStatus('error');
        setMessage('Please sign in to launch a terminal.');
        return;
      }
```

(The rest of `launch()` — xterm setup and the `new WebSocket(`${base}?token=${encodeURIComponent(token)}…`)` line — is unchanged; it already uses `token`.)

- [ ] **Step 2: Delete the mint route and helper**

```bash
git rm src/app/api/terminal-token/route.ts src/lib/terminalToken.ts tests/terminalToken.test.ts
```

- [ ] **Step 3: Build and test**

Run: `npm run build && npx vitest run`
Expected: build succeeds (the `/api/terminal-token` route is gone and nothing imports `@/lib/terminalToken` — Task 5 already removed `manageAuth.ts`'s import); vitest is green (the `terminalToken` suite is removed).

- [ ] **Step 4: Commit**

```bash
git add src/components/TerminalEmbed.tsx
git commit -m "feat: connect terminals with the Cognito idToken; remove the mint route"
```

---

## Task 7: Cleanup, docs, verification

**Files:** Modify `.env.local` (this repo, not committed), `README.md`.

- [ ] **Step 1: Remove the stale blog secret** — edit `.env.local` (gitignored) and delete the `TERMINAL_JWT_SECRET=...` line. Keep `NEXT_PUBLIC_TERMINAL_WS_URL` and `TERMINAL_HTTP_URL`.

- [ ] **Step 2: Update the blog README** — in the "Coder terminals" section of `README.md`, replace the sentence that mentions the minted token / `TERMINAL_JWT_SECRET` with:

```markdown
The browser connects to the relay (`NEXT_PUBLIC_TERMINAL_WS_URL`) with its Cognito ID
token; the relay verifies it against the Cognito user pool and enforces the `Coder` group
itself. There is no shared secret — the relay is configured with the pool's
`COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID`.
```

(If the section still references `TERMINAL_JWT_SECRET` elsewhere, remove those mentions.)

- [ ] **Step 3: Commit docs**

```bash
git add README.md
git commit -m "docs: describe Cognito-native relay auth (no shared secret)"
```

- [ ] **Step 4: Full automated verification**

```bash
# Blog (this repo)
npx vitest run        # green
npm run build         # succeeds; no /api/terminal-token route
grep -rn "TERMINAL_JWT_SECRET\|terminalToken\|mintManageToken" src/   # no matches
# Relay
cd ../nmmr-terminal && npm test && npm run build && grep -rn "JWT_SECRET\|validateToken\|jwtSecret" src/ && cd -
# (the relay grep should return NOTHING)
```

- [ ] **Step 5: Manual end-to-end (Docker + relay running)**

1. Start the relay with `COGNITO_USER_POOL_ID=us-east-1_iAxZ1rSuh` and
   `COGNITO_CLIENT_ID=2p80hgloji5a19gksi148r827j` (no `JWT_SECRET`). Confirm it starts
   (`validateConfig` passes). Start the blog (sandbox + `npm run dev`).
2. As a Coder, open a post with a ` ```terminal ` fence and **Launch** — confirm it connects
   and the relay log shows a verified Cognito `sub`.
3. **Relay-authoritative check:** in the browser devtools, take the WS URL and try connecting
   as a non-Coder (or with a tampered/expired token) — confirm the relay closes it with
   `4003` (enforcement no longer depends on the blog).
4. On `/account`, confirm "My containers" list + **Stop** still work.

---

## Self-review notes

- **Spec coverage:** `aws-jwt-verify` dep (Task 1); pure `userFromClaims`/`requireCoder` + tests (Task 2); config + verifier, drop `jwtSecret` (Task 3); async `getBearerUser`, WS + management `Coder` enforcement, `.env.example` (Task 4); management proxy forwards the session idToken (Task 5); browser presents idToken + delete mint route/helper/test (Task 6); remove `TERMINAL_JWT_SECRET`, README, full verification incl. grep checks, and the relay-authoritative manual test (Task 7). All spec sections map to a task.
- **Type consistency:** `RelayUser = { id, email, groups }` defined in `cognito-claims.ts` (Task 2), returned by `verifyToken` (Task 3) and `getBearerUser` (Task 4), consumed via `requireCoder(user.groups)` in `server.ts` (Task 4). `getManageAuth(request): { status, token?, error? }` defined in Task 6 and consumed by both routes with `auth.token`/`auth.status`/`auth.error`.
- **Deferred (not in this plan, per spec):** access-token verification, multi-pool support, dual-mode HS256 fallback, email notifications, admin all-containers view, disk quotas.
```
