# My Containers View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `Coder` list and stop their running lab container(s) from a section on `/account`, with the browser proxying through the blog to new authenticated relay endpoints.

**Architecture:** New authenticated `GET /api/containers` and `POST /api/containers/stop` endpoints on the relay (`nmmr-terminal`), backed by pure filter/ownership helpers. The blog adds server-side proxy routes that verify the Cognito session + `Coder` group, mint a short-lived token, and forward to the relay over a server-only `TERMINAL_HTTP_URL`. A client `MyContainers` component renders the list and Stop buttons. No CORS; the relay token never reaches the browser.

**Tech Stack:** Next.js 14 (App Router, client components), Amplify Gen 2 (Cognito), `jsonwebtoken`, vitest (blog), Node `node:test` + `ts-node` (relay).

**Branch:** `my-containers-view` (already created; spec committed there).

**Repos:** `nmmr-ai-blogs` (paths relative to its root) and `nmmr-terminal` (sibling at `../nmmr-terminal`; Tasks 1–2 only).

---

## File Structure

**`nmmr-terminal`:**
- `src/container-query.ts` (create) — pure helpers `mapUserContainers`, `userOwnsContainer`.
- `src/container-query.test.ts` (create) — node:test.
- `src/auth.ts` (modify) — add `getBearerUser(req)`.
- `src/server.ts` (modify) — wire the two endpoints.
- `package.json` (modify) — add the new test file to the `test` script.

**`nmmr-ai-blogs`:**
- `src/lib/terminalToken.ts` (modify) — add `authorizeManageRequest`; share a private mint.
- `src/lib/format.ts` (modify) — add `relativeTimeFromSeconds`.
- `src/lib/relayProxy.ts` (create) — `proxyToRelay(path, opts)` server-side fetch helper.
- `src/lib/manageAuth.ts` (create) — `mintManageToken(request)` (Cognito session → token).
- `src/app/api/containers/route.ts` (create) — `GET` proxy.
- `src/app/api/containers/stop/route.ts` (create) — `POST` proxy.
- `src/components/MyContainers.tsx` (create) — the UI.
- `src/app/account/page.tsx` (modify) — render `<MyContainers />`.
- Tests: `tests/terminalToken.test.ts`, `tests/format.test.ts` (modify).

---

## Task 1: Relay — pure container-query helpers (`nmmr-terminal`)

All paths in this task are under `../nmmr-terminal`.

**Files:**
- Create: `src/container-query.ts`, `src/container-query.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the new test file to the `test` script** — in `package.json`, change the `test` script to:

```json
    "test": "node --test -r ts-node/register src/lab-allowlist.test.ts src/container-query.test.ts",
```

- [ ] **Step 2: Write the failing test** — create `src/container-query.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapUserContainers, userOwnsContainer } from './container-query';

const managed = [
  { Id: 'c1', Labels: { 'nmmr.userId': 'u1', 'nmmr.labId': 'python-basics' }, Created: 1000, State: 'running' },
  { Id: 'c2', Labels: { 'nmmr.userId': 'u2', 'nmmr.labId': 'node-basics' }, Created: 2000, State: 'exited' },
];

test('mapUserContainers filters to the user and maps fields', () => {
  assert.deepEqual(mapUserContainers(managed, 'u1'), [
    { containerId: 'c1', labId: 'python-basics', createdAt: 1000, running: true },
  ]);
});

test('mapUserContainers returns [] when the user owns nothing', () => {
  assert.deepEqual(mapUserContainers(managed, 'nobody'), []);
});

