# MNNR AI Blogs — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the self-service access-request workflow and the full system-admin console (request queue, user/role table, content moderation with restore) on top of the shipped Phase 1 app.

**Architecture:** Adds one Amplify Data model (`AccessRequest`, DynamoDB via AppSync) and starts populating the existing `UserProfile` model from the client. New React (client) pages/components reuse the Phase 1 patterns: `useCurrentUser` for role, `client.models.*` for data, `RequireRole` for gating, soft-delete via status updates. Cognito groups remain the authorization source of truth; `UserProfile.role` is a display mirror kept in sync by the admin actions and a client-side `ensureProfile` upsert.

**Tech Stack:** Next.js 14 (App Router, TS, Tailwind), Amplify Gen 2 (`@aws-amplify/backend`), `aws-amplify` v6 client, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-31-phase2-access-and-admin-design.md`

**Working directory:** repo root `nmmr-ai-blogs/` (branch `phase2-implementation`). All paths relative to it.

---

## File structure (Phase 2)

```
amplify/data/resource.ts                 # MODIFY: add AccessRequest model
src/lib/access.ts                        # NEW: pure logic (requestable roles, filters, restore mapping)
src/lib/useCurrentUser.ts                # MODIFY: ensureProfile() upsert on load
src/components/AccessRequestForm.tsx      # NEW: request a role
src/components/MyRequests.tsx             # NEW: list own requests + status
src/components/AdminNav.tsx               # NEW: console sub-nav
src/components/RequestQueue.tsx           # NEW: pending-request queue + approve/reject
src/components/UserTable.tsx              # NEW: all users + role dropdown
src/components/ModerationList.tsx         # NEW: deleted posts/comments + restore
src/app/account/page.tsx                  # MODIFY: add request form + my requests
src/app/admin/page.tsx                    # MODIFY: redirect to /admin/requests
src/app/admin/requests/page.tsx           # NEW
src/app/admin/users/page.tsx              # NEW
src/app/admin/moderation/page.tsx         # NEW
tests/access.test.ts                      # NEW
```

> **Auth recap (already deployed, do not change):** `UserProfile` allows `owner`
> create/read/update and `SystemAdmin` read/update (NOT create). `AccessRequest`
> (added in Task 1) allows `owner` create/read and `SystemAdmin` read/update. No
> model grants `delete`. Therefore the `UserProfile.role` mirror update by an admin
> uses `update` only — if a target user has no profile yet, the update is allowed
> to fail silently (the Cognito group change via `setUserRole` is the real grant).

---

## Task 1: Add `AccessRequest` model and redeploy

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1: Add the model to the schema**

In `amplify/data/resource.ts`, inside the `a.schema({ ... })` object, add the
following model immediately after the `Comment` model and before the `setUserRole`
mutation:

```ts
  AccessRequest: a
    .model({
      userId: a.string().required(),
      userEmail: a.string(),
      requestedRole: a.enum(['CONTENT_WRITER', 'CONTENT_ADMIN']),
      reason: a.string(),
      status: a.enum(['PENDING', 'APPROVED', 'REJECTED']),
      decidedBy: a.string(),
      decidedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.groups(['SystemAdmin']).to(['read', 'update']),
    ]),
```

- [ ] **Step 2: Redeploy the backend (provisions the new DynamoDB table)**

The sandbox must be running or run once. Run (long; allow up to 600000 ms):
```bash
SEED_ADMIN_EMAILS="rajendra.venkata@gmail.com" npx ampx sandbox --once
```
Expected: deploy succeeds; `amplify_outputs.json` is refreshed. If the deploy fails,
capture the exact error and report BLOCKED.

- [ ] **Step 3: Verify the model is in the generated outputs**

Run: `grep -c AccessRequest amplify_outputs.json && echo OK`
Expected: a non-zero count and `OK` (the model appears in the GraphQL model intro).

- [ ] **Step 4: Commit** (outputs are gitignored)

```bash
git add amplify/data/resource.ts && git commit -m "feat(amplify): add AccessRequest model"
```

---

## Task 2: Pure-logic library — access helpers (TDD)

**Files:**
- Create: `tests/access.test.ts`, `src/lib/access.ts`

- [ ] **Step 1: Write the failing test** — `tests/access.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  requestableRoles,
  canRequestRole,
  pendingRequests,
  deletedItems,
  restoreStatusForPost,
  restoreStatusForComment,
} from '@/lib/access';

