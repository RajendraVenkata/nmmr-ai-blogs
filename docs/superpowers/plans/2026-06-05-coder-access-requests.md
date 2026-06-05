# Coder Access Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any signed-in user request the orthogonal `Coder` capability from `/account` and let a SystemAdmin approve it from `/admin/requests`, reusing the existing access-request flow.

**Architecture:** Approach A — add `'CODER'` as a value of the existing `AccessRequest.requestedRole` enum. Pure helpers in `src/lib/access.ts` decide what a user may request, how to label it, and whether a request is a Coder request; the form renders those options and the admin queue branches approval to `setCoderAccess` instead of `setUserRole`.

**Tech Stack:** Next.js 14 (client components), Amplify Gen 2 (AppSync/Cognito), vitest.

**Branch:** `coder-access-requests` (already created; spec committed there).

---

## File Structure

- `amplify/data/resource.ts` (modify) — add `'CODER'` to the `AccessRequest.requestedRole` enum.
- `src/lib/access.ts` (modify) — add pure helpers `requestOptions`, `requestLabel`, `isCoderRequest` (+ the `RequestOption` type). One responsibility: the rules and labels for requestable access.
- `tests/access.test.ts` (modify) — unit tests for the three new helpers.
- `src/components/AccessRequestForm.tsx` (modify) — render options from `requestOptions`, submit the selected value.
- `src/components/RequestQueue.tsx` (modify) — branch `approve()` on `isCoderRequest`; label display via `requestLabel`.
- `src/components/MyRequests.tsx` (modify) — label display via `requestLabel`.

No new files. The pure decision/label logic lives in `access.ts` so it is testable in the node vitest environment without rendering components.

---

## Task 1: Add `'CODER'` to the `AccessRequest.requestedRole` enum

No unit test (schema/infra); verify by type-check/build.

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1: Edit the enum** — in `amplify/data/resource.ts`, find the `AccessRequest` model's `requestedRole` field:

```typescript
      requestedRole: a.enum(['CONTENT_WRITER', 'CONTENT_ADMIN']),
```

and change it to:

```typescript
      requestedRole: a.enum(['CONTENT_WRITER', 'CONTENT_ADMIN', 'CODER']),
```

- [ ] **Step 2: Type-check the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: succeeds (no output).

- [ ] **Step 3: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat: allow CODER as an access-request target"
```

> Note for later tasks: the generated client types for `AccessRequest.requestedRole`
> now include `'CODER'`. If a later `npm run build` complains that `'CODER'` is not
> assignable to `requestedRole`, the Amplify schema types are stale — run
> `npx ampx sandbox --once` to regenerate them, then re-run the build.

---

## Task 2: Pure helpers in `access.ts` — `requestLabel` and `isCoderRequest`

**Files:**
- Modify: `src/lib/access.ts`
- Test: `tests/access.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/access.test.ts`. Add `requestLabel` and `isCoderRequest` to the existing import from `'@/lib/access'`, then add:

```typescript
describe('requestLabel', () => {
  it('labels CODER as Coder access', () => {
    expect(requestLabel('CODER')).toBe('Coder access');
  });
  it('labels roles in friendly form', () => {
    expect(requestLabel('CONTENT_WRITER')).toBe('Content Writer');
    expect(requestLabel('CONTENT_ADMIN')).toBe('Content Admin');
  });
  it('passes unknown values through', () => {
    expect(requestLabel('SOMETHING')).toBe('SOMETHING');
  });
});

