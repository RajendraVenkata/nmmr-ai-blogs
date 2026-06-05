# Admin All-Containers View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a SystemAdmin an `/admin/containers` page that lists every user's running container (with owner email, lab, start time) and can stop any of them.

**Architecture:** The relay gains an admin-scoped pair of endpoints (`GET /api/admin/containers`, `POST /api/admin/containers/stop`) that verify a Cognito ID token and require the `SystemAdmin` group, backed by pure helpers `requireAdmin` and `mapAllContainers`. The blog adds admin proxy routes (`getAdminAuth` forwards the session idToken after a SystemAdmin check) and an `AdminContainers` page that resolves `userId → email` from `UserProfile`. Mirrors the "My containers" plumbing.

**Tech Stack:** Node/TypeScript relay (`nmmr-terminal`), `node:test`; Next.js blog (`nmmr-ai-blogs`), Amplify, vitest. No new dependencies.

**Branch:** `admin-containers-view` (already created; spec committed there).

**Repos:** `nmmr-terminal` (sibling at `../nmmr-terminal`; Tasks 1–3) and `nmmr-ai-blogs` (this repo; Tasks 4–6). Task 7 verifies both.

---

## File Structure

**`nmmr-terminal`:**
- `src/cognito-claims.ts` (modify) — add `requireAdmin`.
- `src/cognito-claims.test.ts` (modify) — test `requireAdmin`.
- `src/container-query.ts` (modify) — add `mapAllContainers` + `AdminContainer` type.
- `src/container-query.test.ts` (modify) — test `mapAllContainers`.
- `src/server.ts` (modify) — add the two admin endpoints.

**`nmmr-ai-blogs`:**
- `src/lib/adminAuth.ts` (create) — `getAdminAuth` (SystemAdmin gate + session idToken).
- `src/app/api/admin/containers/route.ts` (create) — `GET` proxy.
- `src/app/api/admin/containers/stop/route.ts` (create) — `POST` proxy.
- `src/components/AdminContainers.tsx` (create) — the admin table.
- `src/app/admin/containers/page.tsx` (create) — the page (RequireRole + AdminNav).
- `src/components/AdminNav.tsx` (modify) — add the Containers link.

---

## Task 1: Relay — `requireAdmin` + `mapAllContainers` helpers (`nmmr-terminal`)

All paths under `../nmmr-terminal`. TDD.

**Files:** Modify `src/cognito-claims.ts`, `src/cognito-claims.test.ts`, `src/container-query.ts`, `src/container-query.test.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `src/cognito-claims.test.ts` (add `requireAdmin` to the existing `'./cognito-claims'` import):

```typescript
test('requireAdmin is true only when SystemAdmin is present', () => {
  assert.equal(requireAdmin(['SystemAdmin']), true);
  assert.equal(requireAdmin(['Coder']), false);
  assert.equal(requireAdmin([]), false);
});
```

Append to `src/container-query.test.ts` (add `mapAllContainers` to the existing `'./container-query'` import):

```typescript
test('mapAllContainers returns every container with its userId', () => {
  assert.deepEqual(mapAllContainers(managed), [
    { containerId: 'c1', userId: 'u1', labId: 'python-basics', createdAt: 1000, running: true },
    { containerId: 'c2', userId: 'u2', labId: 'node-basics', createdAt: 2000, running: false },
  ]);
});
```

- [ ] **Step 2: Run, verify they fail**

Run: `npm test`
Expected: FAIL — `requireAdmin` / `mapAllContainers` not exported.

- [ ] **Step 3: Implement**

Append to `src/cognito-claims.ts`:

```typescript
export function requireAdmin(groups: string[]): boolean {
  return groups.includes("SystemAdmin");
}
```

Append to `src/container-query.ts`:

```typescript
export interface AdminContainer {
  containerId: string;
  userId: string;
  labId: string;
  createdAt: number;
  running: boolean;
}

/** Map every managed container (all users), including its owner userId. */
export function mapAllContainers(managed: ManagedContainerInfo[]): AdminContainer[] {
  return managed.map((c) => ({
    containerId: c.Id,
    userId: c.Labels?.['nmmr.userId'] ?? '',
    labId: c.Labels?.['nmmr.labId'] ?? '',
    createdAt: c.Created,
    running: c.State === 'running',
  }));
}
```

- [ ] **Step 4: Run, verify they pass**

Run: `npm test`
Expected: PASS (all relay tests, including the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/cognito-claims.ts src/cognito-claims.test.ts src/container-query.ts src/container-query.test.ts
git commit -m "feat: add requireAdmin and mapAllContainers helpers"
```

---

## Task 2: Relay — `GET /api/admin/containers`

All paths under `../nmmr-terminal`. No unit test (HTTP/Docker wiring); verify by build + `npm test`.

**Files:** Modify `src/server.ts`.