test('userOwnsContainer is true only for the user\'s container', () => {
  assert.equal(userOwnsContainer(managed, 'u1', 'c1'), true);
  assert.equal(userOwnsContainer(managed, 'u1', 'c2'), false);
  assert.equal(userOwnsContainer(managed, 'u1', 'missing'), false);
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./container-query`.

- [ ] **Step 4: Implement** — create `src/container-query.ts`:

```typescript
export interface ManagedContainerInfo {
  Id: string;
  Labels: Record<string, string>;
  Created: number;
  State: string;
}

export interface UserContainer {
  containerId: string;
  labId: string;
  createdAt: number;
  running: boolean;
}

/** Filter the findManagedContainers() result to one user's containers. */
export function mapUserContainers(managed: ManagedContainerInfo[], userId: string): UserContainer[] {
  return managed
    .filter((c) => c.Labels?.['nmmr.userId'] === userId)
    .map((c) => ({
      containerId: c.Id,
      labId: c.Labels?.['nmmr.labId'] ?? '',
      createdAt: c.Created,
      running: c.State === 'running',
    }));
}

export function userOwnsContainer(
  managed: ManagedContainerInfo[],
  userId: string,
  containerId: string,
): boolean {
  return managed.some((c) => c.Id === containerId && c.Labels?.['nmmr.userId'] === userId);
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `npm test`
Expected: PASS (the lab-allowlist tests plus the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/container-query.ts src/container-query.test.ts package.json
git commit -m "feat: add pure container-query helpers"
```

---

## Task 2: Relay — authenticated container endpoints (`nmmr-terminal`)

All paths under `../nmmr-terminal`. No unit test (HTTP/Docker wiring); the helpers are tested in Task 1. Verify by build.

**Files:**
- Modify: `src/auth.ts`, `src/server.ts`

- [ ] **Step 1: Add `getBearerUser` to `src/auth.ts`** — append:

```typescript
import type { IncomingMessage } from "http";

/** Extract and validate the user from an `Authorization: Bearer <token>` header. */
export function getBearerUser(req: IncomingMessage): UserPayload | null {
  const raw = req.headers["authorization"];
  const header = Array.isArray(raw) ? raw[0] : raw || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return null;
  try {
    return validateToken(match[1]);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Import the new helpers in `src/server.ts`** — add these imports near the top (alongside the existing imports):

```typescript
import { getBearerUser } from "./auth";
import { findManagedContainers, destroyContainer } from "./container-manager";
import { mapUserContainers, userOwnsContainer } from "./container-query";
```

(Note: `validateToken` is already imported from `./auth`; add `getBearerUser` to that existing import line instead of duplicating, and add `findManagedContainers, destroyContainer` to the existing `./container-manager` import line. `removeSession` is already imported from `./session-store`.)

- [ ] **Step 3: Make the HTTP handler async** — the request handler is created with `const httpServer = createServer((req, res) => {`. Change that line to:

```typescript
const httpServer = createServer(async (req, res) => {
```

- [ ] **Step 4: Add the two endpoints** — immediately before the final `res.writeHead(404); res.end("Not found");` in that handler, insert:

```typescript
  // List the caller's containers
  if (req.url === "/api/containers" && req.method === "GET") {
    const user = getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    try {
      const managed = await findManagedContainers();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ containers: mapUserContainers(managed as any, user.id) }));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to list containers" }));
    }
    return;
  }

  // Stop one of the caller's containers
  if (req.url === "/api/containers/stop" && req.method === "POST") {
    const user = getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", async () => {
      let containerId = "";
      try { containerId = JSON.parse(raw || "{}").containerId || ""; } catch { /* ignore */ }
      if (!containerId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing containerId" }));
        return;
      }
      try {
        const managed = await findManagedContainers();
        if (!userOwnsContainer(managed as any, user.id, containerId)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }
        const owned = (managed as any[]).find((c) => c.Id === containerId);
        await destroyContainer(containerId);
        const labId = owned?.Labels?.["nmmr.labId"];
        if (labId) removeSession(user.id, labId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ stopped: true }));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to stop container" }));
      }
    });
    return;
  }
```

> The `as any` casts bridge `Docker.ContainerInfo[]` (from `findManagedContainers`) to the
> minimal `ManagedContainerInfo[]` shape the pure helpers accept; the runtime fields
> (`Id`, `Labels`, `Created`, `State`) are present on `Docker.ContainerInfo`.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: `tsc` succeeds (emits `dist/`). Do not commit `dist/`.

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts src/server.ts
git commit -m "feat: add authenticated container list/stop endpoints"
```

---

## Task 3: Blog — `authorizeManageRequest` token helper

**Files:**
- Modify: `src/lib/terminalToken.ts`
- Test: `tests/terminalToken.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/terminalToken.test.ts` (add `authorizeManageRequest` to the existing `'@/lib/terminalToken'` import). `SECRET` and `jwt` are already in that file:

```typescript
describe('authorizeManageRequest', () => {
  it('401 without a subject', () => {
    expect(authorizeManageRequest({ groups: ['Coder'], secret: SECRET }).status).toBe(401);
  });
  it('403 when the user is not a Coder', () => {
    expect(authorizeManageRequest({ sub: 'u1', groups: ['ContentWriter'], secret: SECRET }).status).toBe(403);
  });
  it('500 without a secret', () => {
    expect(authorizeManageRequest({ sub: 'u1', groups: ['Coder'], secret: '' }).status).toBe(500);
  });
  it('200 with a decodable 5-minute token', () => {
    const r = authorizeManageRequest({ sub: 'u1', email: 'u@example.com', groups: ['Coder'], secret: SECRET });
    expect(r.status).toBe(200);
    const decoded = jwt.verify(r.body.token as string, SECRET) as Record<string, unknown>;
    expect(decoded.id).toBe('u1');
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(300);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/terminalToken.test.ts`
Expected: FAIL — `authorizeManageRequest` is not exported.

- [ ] **Step 3: Implement** — in `src/lib/terminalToken.ts`, add a private mint helper and the new function, and reuse the mint inside the existing `authorizeTerminalRequest`. The full file becomes:

```typescript
import jwt from 'jsonwebtoken';
import { roleFromGroups, canUseContainers } from './roles';
import { ALLOWED_LAB_IDS } from './terminalEmbed';

export interface TerminalAuthInput {
  sub?: string;
  email?: string;
  groups: string[];
  labId?: string;
  secret?: string;
}

export interface TerminalAuthResult {
  status: number;
  body: { token?: string; error?: string };
}

function mintToken(sub: string, email: string | undefined, groups: string[], secret: string): string {
  return jwt.sign(
    { id: sub, email: email ?? '', role: roleFromGroups(groups) },
    secret,
    { expiresIn: '5m' },
  );
}

export function authorizeTerminalRequest(input: TerminalAuthInput): TerminalAuthResult {
  if (!input.sub) return { status: 401, body: { error: 'Unauthenticated' } };
  if (!canUseContainers(input.groups)) return { status: 403, body: { error: 'Coder access required' } };
  if (!input.labId || !(ALLOWED_LAB_IDS as string[]).includes(input.labId)) {
    return { status: 400, body: { error: 'Unknown lab' } };
  }
  if (!input.secret) return { status: 500, body: { error: 'Server misconfigured' } };
  return { status: 200, body: { token: mintToken(input.sub, input.email, input.groups, input.secret) } };
}

export interface ManageAuthInput {
  sub?: string;
  email?: string;
  groups: string[];
  secret?: string;
}

export function authorizeManageRequest(input: ManageAuthInput): TerminalAuthResult {
  if (!input.sub) return { status: 401, body: { error: 'Unauthenticated' } };
  if (!canUseContainers(input.groups)) return { status: 403, body: { error: 'Coder access required' } };
  if (!input.secret) return { status: 500, body: { error: 'Server misconfigured' } };
  return { status: 200, body: { token: mintToken(input.sub, input.email, input.groups, input.secret) } };
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run tests/terminalToken.test.ts`
Expected: PASS (the existing `authorizeTerminalRequest` suite plus the new one). Also run `npx vitest run` to confirm nothing else broke.

- [ ] **Step 5: Commit**

```bash
git add src/lib/terminalToken.ts tests/terminalToken.test.ts
git commit -m "feat: add authorizeManageRequest token helper"
```

---

## Task 4: Blog — `relativeTimeFromSeconds` helper

**Files:**
- Modify: `src/lib/format.ts`
- Test: `tests/format.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/format.test.ts` (add `relativeTimeFromSeconds` to the existing `'@/lib/format'` import; `describe`/`it`/`expect` are already imported there):

```typescript
describe('relativeTimeFromSeconds', () => {
  const now = 1_000_000_000_000; // fixed nowMs
  const secAgo = (s: number) => now / 1000 - s;
  it('shows "just now" under a minute', () => {
    expect(relativeTimeFromSeconds(secAgo(30), now)).toBe('just now');
  });
  it('shows minutes (singular and plural)', () => {
    expect(relativeTimeFromSeconds(secAgo(60), now)).toBe('1 min ago');
    expect(relativeTimeFromSeconds(secAgo(5 * 60), now)).toBe('5 mins ago');
  });
  it('shows hours and days', () => {
    expect(relativeTimeFromSeconds(secAgo(3 * 3600), now)).toBe('3 hours ago');
    expect(relativeTimeFromSeconds(secAgo(2 * 86400), now)).toBe('2 days ago');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/format.test.ts`
Expected: FAIL — `relativeTimeFromSeconds` is not exported.

- [ ] **Step 3: Implement** — append to `src/lib/format.ts`:

```typescript
/** Human "started X ago" label from a unix-seconds timestamp and the current ms time. */
export function relativeTimeFromSeconds(seconds: number, nowMs: number): string {
  const mins = Math.floor((nowMs - seconds * 1000) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run tests/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/format.test.ts
git commit -m "feat: add relativeTimeFromSeconds helper"
```

---

## Task 5: Blog — `relayProxy` and `manageAuth` server helpers

**Files:**
- Create: `src/lib/relayProxy.ts`, `src/lib/manageAuth.ts`

No automated test (server `fetch`/Amplify-context dependent); verified by build and the route tasks. The pure decision (`authorizeManageRequest`) is already tested in Task 3.

- [ ] **Step 1: Create `src/lib/relayProxy.ts`**

```typescript
export interface RelayResponse {
  status: number;
  body: unknown;
}

/** Server-to-server call to the relay's HTTP API with a bearer token. */
export async function proxyToRelay(
  path: string,
  opts: { method: 'GET' | 'POST'; token: string; body?: unknown },
): Promise<RelayResponse> {
  const base = process.env.TERMINAL_HTTP_URL ?? 'http://localhost:8080';
  try {
    const res = await fetch(`${base}${path}`, {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch {
    return { status: 502, body: { error: 'Could not reach the lab service' } };
  }
}
```

- [ ] **Step 2: Create `src/lib/manageAuth.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { authorizeManageRequest, type TerminalAuthResult } from '@/lib/terminalToken';

/** Read the Cognito session for this request and mint a relay management token. */
export async function mintManageToken(request: NextRequest): Promise<TerminalAuthResult> {
  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const payload = session?.tokens?.idToken?.payload as Record<string, unknown> | undefined;
  const groups = (payload?.['cognito:groups'] as string[] | undefined) ?? [];

  return authorizeManageRequest({
    sub: payload?.sub as string | undefined,
    email: payload?.email as string | undefined,
    groups,
    secret: process.env.TERMINAL_JWT_SECRET,
  });
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/relayProxy.ts src/lib/manageAuth.ts
git commit -m "feat: add relay proxy and manage-token server helpers"
```

---

## Task 6: Blog — proxy route handlers

**Files:**
- Create: `src/app/api/containers/route.ts`, `src/app/api/containers/stop/route.ts`

No automated test (Amplify-context dependent); the auth decision and proxy are unit-tested/build-verified. Verify by build + Task 8 manual.

- [ ] **Step 1: Create `src/app/api/containers/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { mintManageToken } from '@/lib/manageAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function GET(request: NextRequest) {
  const auth = await mintManageToken(request);
  if (auth.status !== 200 || !auth.body.token) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/containers', { method: 'GET', token: auth.body.token });
  return NextResponse.json(relay.body, { status: relay.status });
}
```

- [ ] **Step 2: Create `src/app/api/containers/stop/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { mintManageToken } from '@/lib/manageAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const containerId: string | undefined = body?.containerId;

  const auth = await mintManageToken(request);
  if (auth.status !== 200 || !auth.body.token) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/containers/stop', {
    method: 'POST',
    token: auth.body.token,
    body: { containerId },
  });
  return NextResponse.json(relay.body, { status: relay.status });
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; both routes appear as dynamic (`ƒ`) in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/containers/route.ts src/app/api/containers/stop/route.ts
git commit -m "feat: add container list/stop proxy routes"
```

---

## Task 7: Blog — `MyContainers` component on `/account`

**Files:**
- Create: `src/components/MyContainers.tsx`
- Modify: `src/app/account/page.tsx`

No automated test (DOM/fetch); verify by build + Task 8 manual.

- [ ] **Step 1: Create `src/components/MyContainers.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';
import { TERMINAL_LABS } from '@/lib/terminalEmbed';
import { relativeTimeFromSeconds } from '@/lib/format';

interface ContainerRow {
  containerId: string;
  labId: string;
  createdAt: number;
  running: boolean;
}

export default function MyContainers() {
  const { user, loading } = useCurrentUser();
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const isCoder = !!user && canUseContainers(user.groups);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/containers');
      if (!res.ok) {
        setMessage('Couldn’t reach the lab service.');
        return;
      }
      const data = await res.json();
      setRows((data.containers ?? []) as ContainerRow[]);
      setMessage('');
    } catch {
      setMessage('Couldn’t reach the lab service.');
    }
  }, []);

  useEffect(() => {
    if (isCoder) load();
  }, [isCoder, load]);

  async function stop(id: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/containers/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId: id }),
      });
      if (!res.ok) setMessage('Could not stop the container.');
      await load();
    } finally {
      setBusy('');
    }
  }

  if (loading || !isCoder) return null;

  const labLabel = (labId: string) => (TERMINAL_LABS as Record<string, string>)[labId] ?? labId;

  return (
    <div className="space-y-2">
      <h2 className="font-semibold">My containers</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No active containers.</p>
      ) : (
        <ul className="divide-y rounded border">
          {rows.map((c) => (
            <li key={c.containerId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {labLabel(c.labId)}{' '}
                <span className="text-gray-500">· started {relativeTimeFromSeconds(c.createdAt, Date.now())}</span>
              </span>
              <button
                disabled={busy === c.containerId}
                onClick={() => stop(c.containerId)}
                className="rounded bg-red-600 px-2 py-1 text-xs text-white"
              >
                Stop
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="text-sm text-red-500">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Render it on `/account`** — in `src/app/account/page.tsx`, add the import near the other component imports:

```tsx
import MyContainers from '@/components/MyContainers';
```

and render it inside the signed-in `return`, directly after the `<MyRequests ... />` line:

```tsx
      <MyRequests requests={requests} />
      <MyContainers />
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/MyContainers.tsx src/app/account/page.tsx
git commit -m "feat: add My containers section to the account page"
```

---

## Task 8: Config, docs, and verification

**Files:**
- Modify: `README.md`, `../nmmr-terminal/.env.example`, and local `.env.local` (not committed).

- [ ] **Step 1: Local env** — append to `.env.local` (gitignored; confirm with `git check-ignore .env.local` first):

```
TERMINAL_HTTP_URL=http://localhost:8080
```

- [ ] **Step 2: Document in the blog `README.md`** — add to the existing "Coder terminals" section (append a paragraph):

```markdown
Coders can view and stop their running container at `/account` ("My containers").
The browser calls the blog's `/api/containers` and `/api/containers/stop` routes, which
verify the Cognito session + `Coder` group, mint a token, and proxy server-to-server to
the relay's `GET /api/containers` / `POST /api/containers/stop` over `TERMINAL_HTTP_URL`
(e.g. `https://terminal.nmmr.tech`; `http://localhost:8080` locally).
```

- [ ] **Step 3: Note the relay env** — in `../nmmr-terminal/.env.example`, add a comment line:

```bash
# /api/containers and /api/containers/stop require Authorization: Bearer <token> (same JWT_SECRET)
```

- [ ] **Step 4: Commit docs**

```bash
git add README.md
git commit -m "docs: document the My containers feature and TERMINAL_HTTP_URL"
cd ../nmmr-terminal && git add .env.example && git commit -m "docs: note authenticated container endpoints" && cd -
```

- [ ] **Step 5: Full verification (blog + relay)**

```bash
# Blog
npx vitest run        # all suites green, incl. authorizeManageRequest + relativeTimeFromSeconds
npm run build         # succeeds; /api/containers and /api/containers/stop are dynamic routes
# Relay
cd ../nmmr-terminal && npm test && npm run build && cd -   # container-query tests green; tsc clean
```

- [ ] **Step 6: Manual end-to-end (requires Docker + the relay running)**

1. Start the relay (`../nmmr-terminal`: `npm run build && npm start`) with `JWT_SECRET` matching the blog's `TERMINAL_JWT_SECRET`; start the blog sandbox + `npm run dev` with `TERMINAL_HTTP_URL=http://localhost:8080`.
2. As a Coder, open a post with a ` ```terminal ` fence and **Launch** a terminal.
3. Go to `/account`; confirm "My containers" lists the running lab with a "started …" label.
4. Click **Stop**; confirm the row disappears and `docker ps` no longer shows `nmmr-<id>-<lab>`.
5. Negative check: with the relay stopped, reload `/account` and confirm the "Couldn’t reach the lab service." message appears (502 path).

---

## Self-review notes

- **Spec coverage:** relay `GET /api/containers` + `POST /api/containers/stop` with bearer auth and ownership check (Tasks 1–2); pure `mapUserContainers`/`userOwnsContainer` (Task 1); `authorizeManageRequest` (Task 3); `relativeTimeFromSeconds` for the "started …" label (Task 4); `proxyToRelay` + `mintManageToken` (Task 5); blog proxy routes (Task 6); `MyContainers` on `/account`, Coder-gated, with Stop + empty state + 502 message (Task 7); `TERMINAL_HTTP_URL` env + docs (Task 8); tests for the three pure helpers; manual e2e (Task 8). All spec sections map to a task.
- **Type consistency:** the relay `UserContainer` shape `{ containerId, labId, createdAt, running }` matches the JSON the relay returns, the `ContainerRow` interface in `MyContainers`, and the `{ containers: [...] }` envelope. `authorizeManageRequest({ sub, email, groups, secret })` and `proxyToRelay(path, { method, token, body? })` and `mintManageToken(request)` are used with these exact signatures across Tasks 5–6. `TerminalAuthResult` is reused for the manage path.
- **Deferred (not in this plan, per spec):** admin all-containers view, restart/logs, >1 container per user, networked containers, Cognito-native relay auth.
```
