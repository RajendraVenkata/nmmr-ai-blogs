# Coder Terminals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `Coder`-group user open a published blog post containing a ` ```terminal ` fence, click Launch, and get their own live Docker shell (xterm.js) wired to the existing `nmmr-terminal` relay.

**Architecture:** A new orthogonal `Coder` Cognito group gates access. A server-side Next.js route mints a short-lived HS256 JWT from the authenticated Cognito session (readable server-side because Amplify is configured with `ssr: true`, i.e. cookie token storage), signed with a secret shared with the relay. A markdown `terminal` fence is rendered as an xterm.js client component that fetches that token and opens a WebSocket to the relay. The relay gains a lab allowlist.

**Tech Stack:** Next.js 14 (App Router), Amplify Gen 2 (Cognito, AppSync, Lambda), `jsonwebtoken`, `@xterm/xterm` + `@xterm/addon-fit`, vitest (blog), Node `node:test` + `ts-node` (relay).

**Repos:** `nmmr-ai-blogs` (this repo, paths relative to its root) and `nmmr-terminal` (sibling at `../nmmr-terminal`, called out explicitly in Task 10).

---

## File Structure

**`nmmr-ai-blogs`:**
- `src/lib/roles.ts` (modify) — add `canUseContainers`.
- `src/lib/terminalEmbed.ts` (create) — pure fence parser + lab catalog. One responsibility: decide if a code fence is a terminal and which lab.
- `src/lib/terminalToken.ts` (create) — pure authorization + token-mint decision. One responsibility: given session facts, decide HTTP status and optionally mint the JWT.
- `src/app/api/terminal-token/route.ts` (create) — thin HTTP wrapper that fetches the Cognito session and delegates to `terminalToken.ts`.
- `src/components/TerminalEmbed.tsx` (create) — client xterm.js widget + connection lifecycle.
- `src/components/MarkdownView.tsx` (modify) — route `terminal` fences to `TerminalEmbed`.
- `src/lib/useCurrentUser.ts` (modify) — expose raw `groups` so the embed can check `Coder`.
- `src/components/UserTable.tsx` (modify) — per-user Coder toggle.
- `amplify/auth/resource.ts` (modify) — add `Coder` group.
- `amplify/data/resource.ts` (modify) — add `isCoder` to `UserProfile`, add `setCoderAccess` mutation.
- `amplify/functions/set-coder-access/{resource.ts,handler.ts}` (create) — Cognito group mutator.
- `amplify/backend.ts` (modify) — wire the new function (policy + env).
- Tests: `tests/terminalEmbed.test.ts`, `tests/terminalToken.test.ts`, additions to `tests/roles.test.ts`.

**`nmmr-terminal`:**
- `src/lab-allowlist.ts` (create) — pure allowlist helper.
- `src/lab-allowlist.test.ts` (create) — node:test.
- `src/server.ts` (modify) — reject disallowed labs.
- `package.json` (modify) — add `test` script.

---

## Task 1: Add dependencies and regenerate the lockfile

Do this first — later tasks import `jsonwebtoken` and `@xterm/*`.

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install jsonwebtoken @xterm/xterm @xterm/addon-fit
npm install -D @types/jsonwebtoken
```

- [ ] **Step 2: Regenerate and verify the lockfile (Amplify `npm ci` gotcha)**

```bash
npm install --package-lock-only
npm ci
```
Expected: `npm ci` completes with no "can only install packages when ... in sync" error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add jsonwebtoken and xterm.js deps for coder terminals"
```

---

## Task 2: `canUseContainers` role helper

**Files:**
- Modify: `src/lib/roles.ts`
- Test: `tests/roles.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/roles.test.ts`)

```typescript
import { canUseContainers } from '@/lib/roles';

describe('canUseContainers', () => {
  it('is true when the Coder group is present', () => {
    expect(canUseContainers(['Coder'])).toBe(true);
    expect(canUseContainers(['ContentWriter', 'Coder'])).toBe(true);
  });
  it('is false without the Coder group', () => {
    expect(canUseContainers([])).toBe(false);
    expect(canUseContainers(['SystemAdmin'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run tests/roles.test.ts`