- [ ] **Step 1: Import the new helpers** — in `src/server.ts`, the imports already include `requireCoder` from `"./cognito-claims"` and `mapUserContainers, userOwnsContainer` from `"./container-query"`. Extend them:

```typescript
import { requireCoder, requireAdmin } from "./cognito-claims";
import { mapUserContainers, userOwnsContainer, mapAllContainers } from "./container-query";
```

- [ ] **Step 2: Add the endpoint** — immediately AFTER the existing `if (req.url === "/api/containers" && req.method === "GET") { … }` block (and before the `/api/containers/stop` block), insert:

```typescript
  if (req.url === "/api/admin/containers" && req.method === "GET") {
    const user = await getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (!requireAdmin(user.groups)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Admin access required" }));
      return;
    }
    try {
      const managed = await findManagedContainers();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ containers: mapAllContainers(managed as any) }));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to list containers" }));
    }
    return;
  }
```

- [ ] **Step 3: Build and test**

Run: `npm run build && npm test`
Expected: tsc succeeds; all node:test suites pass.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: add admin list-all-containers endpoint"
```

---

## Task 3: Relay — `POST /api/admin/containers/stop`

All paths under `../nmmr-terminal`. No unit test (HTTP/Docker wiring); verify by build.

**Files:** Modify `src/server.ts`.

- [ ] **Step 1: Add the endpoint** — immediately AFTER the existing `if (req.url === "/api/containers/stop" && req.method === "POST") { … }` block, insert (an admin may stop ANY managed container — no ownership check; `404` if the id isn't a managed container):

```typescript
  if (req.url === "/api/admin/containers/stop" && req.method === "POST") {
    const user = await getBearerUser(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (!requireAdmin(user.groups)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Admin access required" }));
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
        const owned = (managed as any[]).find((c) => c.Id === containerId);
        if (!owned) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }
        await destroyContainer(containerId);
        const ownerId = owned.Labels?.["nmmr.userId"];
        const labId = owned.Labels?.["nmmr.labId"];
        if (ownerId && labId) removeSession(ownerId, labId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ stopped: true }));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to stop container" }));
      }
    });
    req.on("error", () => {
      if (!res.writableEnded) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request error" }));
      }
    });
    return;
  }
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc` succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add admin stop-any-container endpoint"
```

---

## Task 4: Blog — `getAdminAuth` + admin proxy routes

All paths in this repo (`nmmr-ai-blogs`). No automated test (Amplify-context dependent); the gate reuses tested `roleFromGroups`/`canGrantRoles`. Verify by build.

**Files:** Create `src/lib/adminAuth.ts`, `src/app/api/admin/containers/route.ts`, `src/app/api/admin/containers/stop/route.ts`.

- [ ] **Step 1: Create `src/lib/adminAuth.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { roleFromGroups, canGrantRoles } from '@/lib/roles';

export interface AdminAuth {
  status: number;
  token?: string;
  error?: string;
}

/** Read the Cognito session and return its ID token, only for SystemAdmins. */
export async function getAdminAuth(request: NextRequest): Promise<AdminAuth> {
  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const idToken = session?.tokens?.idToken;
  if (!idToken) return { status: 401, error: 'Unauthenticated' };

  const groups = (idToken.payload?.['cognito:groups'] as string[] | undefined) ?? [];
  if (!canGrantRoles(roleFromGroups(groups))) return { status: 403, error: 'Admin access required' };

  return { status: 200, token: idToken.toString() };
}
```

- [ ] **Step 2: Create `src/app/api/admin/containers/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/adminAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function GET(request: NextRequest) {
  const auth = await getAdminAuth(request);
  if (auth.status !== 200 || !auth.token) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/admin/containers', { method: 'GET', token: auth.token });
  return NextResponse.json(relay.body, { status: relay.status });
}
```

- [ ] **Step 3: Create `src/app/api/admin/containers/stop/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/adminAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const containerId: string | undefined = body?.containerId;

  const auth = await getAdminAuth(request);
  if (auth.status !== 200 || !auth.token) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/admin/containers/stop', {
    method: 'POST',
    token: auth.token,
    body: { containerId },
  });
  return NextResponse.json(relay.body, { status: relay.status });
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds; `/api/admin/containers` and `/api/admin/containers/stop` are dynamic routes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminAuth.ts src/app/api/admin/containers/route.ts src/app/api/admin/containers/stop/route.ts
git commit -m "feat: add admin container proxy routes"
```

---

## Task 5: Blog — `AdminContainers` component

All paths in this repo. No automated test (DOM/fetch); verify by build + Task 7 manual.

**Files:** Create `src/components/AdminContainers.tsx`.

