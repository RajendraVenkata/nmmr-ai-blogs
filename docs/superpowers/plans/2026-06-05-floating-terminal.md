# Floating Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a post mark its terminal fence `float: true` to render one minimizable, bottom-right-docked terminal whose shell stays alive when minimized.

**Architecture:** Extract the xterm + WebSocket + Coder-gating logic from `TerminalEmbed` into a shared `useTerminalSession` hook. `TerminalEmbed` (inline) and a new `FloatingTerminal` (fixed corner panel with minimize-to-pill) both consume it. `parseTerminalFence` gains a `float` flag; `MarkdownView` routes float fences to `FloatingTerminal`.

**Tech Stack:** Next.js 14 client components, `@xterm/xterm`, vitest. No new dependencies.

**Branch:** `floating-terminal` (already created; spec committed there).

---

## File Structure

- `src/lib/terminalEmbed.ts` (modify) — `parseTerminalFence` returns `{ labId, float }`.
- `tests/terminalEmbed.test.ts` (modify) — update shape + add a float case.
- `src/lib/useTerminalSession.ts` (create) — shared connection hook.
- `src/components/TerminalEmbed.tsx` (modify) — thin inline chrome over the hook.
- `src/components/FloatingTerminal.tsx` (create) — fixed corner panel + minimize.
- `src/components/MarkdownView.tsx` (modify) — route float fences to `FloatingTerminal`.

---

## Task 1: `parseTerminalFence` float flag

**Files:** Modify `src/lib/terminalEmbed.ts`, `tests/terminalEmbed.test.ts`.

- [ ] **Step 1: Update the tests** — in `tests/terminalEmbed.test.ts`, the existing cases assert the old shape. Update them and add a float case. Replace the existing `parseTerminalFence` assertions so they read:

```typescript
  it('parses a terminal fence with a valid lab', () => {
    expect(parseTerminalFence('terminal', 'lab: python-basics')).toEqual({ labId: 'python-basics', float: false });
  });
  it('tolerates extra whitespace and lines', () => {
    expect(parseTerminalFence('terminal', '  lab:   node-basics  \n')).toEqual({ labId: 'node-basics', float: false });
  });
```

In the `'networked labs'` describe block, update the two parse cases:

```typescript
  it('parses a networked lab fence', () => {
    expect(parseTerminalFence('terminal', 'lab: python-net')).toEqual({ labId: 'python-net', float: false });
  });
  it('still parses the offline labs', () => {
    expect(parseTerminalFence('terminal', 'lab: python-basics')).toEqual({ labId: 'python-basics', float: false });
  });
```

Then append a new describe block at the end of the file:

```typescript
describe('float flag', () => {
  it('parses float: true', () => {
    expect(parseTerminalFence('terminal', 'lab: python-net\nfloat: true')).toEqual({ labId: 'python-net', float: true });
  });
  it('defaults float to false when absent', () => {
    expect(parseTerminalFence('terminal', 'lab: python-net')?.float).toBe(false);
  });
  it('ignores float on a non-terminal fence', () => {
    expect(parseTerminalFence('python', 'lab: python-net\nfloat: true')).toBeNull();
  });
});
```

(The `null`-returning and `TERMINAL_LABS` label assertions elsewhere in the file are unchanged.)

- [ ] **Step 2: Run, verify failure**

Run: `npx vitest run tests/terminalEmbed.test.ts`
Expected: FAIL — results are missing the `float` field.

- [ ] **Step 3: Implement** — in `src/lib/terminalEmbed.ts`, replace the `parseTerminalFence` function with:

```typescript
/**
 * Decide whether a fenced code block is a terminal embed.
 * Returns the lab to launch and whether it should float, or null for ordinary code.
 */
export function parseTerminalFence(
  lang: string | undefined,
  source: string,
): { labId: LabId; float: boolean } | null {
  if (lang !== 'terminal') return null;
  const match = /^\s*lab:\s*(\S+)\s*$/m.exec(source);
  if (!match) return null;
  const labId = match[1];
  if (!isLabId(labId)) return null;
  const float = /^\s*float:\s*true\s*$/m.test(source);
  return { labId, float };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/terminalEmbed.test.ts` then `npx vitest run`