Expected: FAIL — `canUseContainers is not a function`.

- [ ] **Step 3: Implement** (append to `src/lib/roles.ts`)

```typescript
export const CODER_GROUP = 'Coder';

export function canUseContainers(groups: string[]): boolean {
  return groups.includes(CODER_GROUP);
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roles.ts tests/roles.test.ts
git commit -m "feat: add canUseContainers role helper"
```

---

## Task 3: `terminalEmbed` fence parser + lab catalog

**Files:**
- Create: `src/lib/terminalEmbed.ts`
- Test: `tests/terminalEmbed.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/terminalEmbed.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { parseTerminalFence, TERMINAL_LABS } from '@/lib/terminalEmbed';

describe('parseTerminalFence', () => {
  it('parses a terminal fence with a valid lab', () => {
    expect(parseTerminalFence('terminal', 'lab: python-basics')).toEqual({ labId: 'python-basics' });
  });
  it('tolerates extra whitespace and lines', () => {
    expect(parseTerminalFence('terminal', '  lab:   node-basics  \n')).toEqual({ labId: 'node-basics' });
  });
  it('returns null for a non-terminal language', () => {
    expect(parseTerminalFence('python', 'lab: python-basics')).toBeNull();
  });
  it('returns null for an unknown lab', () => {
    expect(parseTerminalFence('terminal', 'lab: rust-basics')).toBeNull();
  });
  it('returns null when no lab line is present', () => {
    expect(parseTerminalFence('terminal', 'echo hi')).toBeNull();
  });
  it('exposes a display label per lab', () => {
    expect(TERMINAL_LABS['linux-basics']).toBe('Linux');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run tests/terminalEmbed.test.ts`
Expected: FAIL — cannot find module `@/lib/terminalEmbed`.

- [ ] **Step 3: Implement** (`src/lib/terminalEmbed.ts`)

```typescript
// Lab IDs are the relay's container keys (see nmmr-terminal DEFAULT_LABS).
export const TERMINAL_LABS = {
  'python-basics': 'Python',
  'node-basics': 'Node.js',
  'linux-basics': 'Linux',
} as const;

export type LabId = keyof typeof TERMINAL_LABS;

export const ALLOWED_LAB_IDS = Object.keys(TERMINAL_LABS) as LabId[];

function isLabId(value: string): value is LabId {
  return (ALLOWED_LAB_IDS as string[]).includes(value);
}

/**
 * Decide whether a fenced code block is a terminal embed.
 * Returns the lab to launch, or null to render the block as ordinary code.
 */
export function parseTerminalFence(lang: string | undefined, source: string): { labId: LabId } | null {
  if (lang !== 'terminal') return null;
  const match = /^\s*lab:\s*(\S+)\s*$/m.exec(source);
  if (!match) return null;
  const labId = match[1];
  return isLabId(labId) ? { labId } : null;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/terminalEmbed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/terminalEmbed.ts tests/terminalEmbed.test.ts
git commit -m "feat: add terminal fence parser and lab catalog"
```

---

## Task 4: `terminalToken` authorization + mint helper