describe('requestableRoles', () => {
  it('lets a reader request writer or admin', () => {
    expect(requestableRoles('READER')).toEqual(['CONTENT_WRITER', 'CONTENT_ADMIN']);
  });
  it('lets a writer request only admin', () => {
    expect(requestableRoles('CONTENT_WRITER')).toEqual(['CONTENT_ADMIN']);
  });
  it('offers nothing to admins', () => {
    expect(requestableRoles('CONTENT_ADMIN')).toEqual([]);
    expect(requestableRoles('SYSTEM_ADMIN')).toEqual([]);
  });
});

describe('canRequestRole', () => {
  it('allows a higher requestable role', () => {
    expect(canRequestRole('READER', 'CONTENT_WRITER')).toBe(true);
    expect(canRequestRole('CONTENT_WRITER', 'CONTENT_ADMIN')).toBe(true);
  });
  it('rejects same-or-lower and system admin', () => {
    expect(canRequestRole('CONTENT_WRITER', 'CONTENT_WRITER')).toBe(false);
    expect(canRequestRole('CONTENT_ADMIN', 'CONTENT_WRITER')).toBe(false);
    expect(canRequestRole('READER', 'SYSTEM_ADMIN')).toBe(false);
  });
});

describe('filters', () => {
  const reqs = [
    { id: '1', status: 'PENDING' },
    { id: '2', status: 'APPROVED' },
    { id: '3', status: 'REJECTED' },
  ];
  it('pendingRequests keeps only PENDING', () => {
    expect(pendingRequests(reqs).map((r) => r.id)).toEqual(['1']);
  });
  const content = [
    { id: 'a', status: 'PUBLISHED' },
    { id: 'b', status: 'DELETED' },
    { id: 'c', status: 'ACTIVE' },
  ];
  it('deletedItems keeps only DELETED', () => {
    expect(deletedItems(content).map((r) => r.id)).toEqual(['b']);
  });
});