- [ ] **Step 1: Create `src/components/AdminContainers.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { TERMINAL_LABS } from '@/lib/terminalEmbed';
import { relativeTimeFromSeconds } from '@/lib/format';

interface AdminRow {
  containerId: string;
  userId: string;
  labId: string;
  createdAt: number;
  running: boolean;
}

export default function AdminContainers() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [res, profiles] = await Promise.all([
        fetch('/api/admin/containers'),
        client.models.UserProfile.list({}),
      ]);
      if (!res.ok) {
        setMessage("Couldn’t reach the lab service.");
        return;
      }
      const data = await res.json();
      setRows((data.containers ?? []) as AdminRow[]);
      const map: Record<string, string> = {};
      for (const p of (profiles.data ?? []) as { id: string; email?: string | null }[]) {
        if (p.email) map[p.id] = p.email;
      }
      setEmails(map);
      setMessage('');
    } catch {
      setMessage('Couldn’t reach the lab service.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function stop(id: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/containers/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId: id }),
      });
      if (res.ok) {
        await load();
      } else {
        setMessage('Could not stop the container.');
      }
    } catch {
      setMessage('Could not stop the container.');
    } finally {
      setBusy('');
    }
  }

  const labLabel = (labId: string) => (TERMINAL_LABS as Record<string, string>)[labId] ?? labId;

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No active containers.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">User</th>
              <th className="py-2">Lab</th>
              <th className="py-2">Started</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.containerId} className="border-b">
                <td className="py-2">{emails[c.userId] ?? c.userId}</td>
                <td className="py-2">{labLabel(c.labId)}</td>
                <td className="py-2 text-gray-500">{relativeTimeFromSeconds(c.createdAt, Date.now())}</td>
                <td className="py-2">
                  <button
                    disabled={busy === c.containerId}
                    onClick={() => stop(c.containerId)}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                  >
                    Stop
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {message && <p className="text-sm text-red-500">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminContainers.tsx
git commit -m "feat: add AdminContainers table component"
```

---

## Task 6: Blog — admin page + nav link

All paths in this repo.

**Files:** Create `src/app/admin/containers/page.tsx`. Modify `src/components/AdminNav.tsx`.

- [ ] **Step 1: Create `src/app/admin/containers/page.tsx`**

```tsx
'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import AdminContainers from '@/components/AdminContainers';
import { canGrantRoles } from '@/lib/roles';

export default function AdminContainersPage() {
  return (
    <RequireRole allow={canGrantRoles}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Containers</h2>
        <AdminContainers />
      </div>
    </RequireRole>
  );
}
```

- [ ] **Step 2: Add the nav link** — in `src/components/AdminNav.tsx`, add a Containers link after the Moderation link:

```tsx
      <Link href="/admin/moderation" className="text-primary">Moderation</Link>
      <Link href="/admin/containers" className="text-primary">Containers</Link>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; `/admin/containers` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/containers/page.tsx src/components/AdminNav.tsx
git commit -m "feat: add /admin/containers page and nav link"
```

---

## Task 7: Verification

**Files:** none (verification only).

- [ ] **Step 1: Full automated verification**

```bash
# Blog (this repo)
npx vitest run        # green
npm run build         # succeeds; /admin/containers + /api/admin/containers* present
# Relay
cd ../nmmr-terminal && npm test && npm run build && cd -   # requireAdmin + mapAllContainers tests green; tsc clean
```

- [ ] **Step 2: Manual end-to-end (Docker + relay running)**

1. Start the relay and blog. Have two DIFFERENT users each launch a terminal (so two containers exist with distinct `nmmr.userId` labels).
2. As the SystemAdmin (seed email), open `/admin/containers`. Confirm BOTH containers are listed, each showing the owner's email (or userId if no profile), lab name, and start time.
3. Click **Stop** on one; confirm that row disappears and `docker ps` no longer shows that container, while the other remains.
4. As a non-admin (a Coder), confirm `/admin/containers` does not render (RequireRole) and that `curl` to the relay's `GET /api/admin/containers` with that user's idToken returns `403`.

---

## Self-review notes

- **Spec coverage:** `requireAdmin` + `mapAllContainers` with userId (Task 1); `GET /api/admin/containers` admin-gated (Task 2); `POST /api/admin/containers/stop` stop-any + 404 (Task 3); `getAdminAuth` SystemAdmin gate + proxy routes (Task 4); `AdminContainers` with `userId→email` resolution, empty state, 502 message (Task 5); `/admin/containers` page + AdminNav link (Task 6); tests for both pure helpers; manual incl. the non-admin relay 403 (Task 7). All spec sections map to a task.
- **Type consistency:** `AdminContainer = { containerId, userId, labId, createdAt, running }` defined in Task 1, returned by the relay endpoint (Task 2), and consumed as `AdminRow` (same shape) in the component (Task 5). `requireAdmin(groups): boolean` (Task 1) used in Tasks 2–3. `getAdminAuth(request): { status, token?, error? }` (Task 4) consumed by both routes with `auth.token`/`auth.status`/`auth.error`.
- **Deferred (not in this plan, per spec):** bulk stop-all, logs/exec, live refresh, disk quotas, email notifications, getLabConfig hardening.
```