**Files:**
- Create: `src/lib/terminalToken.ts`
- Test: `tests/terminalToken.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/terminalToken.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { authorizeTerminalRequest } from '@/lib/terminalToken';

const SECRET = 'test-secret';
const base = { sub: 'user-1', email: 'u@example.com', secret: SECRET };

describe('authorizeTerminalRequest', () => {
  it('401 when there is no authenticated subject', () => {
    const r = authorizeTerminalRequest({ ...base, sub: undefined, groups: ['Coder'], labId: 'python-basics' });
    expect(r.status).toBe(401);
  });
  it('403 when the user is not a Coder', () => {
    const r = authorizeTerminalRequest({ ...base, groups: ['ContentWriter'], labId: 'python-basics' });
    expect(r.status).toBe(403);
  });
  it('400 for an unknown lab', () => {
    const r = authorizeTerminalRequest({ ...base, groups: ['Coder'], labId: 'rust-basics' });
    expect(r.status).toBe(400);
  });
  it('500 when the signing secret is missing', () => {
    const r = authorizeTerminalRequest({ ...base, secret: '', groups: ['Coder'], labId: 'python-basics' });
    expect(r.status).toBe(500);
  });
  it('200 with a 5-minute token carrying the right claims', () => {
    const r = authorizeTerminalRequest({ ...base, groups: ['Coder'], labId: 'python-basics' });
    expect(r.status).toBe(200);
    const decoded = jwt.verify(r.body.token as string, SECRET) as Record<string, unknown>;
    expect(decoded.id).toBe('user-1');
    expect(decoded.email).toBe('u@example.com');
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(300);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run tests/terminalToken.test.ts`
Expected: FAIL — cannot find module `@/lib/terminalToken`.

- [ ] **Step 3: Implement** (`src/lib/terminalToken.ts`)

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