Expected: PASS (whole suite green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/terminalEmbed.ts tests/terminalEmbed.test.ts
git commit -m "feat: parse a float flag on terminal fences"
```

---

## Task 2: Extract `useTerminalSession` + refactor `TerminalEmbed`

No new automated test (DOM/WebSocket); verify by build + the existing suite. Behavior of inline terminals is unchanged.

**Files:** Create `src/lib/useTerminalSession.ts`. Modify `src/components/TerminalEmbed.tsx`.

- [ ] **Step 1: Create `src/lib/useTerminalSession.ts`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';
import type { LabId } from '@/lib/terminalEmbed';
import '@xterm/xterm/css/xterm.css';

export type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'error';

/** Shared xterm + WebSocket + Coder-gating logic for inline and floating terminals. */
export function useTerminalSession(labId: LabId) {
  const { user, loading } = useCurrentUser();
  const [status, setStatus] = useState<TerminalStatus>('idle');
  const [message, setMessage] = useState('');
  const mountRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<{ dispose: () => void } | null>(null);
  const fitRef = useRef<{ fit: () => void } | null>(null);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, []);

  async function launch() {
    if (!mountRef.current) return;
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

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const term = new Terminal({ cursorBlink: true, fontSize: 13, convertEol: true });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      mountRef.current.innerHTML = '';
      term.open(mountRef.current);
      fitAddon.fit();
      termRef.current = term;
      fitRef.current = fitAddon;

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
      ws.onclose = () => setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      ws.onerror = () => { setStatus('error'); setMessage('Connection failed'); };

      term.onData((d) => { if (ws.readyState === WebSocket.OPEN) ws.send(d); });
      ws.onopen = () => { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); };
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Failed to launch');
    }
  }

  /** Re-fit the terminal to its container (call after a hidden→visible transition). */
  function refit() {
    fitRef.current?.fit();
  }

  const isCoder = !!user && canUseContainers(user.groups);

  return { loading, isCoder, status, message, mountRef, launch, refit };
}
```

- [ ] **Step 2: Replace `src/components/TerminalEmbed.tsx`** with thin inline chrome over the hook:

```tsx
'use client';

import { useTerminalSession } from '@/lib/useTerminalSession';
import { TERMINAL_LABS, type LabId } from '@/lib/terminalEmbed';

export default function TerminalEmbed({ labId }: { labId: LabId }) {
  const { loading, isCoder, status, message, mountRef, launch } = useTerminalSession(labId);
  const label = TERMINAL_LABS[labId];

  if (loading) {
    return <div className="my-4 rounded border bg-gray-50 p-4 text-sm text-gray-500">Loading…</div>;
  }

  if (!isCoder) {
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

- [ ] **Step 3: Build + test**

Run: `npm run build && npx vitest run`
Expected: build succeeds; suite green. Inline terminals render and behave exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/lib/useTerminalSession.ts src/components/TerminalEmbed.tsx
git commit -m "refactor: extract useTerminalSession shared by terminal components"
```

---

## Task 3: `FloatingTerminal` component

No automated test (DOM/WebSocket); verify by build + Task 5 manual.

**Files:** Create `src/components/FloatingTerminal.tsx`.

> Key detail: the panel (and its `mountRef` div) must stay **mounted** when minimized — minimize toggles CSS `display`, it does NOT unmount — so the xterm DOM and WebSocket survive. On restore, call `refit()`.

- [ ] **Step 1: Create `src/components/FloatingTerminal.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTerminalSession } from '@/lib/useTerminalSession';
import { TERMINAL_LABS, type LabId } from '@/lib/terminalEmbed';

export default function FloatingTerminal({ labId }: { labId: LabId }) {
  const { loading, isCoder, status, message, mountRef, launch, refit } = useTerminalSession(labId);
  const [minimized, setMinimized] = useState(false);
  const label = TERMINAL_LABS[labId];

  if (loading) return null;

  function restore() {
    setMinimized(false);
    requestAnimationFrame(() => refit());
  }

  return (
    <>
      {minimized && (
        <button
          onClick={restore}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg"
        >
          ⌨ {label}
        </button>
      )}

      {/* Panel stays mounted; hidden (not unmounted) when minimized so the session persists. */}
      <div
        style={{ display: minimized ? 'none' : 'block' }}
        className="fixed bottom-4 right-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-700 bg-black shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
          <span className="text-xs font-medium text-gray-300">{label} terminal</span>
          <div className="flex items-center gap-2">
            {isCoder && status === 'idle' && (
              <button onClick={launch} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Launch</button>
            )}
            {status === 'connecting' && <span className="text-xs text-gray-400">{message || 'Connecting…'}</span>}
            {isCoder && status === 'error' && (
              <button onClick={launch} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Retry</button>
            )}
            <button
              onClick={() => setMinimized(true)}
              aria-label="Minimize terminal"
              className="px-2 text-lg leading-none text-gray-300 hover:text-white"
            >
              –
            </button>
          </div>
        </div>

        {!isCoder ? (
          <div className="p-3 text-sm text-gray-300">
            Coder access is required to run this terminal.{' '}
            <a href="/account" className="text-indigo-400 underline">Request access</a>.
          </div>
        ) : (
          <>
            {status === 'error' && <p className="px-3 pt-2 text-xs text-red-400">{message}</p>}
            <div ref={mountRef} style={{ height: 320 }} className="p-2" />
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/FloatingTerminal.tsx
git commit -m "feat: add minimizable floating corner terminal"
```

---

## Task 4: Route float fences in `MarkdownView`

**Files:** Modify `src/components/MarkdownView.tsx`.

- [ ] **Step 1: Add the dynamic import** — `MarkdownView.tsx` already imports `TerminalEmbed` via `next/dynamic` with `{ ssr: false }`. Add the same for `FloatingTerminal`, next to it:

```tsx
const FloatingTerminal = dynamic(() => import('@/components/FloatingTerminal'), { ssr: false });
```

- [ ] **Step 2: Route on the flag** — in the `code` component override, the current line is:

```tsx
            if (parsed) return <TerminalEmbed labId={parsed.labId} />;
```

Replace it with:

```tsx
            if (parsed) {
              return parsed.float
                ? <FloatingTerminal labId={parsed.labId} />
                : <TerminalEmbed labId={parsed.labId} />;
            }
```

- [ ] **Step 3: Build + test**

Run: `npm run build && npx vitest run`
Expected: build succeeds; suite green.

- [ ] **Step 4: Commit**

```bash
git add src/components/MarkdownView.tsx
git commit -m "feat: render float fences as a floating terminal"
```

---

## Task 5: Verification + manual check

**Files:** none (verification only).

- [ ] **Step 1: Full automated verification**

```bash
npx vitest run     # green, incl. the float-flag cases
npm run build      # succeeds
```

- [ ] **Step 2: Manual check (requires the relay running + a Coder account)**

1. Edit a post's fence to include `float: true` (e.g. the sample post `blogs/try-it-live-embedded-terminals.post.md`, then re-run `./blogs/upload-post.sh --id <existing-id> <file>` to update it — or test locally with the sandbox).
2. View the post as a Coder: confirm the terminal **docks bottom-right** (not inline), **Launch** connects, and you can run a command.
3. Click **–** (minimize): it collapses to a corner **pill**. Click the pill: it **restores** with the terminal re-fitted and the session intact (the command output from before is still there).
4. View as a non-Coder / signed out: confirm the panel shows the "Coder access required" placeholder.
5. Confirm a normal (non-float) post still renders an **inline** terminal, unchanged.

---

## Self-review notes

- **Spec coverage:** `float` flag parsing (Task 1); shared `useTerminalSession` hook + `TerminalEmbed` refactor with unchanged inline behavior (Task 2); `FloatingTerminal` fixed bottom-right, minimize-to-pill, session-preserving (Task 3); `MarkdownView` routes float → floating (Task 4); tests for the flag; manual incl. minimize/restore-with-session and non-Coder placeholder (Task 5). All spec sections map to a task.
- **Type consistency:** `parseTerminalFence` returns `{ labId: LabId; float: boolean }` (Task 1), consumed in `MarkdownView` as `parsed.float` / `parsed.labId` (Task 4). `useTerminalSession(labId): { loading, isCoder, status, message, mountRef, launch, refit }` (Task 2) consumed by `TerminalEmbed` (Task 2) and `FloatingTerminal` (Task 3); only `FloatingTerminal` uses `refit`.
- **Deferred (per spec):** dragging/resizing, position persistence, multiple floating terminals, corner picker, close-and-destroy button.
```