describe('isCoderRequest', () => {
  it('is true only for CODER', () => {
    expect(isCoderRequest('CODER')).toBe(true);
    expect(isCoderRequest('CONTENT_WRITER')).toBe(false);
    expect(isCoderRequest(null)).toBe(false);
    expect(isCoderRequest(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run tests/access.test.ts`
Expected: FAIL — `requestLabel`/`isCoderRequest` are not exported.

- [ ] **Step 3: Implement** — append to `src/lib/access.ts`:

```typescript
const REQUEST_LABELS: Record<string, string> = {
  CODER: 'Coder access',
  CONTENT_WRITER: 'Content Writer',
  CONTENT_ADMIN: 'Content Admin',
};

export function requestLabel(value: string): string {
  return REQUEST_LABELS[value] ?? value;
}

export function isCoderRequest(requestedRole: string | null | undefined): boolean {
  return requestedRole === 'CODER';
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run tests/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access.ts tests/access.test.ts
git commit -m "feat: add requestLabel and isCoderRequest helpers"
```

---

## Task 3: `requestOptions` helper

Builds the combined list of requestable roles + the Coder option.

**Files:**
- Modify: `src/lib/access.ts`
- Test: `tests/access.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/access.test.ts` (add `requestOptions` to the `'@/lib/access'` import):

```typescript
describe('requestOptions', () => {
  it('offers roles and Coder to a non-coder reader', () => {
    expect(requestOptions('READER', false)).toEqual([
      { value: 'CONTENT_WRITER', label: 'Content Writer' },
      { value: 'CONTENT_ADMIN', label: 'Content Admin' },
      { value: 'CODER', label: 'Coder access' },
    ]);
  });
  it('omits Coder when the user already has it', () => {
    expect(requestOptions('READER', true)).toEqual([
      { value: 'CONTENT_WRITER', label: 'Content Writer' },
      { value: 'CONTENT_ADMIN', label: 'Content Admin' },
    ]);
  });
  it('offers only Coder to a non-coder content admin', () => {
    expect(requestOptions('CONTENT_ADMIN', false)).toEqual([
      { value: 'CODER', label: 'Coder access' },
    ]);
  });
  it('offers nothing to a content admin who is already a coder', () => {
    expect(requestOptions('CONTENT_ADMIN', true)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run tests/access.test.ts`
Expected: FAIL — `requestOptions` is not exported.

- [ ] **Step 3: Implement** — append to `src/lib/access.ts` (it already imports `Role` and defines `requestableRoles` and the new `requestLabel`):

```typescript
export interface RequestOption {
  value: string;
  label: string;
}

export function requestOptions(currentRole: Role, isCoder: boolean): RequestOption[] {
  const options: RequestOption[] = requestableRoles(currentRole).map((r) => ({
    value: r,
    label: requestLabel(r),
  }));
  if (!isCoder) {
    options.push({ value: 'CODER', label: requestLabel('CODER') });
  }
  return options;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run tests/access.test.ts`
Expected: PASS (the whole file, including the pre-existing suites).

- [ ] **Step 5: Commit**

```bash
git add src/lib/access.ts tests/access.test.ts
git commit -m "feat: add requestOptions combining roles and Coder"
```

---

## Task 4: Render Coder option in the request form

**Files:**
- Modify: `src/components/AccessRequestForm.tsx`

No automated test (component); verify by build + the manual check in Task 7.

- [ ] **Step 1: Replace the component** — overwrite `src/components/AccessRequestForm.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { client } from '@/lib/client';
import { requestOptions } from '@/lib/access';
import { canUseContainers } from '@/lib/roles';
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
  const options = requestOptions(user.role, canUseContainers(user.groups));
  const [value, setValue] = useState<string>(options[0]?.value ?? '');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  if (options.length === 0) return null;

  async function submit() {
    if (!value) return;
    if (pendingRoles.includes(value)) {
      setMessage('You already have a pending request for that access.');
      return;
    }
    setMessage('Submitting…');
    try {
      await client.models.AccessRequest.create({
        userId: user.userId,
        userEmail: user.email,
        requestedRole: value as 'CONTENT_WRITER' | 'CONTENT_ADMIN' | 'CODER',
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <textarea
        className="w-full rounded border p-2 text-sm"
        placeholder="Why do you need this access?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button onClick={submit} className="rounded bg-primary px-3 py-1 text-sm text-white">
        Submit request
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds. If `'CODER'` is rejected by the `requestedRole` create type, the schema types are stale — run `npx ampx sandbox --once`, then rebuild (see Task 1 note).

- [ ] **Step 3: Commit**

```bash
git add src/components/AccessRequestForm.tsx
git commit -m "feat: offer Coder access in the request form"
```

---

## Task 5: Branch approval to `setCoderAccess` in the admin queue

**Files:**
- Modify: `src/components/RequestQueue.tsx`

No automated test (component); the branch predicate `isCoderRequest` is unit-tested in Task 2. Verify by build + manual check in Task 7.

- [ ] **Step 1: Update imports** — in `src/components/RequestQueue.tsx`, change the access import line:

```typescript
import { pendingRequests } from '@/lib/access';
```

to:

```typescript
import { pendingRequests, isCoderRequest, requestLabel } from '@/lib/access';
```

- [ ] **Step 2: Replace the `approve` function** — replace the existing `async function approve(r: RequestRow) { ... }` with:

```typescript
  async function approve(r: RequestRow) {
    if (!r.requestedRole) return;
    setBusy(r.id);
    try {
      if (isCoderRequest(r.requestedRole)) {
        await client.mutations.setCoderAccess({ userId: r.userId, enabled: true });
        await client.models.AccessRequest.update({
          id: r.id,
          status: 'APPROVED',
          decidedBy: user?.email ?? '',
          decidedAt: new Date().toISOString(),
        });
        try {
          await client.models.UserProfile.update({ id: r.userId, isCoder: true });
        } catch {
          // ignore — Cognito group change is the authoritative grant
        }
      } else {
        await client.mutations.setUserRole({ userId: r.userId, role: r.requestedRole });
        await client.models.AccessRequest.update({
          id: r.id,
          status: 'APPROVED',
          decidedBy: user?.email ?? '',
          decidedAt: new Date().toISOString(),
        });
        try {
          await client.models.UserProfile.update({
            id: r.userId,
            role: r.requestedRole as 'CONTENT_WRITER' | 'CONTENT_ADMIN',
          });
        } catch {
          // ignore — Cognito group change is the authoritative grant
        }
      }
      await load();
    } finally {
      setBusy('');
    }
  }
```

- [ ] **Step 3: Use the friendly label in the list** — find the line that renders the requested target:

```tsx
          <div className="text-gray-600">Wants: {r.requestedRole}</div>
```

and change it to:

```tsx
          <div className="text-gray-600">Wants: {requestLabel(r.requestedRole ?? '')}</div>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds (`client.mutations.setCoderAccess` and `UserProfile.isCoder` exist from the previous phase).

- [ ] **Step 5: Commit**

```bash
git add src/components/RequestQueue.tsx
git commit -m "feat: approve Coder access requests via setCoderAccess"
```

---

## Task 6: Friendly label in `MyRequests`

**Files:**
- Modify: `src/components/MyRequests.tsx`

- [ ] **Step 1: Edit the component** — in `src/components/MyRequests.tsx`, add the import at the top (below the `'use client';` line):

```tsx
import { requestLabel } from '@/lib/access';
```

and change the line that renders the role:

```tsx
            <span>{r.requestedRole}</span>
```

to:

```tsx
            <span>{requestLabel(r.requestedRole ?? '')}</span>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/MyRequests.tsx
git commit -m "feat: label Coder access requests in the user's request list"
```

---

## Task 7: Full verification + manual check

**Files:** none (verification only).

- [ ] **Step 1: Run the full suite**

Run: `npx vitest run`
Expected: all suites pass (the existing suites plus the new `requestLabel`, `isCoderRequest`, and `requestOptions` cases).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual verification (requires the Amplify sandbox)**

Run the backend and app, then confirm each observation:

1. `SEED_ADMIN_EMAILS="rajendra.venkata@gmail.com" npx ampx sandbox` (regenerates `amplify_outputs.json` with the new enum value) and `npm run dev` in another terminal.
2. Sign in as a **non-Coder** user (e.g. a fresh account / Reader). At `/account`, confirm the "Request access" dropdown includes **Coder access**; submit a Coder request and confirm it appears under "My requests" labelled "Coder access".
3. Sign in as the **SystemAdmin** (seed email). At `/admin/requests`, confirm the request shows "Wants: Coder access"; click **Approve**.
4. Confirm at `/admin/users` that the requester's **Coder** checkbox is now ticked.
5. As the requester, sign out and back in, open a post containing a ` ```terminal ` fence, and confirm the terminal is now launchable (Coder group is in the token).
6. Negative check: as a user who already has Coder, confirm the `/account` dropdown no longer offers "Coder access".

---

## Self-review notes

- **Spec coverage:** schema enum value (Task 1); `requestLabel`/`isCoderRequest` (Task 2); `requestOptions` (Task 3); form offers Coder and hides it for existing Coders (Task 4); approval branch to `setCoderAccess` + `isCoder` mirror (Task 5); friendly labels in queue (Task 5) and `MyRequests` (Task 6); duplicate-pending guard reused unchanged (Task 4); tests for all three pure helpers (Tasks 2–3); manual flow (Task 7). All spec sections map to a task.
- **Type consistency:** `requestOptions(currentRole: Role, isCoder: boolean): RequestOption[]`, `requestLabel(value: string): string`, `isCoderRequest(value: string|null|undefined): boolean` are used with these exact signatures in Tasks 4–6. `requestedRole` create value is cast to `'CONTENT_WRITER' | 'CONTENT_ADMIN' | 'CODER'` consistently.
- **Deferred (not in this plan, per spec):** email notifications, revocation-via-request, auto-approval.