export function authorizeTerminalRequest(input: TerminalAuthInput): TerminalAuthResult {
  if (!input.sub) return { status: 401, body: { error: 'Unauthenticated' } };
  if (!canUseContainers(input.groups)) return { status: 403, body: { error: 'Coder access required' } };
  if (!input.labId || !(ALLOWED_LAB_IDS as string[]).includes(input.labId)) {
    return { status: 400, body: { error: 'Unknown lab' } };
  }
  if (!input.secret) return { status: 500, body: { error: 'Server misconfigured' } };

  const token = jwt.sign(
    { id: input.sub, email: input.email ?? '', role: roleFromGroups(input.groups) },
    input.secret,
    { expiresIn: '5m' },
  );
  return { status: 200, body: { token } };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/terminalToken.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/terminalToken.ts tests/terminalToken.test.ts
git commit -m "feat: add terminal token authorization helper"
```

---

## Task 5: Backend — Coder group, isCoder field, setCoderAccess function

No unit test (Cognito/AppSync infra); verify by type-check. Steps show complete code.

**Files:**
- Modify: `amplify/auth/resource.ts`, `amplify/data/resource.ts`, `amplify/backend.ts`
- Create: `amplify/functions/set-coder-access/resource.ts`, `amplify/functions/set-coder-access/handler.ts`

- [ ] **Step 1: Add the `Coder` group** — in `amplify/auth/resource.ts`, change the `groups` line to:

```typescript
  groups: ['SystemAdmin', 'ContentAdmin', 'ContentWriter', 'Coder'],
```

- [ ] **Step 2: Add `isCoder` and the `setCoderAccess` mutation** — in `amplify/data/resource.ts`:

In the `UserProfile` model, add `isCoder` alongside the existing fields:

```typescript
      status: a.enum(['ACTIVE', 'DELETED']),
      isCoder: a.boolean(),
```

Add the mutation to the schema (next to `setUserRole`), and the import at the top:

```typescript
import { setCoderAccess } from '../functions/set-coder-access/resource';
```

```typescript
  setCoderAccess: a
    .mutation()
    .arguments({ userId: a.string().required(), enabled: a.boolean().required() })
    .returns(a.json())
    .authorization((allow) => [allow.groups(['SystemAdmin'])])
    .handler(a.handler.function(setCoderAccess)),
```

- [ ] **Step 3: Create the function resource** (`amplify/functions/set-coder-access/resource.ts`)

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const setCoderAccess = defineFunction({
  name: 'set-coder-access',
  resourceGroupName: 'data',
});
```

- [ ] **Step 4: Create the function handler** (`amplify/functions/set-coder-access/handler.ts`)

```typescript
import type { Schema } from '../../data/resource';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();
const CODER_GROUP = 'Coder';

export const handler: Schema['setCoderAccess']['functionHandler'] = async (event) => {
  const { userId, enabled } = event.arguments;
  const userPoolId = process.env.USER_POOL_ID as string;

  const command = enabled
    ? new AdminAddUserToGroupCommand({ GroupName: CODER_GROUP, Username: userId as string, UserPoolId: userPoolId })
    : new AdminRemoveUserFromGroupCommand({ GroupName: CODER_GROUP, Username: userId as string, UserPoolId: userPoolId });

  await client.send(command);
  return JSON.stringify({ userId, isCoder: enabled });
};
```

- [ ] **Step 5: Wire the function in `amplify/backend.ts`**

Add the import:

```typescript
import { setCoderAccess } from './functions/set-coder-access/resource';
```

Add `setCoderAccess` to `defineBackend`:

```typescript
const backend = defineBackend({ auth, data, storage, setUserRole, setCoderAccess });
```

After the existing `setUserRole` policy/env block, add:

```typescript
backend.setCoderAccess.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminRemoveUserFromGroup'],
    resources: [userPool.userPoolArn],
  }),
);

backend.setCoderAccess.addEnvironment('USER_POOL_ID', userPool.userPoolId);
```

- [ ] **Step 6: Type-check the backend and the app**

Run: `npx tsc --noEmit -p amplify/tsconfig.json && npm run build`
Expected: both succeed (the build regenerates Amplify types so `client.mutations.setCoderAccess` exists).

> Note: if `npm run build` cannot reach the generated `Schema` types for the new mutation, run `npx ampx sandbox --once` first to regenerate `amplify_outputs.json` and the schema types, then re-run.

- [ ] **Step 7: Commit**

```bash
git add amplify/
git commit -m "feat: add Coder group, isCoder field, and setCoderAccess function"
```

---

## Task 6: `/api/terminal-token` route handler

**Files:**
- Create: `src/app/api/terminal-token/route.ts`

No automated test (depends on Amplify server context); the decision logic is already covered by Task 4. Verify by type-check/build and the manual e2e in Task 11.

- [ ] **Step 1: Implement the route** (`src/app/api/terminal-token/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { authorizeTerminalRequest } from '@/lib/terminalToken';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const labId: string | undefined = body?.labId;

  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const payload = session?.tokens?.idToken?.payload as Record<string, unknown> | undefined;
  const groups = (payload?.['cognito:groups'] as string[] | undefined) ?? [];

  const result = authorizeTerminalRequest({
    sub: payload?.sub as string | undefined,
    email: payload?.email as string | undefined,
    groups,
    labId,
    secret: process.env.TERMINAL_JWT_SECRET,
  });

  return NextResponse.json(result.body, { status: result.status });
}
```

- [ ] **Step 2: Type-check / build**

Run: `npm run build`
Expected: build succeeds, route compiled under `/api/terminal-token`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/terminal-token/route.ts
git commit -m "feat: add terminal-token mint route"
```

---

## Task 7: Expose `groups` from `useCurrentUser`

**Files:**
- Modify: `src/lib/useCurrentUser.ts`

- [ ] **Step 1: Add `groups` to the interface** — in `src/lib/useCurrentUser.ts`, extend `CurrentUser`:

```typescript
export interface CurrentUser {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: Role;
  groups: string[];
}
```

- [ ] **Step 2: Populate it** — in `load()`, where `next` is built, add the `groups` field:

```typescript
      const next: CurrentUser = {
        userId: current.userId,
        username: current.username,
        email,
        name: displayNameFrom({
          name: payload.name as string | undefined,
          givenName: payload.given_name as string | undefined,
          email,
        }),
        role: roleFromGroups(groups),
        groups,
      };
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/useCurrentUser.ts
git commit -m "feat: expose cognito groups from useCurrentUser"
```

---

## Task 8: `TerminalEmbed` client component

**Files:**
- Create: `src/components/TerminalEmbed.tsx`

No automated test (DOM/WebSocket/xterm); verified by the manual e2e in Task 11.

- [ ] **Step 1: Implement the component** (`src/components/TerminalEmbed.tsx`)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';
import { TERMINAL_LABS, type LabId } from '@/lib/terminalEmbed';
import '@xterm/xterm/css/xterm.css';

type Status = 'idle' | 'connecting' | 'connected' | 'error';

export default function TerminalEmbed({ labId }: { labId: LabId }) {
  const { user, loading } = useCurrentUser();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const mountRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  async function launch() {
    if (!mountRef.current) return;
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

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const term = new Terminal({ cursorBlink: true, fontSize: 13, convertEol: true });
      const fit = new FitAddon();
      term.loadAddon(fit);
      mountRef.current.innerHTML = '';
      term.open(mountRef.current);
      fit.fit();

      const base = process.env.NEXT_PUBLIC_TERMINAL_WS_URL ?? 'ws://localhost:8080';
      const ws = new WebSocket(`${base}?token=${encodeURIComponent(token)}&labId=${encodeURIComponent(labId)}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'ready') { setStatus('connected'); setMessage(''); }
            else if (msg.type === 'error') { setStatus('error'); setMessage(msg.message ?? 'Error'); }
            else if (msg.type === 'system') { term.writeln(`\r\n\x1b[33m${msg.message}\x1b[0m`); }
            // activity_ack / pong: ignore
            return;
          } catch {
            term.write(ev.data);
            return;
          }
        }
        term.write(new Uint8Array(ev.data as ArrayBuffer));
      };
      ws.onclose = () => { if (status !== 'error') setStatus('idle'); };
      ws.onerror = () => { setStatus('error'); setMessage('Connection failed'); };

      term.onData((d) => { if (ws.readyState === WebSocket.OPEN) ws.send(d); });
      ws.onopen = () => { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); };
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Failed to launch');
    }
  }

  const label = TERMINAL_LABS[labId];

  if (loading) {
    return <div className="my-4 rounded border bg-gray-50 p-4 text-sm text-gray-500">Loading…</div>;
  }

  if (!user || !canUseContainers(user.groups)) {
    return (
      <div className="my-4 rounded border bg-gray-50 p-4 text-sm">
        <p className="font-medium">{label} terminal</p>
        <p className="mt-1 text-gray-600">
          Coder access is required to run this terminal.{' '}
          <a href="/account" className="text-indigo-600 underline">Request access</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 rounded border bg-black p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-gray-300">{label} terminal</span>
        {status === 'idle' && (
          <button onClick={launch} className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
            Launch
          </button>
        )}
        {status === 'connecting' && <span className="text-xs text-gray-400">{message || 'Connecting…'}</span>}
        {status === 'error' && (
          <button onClick={launch} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white">
            Retry
          </button>
        )}
      </div>
      {status === 'error' && <p className="px-1 pb-2 text-xs text-red-400">{message}</p>}
      <div ref={mountRef} style={{ minHeight: status === 'idle' ? 0 : 300 }} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check / build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/TerminalEmbed.tsx
git commit -m "feat: add TerminalEmbed xterm.js component"
```

---

## Task 9: Route `terminal` fences to `TerminalEmbed` in `MarkdownView`

**Files:**
- Modify: `src/components/MarkdownView.tsx`

- [ ] **Step 1: Replace the file body** (`src/components/MarkdownView.tsx`)

```tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '@/lib/sanitize';
import { parseTerminalFence } from '@/lib/terminalEmbed';
import TerminalEmbed from '@/components/TerminalEmbed';

export default function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          code({ className, children, ...props }) {
            const lang = /language-(\w+)/.exec(className || '')?.[1];
            const parsed = parseTerminalFence(lang, String(children));
            if (parsed) return <TerminalEmbed labId={parsed.labId} />;
            return <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
```

> Note: react-markdown wraps block code in `<pre>`, so a terminal embed renders inside a `<pre>`. The `prose` styles add padding/background there; if it looks boxed-in during e2e, override by also supplying a `pre` component that returns `<>{children}</>` when its child is a terminal fence. Defer unless e2e shows a problem.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/MarkdownView.tsx
git commit -m "feat: render terminal fences as live terminals"
```

---

## Task 10: Admin Coder toggle in `UserTable`

**Files:**
- Modify: `src/components/UserTable.tsx`

- [ ] **Step 1: Add `isCoder` to the row type and Coder column** — replace `src/components/UserTable.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { ASSIGNABLE_ROLES, type Role } from '@/lib/roles';

interface ProfileRow {
  id: string;
  email?: string | null;
  role?: string | null;
  isCoder?: boolean | null;
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
      await load();
    } finally {
      setBusy('');
    }
  }

  async function toggleCoder(id: string, enabled: boolean) {
    setBusy(id);
    try {
      await client.mutations.setCoderAccess({ userId: id, enabled });
      try {
        await client.models.UserProfile.update({ id, isCoder: enabled });
      } catch {
        // ignore — Cognito group change is authoritative
      }
      await load();
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
          <th className="py-2">Coder</th>
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
            <td className="py-2">
              <input
                type="checkbox"
                disabled={busy === u.id}
                checked={!!u.isCoder}
                onChange={(e) => toggleCoder(u.id, e.target.checked)}
              />
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className="py-3 text-gray-500">No users yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds (`client.mutations.setCoderAccess` resolves via the regenerated schema types from Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/components/UserTable.tsx
git commit -m "feat: add Coder access toggle to admin user table"
```

---

## Task 11: Relay lab allowlist (`nmmr-terminal`)

All paths in this task are relative to the **`nmmr-terminal`** repo (`../nmmr-terminal` from this repo).

**Files:**
- Create: `src/lab-allowlist.ts`, `src/lab-allowlist.test.ts`
- Modify: `src/server.ts`, `package.json`

- [ ] **Step 1: Add a `test` script** — in `package.json`, add to `scripts`:

```json
    "test": "node --test -r ts-node/register src/lab-allowlist.test.ts",
```

- [ ] **Step 2: Write the failing test** (`src/lab-allowlist.test.ts`)

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedLab, getAllowedLabs } from './lab-allowlist';

test('default allowlist contains the three known labs', () => {
  const labs = getAllowedLabs();
  assert.ok(labs.includes('python-basics'));
  assert.ok(labs.includes('node-basics'));
  assert.ok(labs.includes('linux-basics'));
});

test('isAllowedLab accepts known labs and rejects unknown', () => {
  const labs = getAllowedLabs();
  assert.equal(isAllowedLab('python-basics', labs), true);
  assert.equal(isAllowedLab('rust-basics', labs), false);
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./lab-allowlist`.

- [ ] **Step 4: Implement** (`src/lab-allowlist.ts`)

```typescript
const DEFAULT_ALLOWED = ['python-basics', 'node-basics', 'linux-basics'];

/** Allowed lab IDs, overridable via the ALLOWED_LABS env (comma-separated). */
export function getAllowedLabs(): string[] {
  const env = process.env.ALLOWED_LABS;
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean);
  return DEFAULT_ALLOWED;
}

export function isAllowedLab(labId: string, allowed: string[]): boolean {
  return allowed.includes(labId);
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Enforce the allowlist in `src/server.ts`**

Add the import near the other imports:

```typescript
import { isAllowedLab, getAllowedLabs } from "./lab-allowlist";
```

Immediately after the existing `if (!labId) { … ws.close(4002, "Missing labId"); return; }` block, add:

```typescript
  // Reject labs that are not on the allowlist
  if (!isAllowedLab(labId, getAllowedLabs())) {
    ws.send(JSON.stringify({ type: "error", message: `Unknown lab: ${labId}` }));
    ws.close(4009, "Lab not allowed");
    return;
  }
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: `tsc` succeeds (creates `dist/`).

- [ ] **Step 8: Commit**

```bash
git add src/lab-allowlist.ts src/lab-allowlist.test.ts src/server.ts package.json
git commit -m "feat: restrict terminal sessions to an allowlist of labs"
```

---

## Task 12: Configuration, docs, and manual end-to-end verification

**Files:**
- Modify: `README.md` (this repo) and `../nmmr-terminal/.env.example`

- [ ] **Step 1: Local env for the blog** — create/append `.env.local` in this repo (gitignored):

```bash
TERMINAL_JWT_SECRET=dev-shared-secret-change-me
NEXT_PUBLIC_TERMINAL_WS_URL=ws://localhost:8080
```

- [ ] **Step 2: Match the secret in the relay** — in `../nmmr-terminal/.env` set the same value:

```bash
JWT_SECRET=dev-shared-secret-change-me
PORT=8080
```

Document it in `../nmmr-terminal/.env.example` by adding a comment line under `JWT_SECRET`:

```bash
# JWT_SECRET must also equal nmmr-ai-blogs' TERMINAL_JWT_SECRET (coder terminals)
```

- [ ] **Step 3: Document the feature** — add a section to this repo's `README.md`:

```markdown
## Coder terminals

Posts can embed a live Docker shell with a fenced block:

    ```terminal
    lab: python-basics
    ```

Valid labs: `python-basics`, `node-basics`, `linux-basics`. Only users in the
`Coder` Cognito group see a live terminal (others see a request-access prompt);
SystemAdmins grant Coder access at `/admin/users`. The browser fetches a 5-minute
token from `/api/terminal-token` (signed with `TERMINAL_JWT_SECRET`, which must equal
the relay's `JWT_SECRET`) and connects to `NEXT_PUBLIC_TERMINAL_WS_URL`. Containers
run with networking disabled, so package installs are not available yet.
```

- [ ] **Step 4: Commit docs**

```bash
git add README.md
git commit -m "docs: document coder terminals setup"
cd ../nmmr-terminal && git add .env.example && git commit -m "docs: note shared JWT secret for coder terminals" && cd -
```

- [ ] **Step 5: Manual end-to-end verification**

Run these and confirm each observation:

1. **Relay + Docker** (in `../nmmr-terminal`): build the three lab images per its README, then `npm run build && npm start`. Confirm `curl http://localhost:8080/health` returns `{"status":"ok",...}`.
2. **Blog backend**: `SEED_ADMIN_EMAILS="rajendra.venkata@gmail.com" npx ampx sandbox` (regenerates `amplify_outputs.json` with the `Coder` group and `setCoderAccess`).
3. **Blog app**: `npm run dev`, sign in as the seed admin.
4. **Grant Coder**: at `/admin/users`, tick the Coder checkbox for your own user. Sign out and back in so the new group is in your token.
5. **Author a post**: create/publish a post whose body contains a ` ```terminal ` fence with `lab: python-basics`.
6. **Launch**: open the post → click **Launch** → a terminal appears; run `python hello.py` and confirm it prints `Hello from NMMR Training!`.
7. **Negative check**: open the same post in a private window (signed out) → confirm the "Coder access required" placeholder shows instead of a terminal.
8. **Allowlist check**: temporarily change the fence to `lab: rust-basics`, reload → confirm the embed renders as a normal code block (parser rejects it), and that a direct WS attempt with a bad lab is closed by the relay.

- [ ] **Step 6: Final test sweep**

```bash
npm test            # blog: all vitest suites green
cd ../nmmr-terminal && npm test && cd -   # relay: allowlist tests green
```

---

## Self-review notes

- **Spec coverage:** Coder group/`canUseContainers` (T2, T5); orthogonal grant via `setCoderAccess` + admin toggle (T5, T10); HS256 mint route + 401/403/400/200 (T4, T6); fenced-`terminal` → `TerminalEmbed` (T3, T8, T9); per-user container reuses existing relay behavior (no change needed); relay allowlist + test (T11); secrets/`ssr:true` cookie session, lockfile gotcha, deferred items all addressed (T1, T6, T12). All spec sections map to a task.
- **Deferred (not in this plan, per spec):** Coder access-request flow, "my containers" management view, Cognito-native relay auth, networked/multi-lab containers.
