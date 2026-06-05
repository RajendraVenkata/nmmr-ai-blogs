# Floating Terminal — a minimizable, corner-docked terminal for a post

**Date:** 2026-06-05
**Status:** Approved (design)
**Repo:** `nmmr-ai-blogs`
**Builds on:** [2026-06-05-coder-terminals-design.md](2026-06-05-coder-terminals-design.md)

## Summary

Let a post mark its terminal fence as **floating** so the terminal docks in the
bottom-right corner of the page instead of rendering inline. The reader can **minimize**
it to a small pill and re-expand it; the shell session stays alive while minimized, so
they can read the post, pop the terminal open to run a command, and minimize it again.
Author opts in with a `float: true` line in the fence; the panel is fixed in the
bottom-right (no dragging).

## Context

Today a ` ```terminal ` fence with `lab: <id>` renders an inline `TerminalEmbed`
(`src/components/TerminalEmbed.tsx`): it reads the Cognito idToken, opens
`wss://…?token=&labId=`, and pipes an xterm.js terminal. `MarkdownView.tsx` routes the
fence to that component via `parseTerminalFence` (`src/lib/terminalEmbed.ts`). The
auth/connection path is unchanged by this feature — only the **presentation** differs.

`TerminalEmbed` currently mixes the connection logic (idToken → xterm → WebSocket →
status/cleanup) with its inline chrome. The floating variant needs the same connection
logic, so this is the moment to extract that logic into a shared hook rather than
duplicate it.

## Design

### 1. Fence parsing — `src/lib/terminalEmbed.ts`

`parseTerminalFence(lang, source)` returns `{ labId: LabId; float: boolean }` (was
`{ labId }`). It parses an optional `float:` line; `float: true` → `true`, otherwise
`false`. A fence is still only a terminal when `lang === 'terminal'` and the `lab:` line
names an allowed lab.

```
```terminal
lab: python-net
float: true
```
```

### 2. Shared session hook — `src/lib/useTerminalSession.ts` (new)

Extract the connection logic into a hook so the inline and floating components share it:

`useTerminalSession(labId: LabId)` returns:
- `loading: boolean`, `isCoder: boolean` (from `useCurrentUser` + `canUseContainers`),
- `status: 'idle' | 'connecting' | 'connected' | 'error'`, `message: string`,
- `mountRef: RefObject<HTMLDivElement>` (where xterm attaches),
- `launch(): Promise<void>` (the current `TerminalEmbed.launch` body — fetch the
  session idToken, dynamic-import xterm + fit addon, open the WebSocket, wire
  control/data frames and status),
- `refit(): void` (re-fit the terminal to its container; used on restore).

The hook owns the cleanup effect (close the WebSocket, `dispose()` the terminal on
unmount) and keeps `termRef` / `fitRef` / `wsRef` internally.

### 3. `TerminalEmbed.tsx` — refactor to the hook

`TerminalEmbed` becomes thin inline chrome over `useTerminalSession`: the bordered box,
the lab label, the Launch/Retry button and status line, and the "Coder access required"
placeholder for non-Coders. Behavior and appearance are unchanged for existing inline
terminals.

### 4. `FloatingTerminal.tsx` — new

Uses `useTerminalSession(labId)` and renders a `position: fixed` panel in the
bottom-right (`z-50`, ~480×320, capped to the viewport on small screens). Local state
`minimized: boolean` (default `false`).

- **Expanded:** a header bar (lab label + a **minimize (–)** button) over the body. The
  body is the xterm `mountRef` plus the Launch/Retry/status controls, or the non-Coder
  placeholder (same copy as inline).
- **Minimized:** the body is hidden with CSS (`display: none`) — the component stays
  mounted so the WebSocket and shell **persist** — and a small **pill** ("⌨ <lab>")
  shows in the corner. Clicking the pill sets `minimized = false` and calls `fit()` so
  the terminal re-lays-out to the now-visible container.

Minimize never tears down the session; only unmount (navigating away) does, via the
hook's cleanup.

### 5. Wiring — `src/components/MarkdownView.tsx`

In the `code` renderer, after `parseTerminalFence`: if `parsed.float` is true render
`<FloatingTerminal labId={parsed.labId} />`, else `<TerminalEmbed labId={parsed.labId} />`.
Because the floating panel is `fixed`, it pins to the corner regardless of where the
fence sits in the document, and the fence location takes no inline space.

**Contract:** one `float: true` fence per post. A second floating fence would mount a
second fixed panel overlapping the first — treated as author error, not enforced in code
(YAGNI).

## Data flow

Identical to the inline terminal: `FloatingTerminal` → `useTerminalSession` reads the
Cognito idToken from `fetchAuthSession()` → opens `wss://<NEXT_PUBLIC_TERMINAL_WS_URL>?
token=&labId=` → the relay verifies the token and enforces `Coder` → streams to xterm.
The only differences are the fixed-corner chrome and that minimizing preserves the live
session.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Not signed in / not a Coder | The floating panel shows the "Coder access required → request access" placeholder (discoverable but inert) |
| Connect / at-capacity / expired | Shown in the panel with a Retry button (same as inline) |
| Minimize while connected | Body hidden; WebSocket + shell stay alive; restore calls `fit()` |

## Testing

- **Vitest (`tests/terminalEmbed.test.ts`):** `parseTerminalFence('terminal', 'lab: python-net\nfloat: true')`
  → `{ labId: 'python-net', float: true }`; a fence without a `float` line →
  `{ labId, float: false }`; existing fence/label assertions updated to the new shape; a
  non-terminal language still returns `null`.
- The hook, `TerminalEmbed` refactor, and `FloatingTerminal` are DOM/WebSocket — verified
  by build plus manual.
- **Manual:** set the sample post's fence to `float: true`, view it as a Coder: confirm
  the terminal docks bottom-right, Launch connects, **minimize** collapses it to a corner
  pill, the pill **restores** it with the session intact (run a command before and after
  minimizing), and a non-Coder sees the placeholder in the panel. Confirm a normal
  (non-float) post still renders an inline terminal unchanged.

## Out of scope (deferred)

Dragging or resizing the panel, remembering its position/size across reloads, multiple
simultaneous floating terminals, a corner picker (top-left/etc.), and a separate
close-and-destroy-container button (minimize covers the request; users can still stop the
container from `/account`).