describe('restore targets', () => {
  it('post restores to DRAFT, comment to ACTIVE', () => {
    expect(restoreStatusForPost()).toBe('DRAFT');
    expect(restoreStatusForComment()).toBe('ACTIVE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/access.test.ts`
Expected: FAIL — cannot resolve `@/lib/access`.

- [ ] **Step 3: Write `src/lib/access.ts`**

```ts
import type { Role } from '@/lib/roles';

export type RequestableRole = 'CONTENT_WRITER' | 'CONTENT_ADMIN';

const ROLE_RANK: Record<Role, number> = {
  READER: 0,
  CONTENT_WRITER: 1,
  CONTENT_ADMIN: 2,
  SYSTEM_ADMIN: 3,
};

const REQUESTABLE: RequestableRole[] = ['CONTENT_WRITER', 'CONTENT_ADMIN'];

export function requestableRoles(currentRole: Role): RequestableRole[] {
  return REQUESTABLE.filter((r) => ROLE_RANK[r] > ROLE_RANK[currentRole]);
}

export function canRequestRole(currentRole: Role, target: Role): boolean {
  if (target !== 'CONTENT_WRITER' && target !== 'CONTENT_ADMIN') return false;
  return ROLE_RANK[target] > ROLE_RANK[currentRole];
}

export interface HasStatus {
  status?: string | null;
}

export function pendingRequests<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'PENDING');
}

export function deletedItems<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'DELETED');
}

export function restoreStatusForPost(): 'DRAFT' {
  return 'DRAFT';
}

export function restoreStatusForComment(): 'ACTIVE' {
  return 'ACTIVE';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: all tests pass (Phase 1's 21 + the new access tests).

- [ ] **Step 6: Commit**

```bash
git add tests/access.test.ts src/lib/access.ts && git commit -m "feat: add access-request helpers and content-restore mapping"
```

---

## Task 3: `ensureProfile` upsert in current-user hook

**Files:**
- Modify: `src/lib/useCurrentUser.ts`

- [ ] **Step 1: Replace `src/lib/useCurrentUser.ts` with this version**

```ts
'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { roleFromGroups, type Role } from '@/lib/roles';
import { client } from '@/lib/client';

export interface CurrentUser {
  userId: string;
  username: string;
  email: string;
  role: Role;
}

async function ensureProfile(u: CurrentUser) {
  // Mirror the user's identity/role into UserProfile so admins can enumerate
  // users. Non-fatal: authorization still comes from Cognito groups.
  try {
    const { data: existing } = await client.models.UserProfile.get({ id: u.userId });
    if (!existing) {
      await client.models.UserProfile.create({
        id: u.userId,
        email: u.email,
        role: u.role,
        status: 'ACTIVE',
      });
    } else if (existing.role !== u.role) {
      await client.models.UserProfile.update({ id: u.userId, role: u.role });
    }
  } catch {
    // ignore — profile mirroring is best-effort
  }
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload ?? {};
      const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];
      const email = (payload.email as string | undefined) ?? '';
      const next: CurrentUser = {
        userId: current.userId,
        username: current.username,
        email,
        role: roleFromGroups(groups),
      };
      setUser(next);
      void ensureProfile(next);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const stop = Hub.listen('auth', () => load());
    return () => stop();
  }, []);

  return { user, loading, reload: load };
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: compiles. (No new route; this only changes the hook.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/useCurrentUser.ts && git commit -m "feat(web): upsert UserProfile mirror on sign-in"
```

---

## Task 4: Account page — request form + my requests

**Files:**
- Create: `src/components/AccessRequestForm.tsx`, `src/components/MyRequests.tsx`
- Modify: `src/app/account/page.tsx`

- [ ] **Step 1: Create `src/components/AccessRequestForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { client } from '@/lib/client';
import { requestableRoles, type RequestableRole } from '@/lib/access';
import type { CurrentUser } from '@/lib/useCurrentUser';

export default function AccessRequestForm({
  user,
  pendingRoles,
  onSubmitted,
}: {
  user: CurrentUser;
  pendingRoles: string[];
  onSubmitted: () => void;
}) {
  const options = requestableRoles(user.role);
  const [role, setRole] = useState<RequestableRole | ''>(options[0] ?? '');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  if (options.length === 0) return null;

  async function submit() {
    if (!role) return;
    if (pendingRoles.includes(role)) {
      setMessage('You already have a pending request for that role.');
      return;
    }
    setMessage('Submitting…');
    try {
      await client.models.AccessRequest.create({
        userId: user.userId,
        userEmail: user.email,
        requestedRole: role,
        reason,
        status: 'PENDING',
      });
      setReason('');
      setMessage('Request submitted.');
      onSubmitted();
    } catch (err) {
      setMessage(`Failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-2 rounded border p-4">
      <h2 className="font-semibold">Request access</h2>
      <select
        className="rounded border p-2"
        value={role}
        onChange={(e) => setRole(e.target.value as RequestableRole)}
      >
        {options.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <textarea
        className="w-full rounded border p-2 text-sm"
        placeholder="Why do you need this access?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button onClick={submit} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
        Submit request
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/MyRequests.tsx`**

```tsx
'use client';

export interface RequestRow {
  id: string;
  requestedRole?: string | null;
  status?: string | null;
  reason?: string | null;
}

export default function MyRequests({ requests }: { requests: RequestRow[] }) {
  if (requests.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">My requests</h2>
      <ul className="divide-y rounded border">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{r.requestedRole}</span>
            <span className="text-gray-500">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/account/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { client } from '@/lib/client';
import AccessRequestForm from '@/components/AccessRequestForm';
import MyRequests, { type RequestRow } from '@/components/MyRequests';
import { pendingRequests } from '@/lib/access';

export default function AccountPage() {
  const { user, loading } = useCurrentUser();
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const loadRequests = useCallback(async () => {
    const { data } = await client.models.AccessRequest.list({});
    setRequests(data as RequestRow[]);
  }, []);

  useEffect(() => {
    if (user) loadRequests();
  }, [user?.userId, loadRequests]);

  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.
      </p>
    );
  }

  const pendingRoles = pendingRequests(requests)
    .map((r) => r.requestedRole)
    .filter((r): r is string => !!r);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p className="text-xs text-gray-400">Your user id: {user.userId}</p>
      <AccessRequestForm user={user} pendingRoles={pendingRoles} onSubmitted={loadRequests} />
      <MyRequests requests={requests} />
    </div>
  );
}
```

- [ ] **Step 4: Build & verify**

Run: `npm run build`
Expected: compiles; `/account` present. Pre-existing `react-hooks/exhaustive-deps`
warnings elsewhere are acceptable; this page uses `useCallback` so it should not add new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/AccessRequestForm.tsx src/components/MyRequests.tsx src/app/account/page.tsx && git commit -m "feat(web): add self-service access request to account page"
```

---

## Task 5: Admin console nav + request queue

**Files:**
- Create: `src/components/AdminNav.tsx`, `src/components/RequestQueue.tsx`, `src/app/admin/requests/page.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create `src/components/AdminNav.tsx`**

```tsx
'use client';

import Link from 'next/link';

export default function AdminNav() {
  return (
    <nav className="mb-4 flex gap-4 border-b pb-2 text-sm">
      <Link href="/admin/requests" className="text-blue-600">Requests</Link>
      <Link href="/admin/users" className="text-blue-600">Users</Link>
      <Link href="/admin/moderation" className="text-blue-600">Moderation</Link>
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/components/RequestQueue.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { pendingRequests } from '@/lib/access';

interface RequestRow {
  id: string;
  userId: string;
  userEmail?: string | null;
  requestedRole?: string | null;
  reason?: string | null;
  status?: string | null;
}

export default function RequestQueue() {
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    const { data } = await client.models.AccessRequest.list({
      filter: { status: { eq: 'PENDING' } },
    });
    setRows(pendingRequests(data as RequestRow[]));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(r: RequestRow) {
    if (!r.requestedRole) return;
    setBusy(r.id);
    try {
      await client.mutations.setUserRole({ userId: r.userId, role: r.requestedRole });
      await client.models.AccessRequest.update({
        id: r.id,
        status: 'APPROVED',
        decidedBy: user?.email ?? '',
        decidedAt: new Date().toISOString(),
      });
      // Best-effort mirror update (target user has a profile from sign-in).
      try {
        await client.models.UserProfile.update({
          id: r.userId,
          role: r.requestedRole as 'CONTENT_WRITER' | 'CONTENT_ADMIN',
        });
      } catch {
        // ignore — Cognito group change is the authoritative grant
      }
      load();
    } finally {
      setBusy('');
    }
  }

  async function reject(r: RequestRow) {
    setBusy(r.id);
    try {
      await client.models.AccessRequest.update({
        id: r.id,
        status: 'REJECTED',
        decidedBy: user?.email ?? '',
        decidedAt: new Date().toISOString(),
      });
      load();
    } finally {
      setBusy('');
    }
  }

  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id} className="py-3 text-sm">
          <div className="font-medium">{r.userEmail ?? r.userId}</div>
          <div className="text-gray-600">Wants: {r.requestedRole}</div>
          {r.reason && <div className="text-gray-500">Reason: {r.reason}</div>}
          <div className="mt-1 flex gap-3">
            <button
              disabled={busy === r.id}
              onClick={() => approve(r)}
              className="rounded bg-green-600 px-2 py-1 text-xs text-white"
            >
              Approve
            </button>
            <button
              disabled={busy === r.id}
              onClick={() => reject(r)}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white"
            >
              Reject
            </button>
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="py-3 text-sm text-gray-500">No pending requests.</li>}
    </ul>
  );
}
```

- [ ] **Step 3: Create `src/app/admin/requests/page.tsx`**

```tsx
'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import RequestQueue from '@/components/RequestQueue';
import { canGrantRoles } from '@/lib/roles';

export default function AdminRequestsPage() {
  return (
    <RequireRole allow={canGrantRoles}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Access requests</h2>
        <RequestQueue />
      </div>
    </RequireRole>
  );
}
```

- [ ] **Step 4: Replace `src/app/admin/page.tsx` with a redirect**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/requests');
  }, [router]);
  return <p className="py-8">Redirecting…</p>;
}
```

- [ ] **Step 5: Build & verify**

Run: `npm run build`
Expected: compiles; routes include `/admin`, `/admin/requests`.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminNav.tsx src/components/RequestQueue.tsx src/app/admin/requests/page.tsx src/app/admin/page.tsx && git commit -m "feat(web): add admin request queue and console nav"
```

---

## Task 6: User table with role management

**Files:**
- Create: `src/components/UserTable.tsx`, `src/app/admin/users/page.tsx`

- [ ] **Step 1: Create `src/components/UserTable.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { ASSIGNABLE_ROLES, type Role } from '@/lib/roles';

interface ProfileRow {
  id: string;
  email?: string | null;
  role?: string | null;
}

export default function UserTable() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    const { data } = await client.models.UserProfile.list({});
    setRows(data as ProfileRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(id: string, role: Role) {
    setBusy(id);
    try {
      await client.mutations.setUserRole({ userId: id, role });
      try {
        await client.models.UserProfile.update({
          id,
          role: role as 'READER' | 'CONTENT_WRITER' | 'CONTENT_ADMIN' | 'SYSTEM_ADMIN',
        });
      } catch {
        // ignore — Cognito group change is authoritative
      }
      load();
    } finally {
      setBusy('');
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="py-2">User</th>
          <th className="py-2">Role</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => (
          <tr key={u.id} className="border-b">
            <td className="py-2">{u.email ?? u.id}</td>
            <td className="py-2">
              <select
                disabled={busy === u.id}
                value={(u.role as Role) ?? 'READER'}
                onChange={(e) => changeRole(u.id, e.target.value as Role)}
                className="rounded border p-1"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={2} className="py-3 text-gray-500">No users yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/users/page.tsx`**

```tsx
'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import UserTable from '@/components/UserTable';
import { canGrantRoles } from '@/lib/roles';

export default function AdminUsersPage() {
  return (
    <RequireRole allow={canGrantRoles}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Users</h2>
        <UserTable />
      </div>
    </RequireRole>
  );
}
```

- [ ] **Step 3: Build & verify**

Run: `npm run build`
Expected: compiles; route `/admin/users` present.

- [ ] **Step 4: Commit**

```bash
git add src/components/UserTable.tsx src/app/admin/users/page.tsx && git commit -m "feat(web): add admin user table with role management"
```

---

## Task 7: Moderation — view & restore deleted content

**Files:**
- Create: `src/components/ModerationList.tsx`, `src/app/admin/moderation/page.tsx`

- [ ] **Step 1: Create `src/components/ModerationList.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { deletedItems, restoreStatusForPost, restoreStatusForComment } from '@/lib/access';

interface PostRow {
  id: string;
  title?: string | null;
  status?: string | null;
}
interface CommentRow {
  id: string;
  body?: string | null;
  status?: string | null;
}

export default function ModerationList() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);

  async function load() {
    const { data: p } = await client.models.Post.list({ filter: { status: { eq: 'DELETED' } } });
    const { data: c } = await client.models.Comment.list({ filter: { status: { eq: 'DELETED' } } });
    setPosts(deletedItems(p as PostRow[]));
    setComments(deletedItems(c as CommentRow[]));
  }

  useEffect(() => {
    load();
  }, []);

  async function restorePost(id: string) {
    await client.models.Post.update({ id, status: restoreStatusForPost() });
    load();
  }

  async function restoreComment(id: string) {
    await client.models.Comment.update({ id, status: restoreStatusForComment() });
    load();
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Deleted posts</h2>
        <ul className="divide-y">
          {posts.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>{p.title ?? p.id}</span>
              <button onClick={() => restorePost(p.id)} className="text-blue-600">
                Restore (to draft)
              </button>
            </li>
          ))}
          {posts.length === 0 && <li className="py-2 text-sm text-gray-500">None.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Deleted comments</h2>
        <ul className="divide-y">
          {comments.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate">{c.body ?? c.id}</span>
              <button onClick={() => restoreComment(c.id)} className="ml-3 text-blue-600">
                Restore
              </button>
            </li>
          ))}
          {comments.length === 0 && <li className="py-2 text-sm text-gray-500">None.</li>}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/moderation/page.tsx`**

```tsx
'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import ModerationList from '@/components/ModerationList';
import { canModerate } from '@/lib/roles';

export default function AdminModerationPage() {
  return (
    <RequireRole allow={canModerate}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Moderation</h2>
        <ModerationList />
      </div>
    </RequireRole>
  );
}
```

- [ ] **Step 3: Build & verify**

Run: `npm run build`
Expected: compiles; route `/admin/moderation` present.

- [ ] **Step 4: Commit**

```bash
git add src/components/ModerationList.tsx src/app/admin/moderation/page.tsx && git commit -m "feat(web): add moderation view with restore of deleted content"
```

---

## Task 8: README update + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a Phase 2 section to `README.md`**

Append the following section to the end of `README.md`:
```markdown

## Phase 2 — access & admin

- Users request elevated roles at `/account` (ContentWriter / ContentAdmin).
- System admins manage everything under `/admin`:
  - `/admin/requests` — approve/reject access requests.
  - `/admin/users` — change any user's role.
  - `/admin/moderation` — view and restore soft-deleted posts/comments
    (posts restore to draft, comments to active).
- Roles map to Cognito groups (the authority); `UserProfile` mirrors them for the
  admin user list and is upserted on sign-in.
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all unit tests pass (Phase 1 + access tests).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds; routes include `/account`, `/admin`, `/admin/requests`,
`/admin/users`, `/admin/moderation`.

- [ ] **Step 4: Commit**

```bash
git add README.md && git commit -m "docs: document Phase 2 access and admin features"
```

---

## Self-review — spec coverage

| Spec requirement | Task |
|---|---|
| `AccessRequest` model + auth rules + redeploy | Task 1 |
| Requestable-role logic / filters / restore mapping (TDD) | Task 2 |
| UserProfile populated as display mirror | Task 3 (ensureProfile), Tasks 5–6 (admin updates) |
| Self-service request form (writer/admin, reason) + my-requests on `/account` | Task 4 |
| Request queue: approve (setUserRole + status + mirror) / reject | Task 5 |
| Admin console sub-nav + `/admin` redirect | Task 5 |
| User table with one-click role change (replaces manual box) | Task 6 |
| Moderation: view deleted posts/comments + restore (post→DRAFT, comment→ACTIVE) | Task 7 |
| Role gating: SystemAdmin for requests/users, ContentAdmin+ for moderation | Tasks 5–7 (RequireRole) |
| In-app only (no email) | By construction — no SES anywhere |
| Tests + docs | Tasks 2, 8 |

**Out of scope (per spec):** email notifications, SSR/OpenGraph share previews.
