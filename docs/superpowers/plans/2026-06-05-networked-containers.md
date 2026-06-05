# Networked Containers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in networked lab variants (`python-net` / `node-net` / `linux-net`) whose containers reach the internet (so `pip`/`npm`/`apt` installs work) on a firewall-restricted Docker network that blocks the host LAN.

**Architecture:** The relay gains three networked entries in `DEFAULT_LABS` and attaches networked containers to a named Docker network (`nmmr-net`) with public DNS instead of plain `bridge`; a host setup script firewalls that network to block RFC1918/link-local egress. The blog and relay allowlists learn the three new lab ids. The offline `*-basics` labs are unchanged.

**Tech Stack:** Node/TypeScript relay (`nmmr-terminal`), dockerode, Node `node:test` + `ts-node`; Next.js blog (`nmmr-ai-blogs`), vitest. No new dependencies.

**Branch:** `networked-containers` (already created; spec committed there).

**Repos:** `nmmr-terminal` (sibling at `../nmmr-terminal`; Tasks 1–5) and `nmmr-ai-blogs` (this repo; Task 6). Task 7 spans both.

---

## File Structure

**`nmmr-terminal`:**
- `src/network-mode.ts` (create) — pure `networkModeFor(networkEnabled, labNetworkName)`.
- `src/network-mode.test.ts` (create) — node:test.
- `src/config.ts` (modify) — add `labNetworkName`.
- `src/container-manager.ts` (modify) — use `networkModeFor`; set public DNS for networked containers.
- `src/lab-cache.ts` (modify) — add the three networked labs to `DEFAULT_LABS`.
- `src/lab-allowlist.ts` (modify) — add the three ids to `DEFAULT_ALLOWED`.
- `src/lab-allowlist.test.ts` (modify) — assert the new ids are allowed.
- `package.json` (modify) — add `network-mode.test.ts` to the `test` script.
- `scripts/setup-nmmr-net.sh` (create) — host network + firewall setup.
- `commands.md` (modify) — document the setup script.

**`nmmr-ai-blogs`:**
- `src/lib/terminalEmbed.ts` (modify) — add the three labs to `TERMINAL_LABS`.
- `tests/terminalEmbed.test.ts` (modify) — assert a `-net` fence parses and labels.

---

## Task 1: Relay — `networkModeFor` helper + config (`nmmr-terminal`)

All paths under `../nmmr-terminal`.

**Files:**
- Create: `src/network-mode.ts`, `src/network-mode.test.ts`
- Modify: `src/config.ts`, `package.json`

- [ ] **Step 1: Add the new test file to the `test` script** — in `package.json`, change the `test` script to:

```json
    "test": "node --test -r ts-node/register src/lab-allowlist.test.ts src/container-query.test.ts src/network-mode.test.ts",
```

- [ ] **Step 2: Write the failing test** — create `src/network-mode.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkModeFor } from './network-mode';

test('networkModeFor returns the network name when enabled', () => {
  assert.equal(networkModeFor(true, 'nmmr-net'), 'nmmr-net');
});

test('networkModeFor returns "none" when disabled', () => {
  assert.equal(networkModeFor(false, 'nmmr-net'), 'none');
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./network-mode`.

- [ ] **Step 4: Implement** — create `src/network-mode.ts`:

```typescript
/** Docker NetworkMode for a lab: the locked-down network when networking is on, else "none". */
export function networkModeFor(networkEnabled: boolean, labNetworkName: string): string {
  return networkEnabled ? labNetworkName : "none";
}
```

- [ ] **Step 5: Add `labNetworkName` to config** — in `src/config.ts`, add this line inside the `config` object (e.g. directly after the `ollamaModel` line, before the closing `};`):

```typescript
  // Locked-down Docker network for networked labs
  labNetworkName: process.env.LAB_NETWORK_NAME || "nmmr-net",
```

- [ ] **Step 6: Run, verify it passes**

Run: `npm test`
Expected: PASS (lab-allowlist + container-query + the 2 new network-mode tests).

- [ ] **Step 7: Commit**

```bash
git add src/network-mode.ts src/network-mode.test.ts src/config.ts package.json
git commit -m "feat: add networkModeFor helper and labNetworkName config"
```

---

## Task 2: Relay — wire networked NetworkMode + DNS into `createContainer`

All paths under `../nmmr-terminal`. No unit test (Docker call); verify by build.

**Files:**
- Modify: `src/container-manager.ts`

- [ ] **Step 1: Import the helper and config** — at the top of `src/container-manager.ts`, the file already imports `config` from `./config`. Add:

```typescript
import { networkModeFor } from "./network-mode";
```

- [ ] **Step 2: Replace the `NetworkMode` line and add DNS** — in `createContainer`, the `HostConfig` block currently contains:

```typescript
      NetworkMode: labConfig.networkEnabled ? "bridge" : "none",
```

Replace that single line with:

```typescript
      NetworkMode: networkModeFor(labConfig.networkEnabled, config.labNetworkName),

      // Networked labs use public DNS so resolution never depends on the LAN
      ...(labConfig.networkEnabled ? { Dns: ["1.1.1.1", "8.8.8.8"] } : {}),
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `tsc` succeeds (emits `dist/`). Do not commit `dist/`.

- [ ] **Step 4: Commit**

```bash
git add src/container-manager.ts
git commit -m "feat: attach networked containers to the locked-down network with public DNS"
```

---

## Task 3: Relay — networked lab variants in `DEFAULT_LABS`

All paths under `../nmmr-terminal`. No unit test (data); verify by build.

**Files:**
- Modify: `src/lab-cache.ts`

- [ ] **Step 1: Add three networked labs** — in `src/lab-cache.ts`, the `DEFAULT_LABS` object ends with the `"linux-basics"` entry followed by `};`. Add these three entries immediately AFTER the `"linux-basics"` entry's closing `},` and BEFORE the `};` that closes `DEFAULT_LABS`:

```typescript
  "python-net": {
    labId: "python-net",
    name: "Python (networked)",
    dockerImage: "nmmr-python-lab:latest",
    description: "Python 3.12 with internet access for installs",
    resources: {
      cpuLimit: 0.5,
      memoryLimit: "512m",
      diskLimit: "200m",
      timeoutMinutes: 30,
    },
    preloadFiles: [],
    startupCommand: null,
    networkEnabled: true,
  },
  "node-net": {
    labId: "node-net",
    name: "Node.js (networked)",
    dockerImage: "nmmr-node-lab:latest",
    description: "Node.js 20 with internet access for installs",
    resources: {
      cpuLimit: 0.5,
      memoryLimit: "512m",
      diskLimit: "200m",
      timeoutMinutes: 30,
    },
    preloadFiles: [],
    startupCommand: null,
    networkEnabled: true,
  },
  "linux-net": {
    labId: "linux-net",
    name: "Linux (networked)",
    dockerImage: "nmmr-linux-lab:latest",
    description: "Ubuntu CLI with internet access for apt installs",
    resources: {
      cpuLimit: 0.5,
      memoryLimit: "512m",
      diskLimit: "200m",
      timeoutMinutes: 30,
    },
    preloadFiles: [],
    startupCommand: null,
    networkEnabled: true,
  },
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: `tsc` succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lab-cache.ts
git commit -m "feat: add networked lab variants to DEFAULT_LABS"
```

---

## Task 4: Relay — allow the networked lab ids

All paths under `../nmmr-terminal`. TDD.

**Files:**
- Modify: `src/lab-allowlist.ts`, `src/lab-allowlist.test.ts`

- [ ] **Step 1: Add the failing test** — append to `src/lab-allowlist.test.ts`:

```typescript
test('default allowlist contains the networked labs', () => {
  const labs = getAllowedLabs();
  assert.ok(labs.includes('python-net'));
  assert.ok(labs.includes('node-net'));
  assert.ok(labs.includes('linux-net'));
});
```

(`test`, `assert`, `getAllowedLabs` are already imported at the top of this file.)

- [ ] **Step 2: Run, verify it fails**

Run: `npm test`
Expected: FAIL — `python-net` not in the allowlist.

- [ ] **Step 3: Implement** — in `src/lab-allowlist.ts`, change the `DEFAULT_ALLOWED` line to:

```typescript
const DEFAULT_ALLOWED = ['python-basics', 'node-basics', 'linux-basics', 'python-net', 'node-net', 'linux-net'];
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test`
Expected: PASS (all relay tests).

- [ ] **Step 5: Commit**

```bash
git add src/lab-allowlist.ts src/lab-allowlist.test.ts
git commit -m "feat: allow networked lab ids"
```

---

## Task 5: Relay — host network + firewall setup script

All paths under `../nmmr-terminal`. No automated test (host iptables/Docker); the script is documented and manually verified in Task 7.

**Files:**
- Create: `scripts/setup-nmmr-net.sh`
- Modify: `commands.md`

- [ ] **Step 1: Create `scripts/setup-nmmr-net.sh`**

```bash
#!/usr/bin/env bash
# Create the locked-down Docker network for networked labs and firewall it so
# containers can reach the public internet but NOT the host LAN.
# Idempotent. Run on the relay host with sudo. Make the iptables rules persistent
# afterwards (e.g. `apt-get install iptables-persistent` / `netfilter-persistent save`).
set -euo pipefail

NET_NAME="${LAB_NETWORK_NAME:-nmmr-net}"
SUBNET="172.31.0.0/24"

# 1. Create the network if it does not exist.
if ! docker network inspect "$NET_NAME" >/dev/null 2>&1; then
  docker network create --subnet "$SUBNET" "$NET_NAME"
  echo "Created Docker network $NET_NAME ($SUBNET)"
else
  echo "Docker network $NET_NAME already exists"
fi

# 2. Drop egress from the lab subnet to private + link-local ranges.
#    -C tests for the rule; -I inserts it only if absent (idempotent).
add_drop() {
  local dest="$1"
  if ! iptables -C DOCKER-USER -s "$SUBNET" -d "$dest" -j DROP 2>/dev/null; then
    iptables -I DOCKER-USER -s "$SUBNET" -d "$dest" -j DROP
    echo "Blocked $SUBNET -> $dest"
  else
    echo "Rule $SUBNET -> $dest already present"
  fi
}

add_drop "10.0.0.0/8"
add_drop "172.16.0.0/12"
add_drop "192.168.0.0/16"
add_drop "169.254.0.0/16"

echo "Done. Networked labs (python-net/node-net/linux-net) can reach the internet but not the LAN."
echo "Remember to persist iptables rules so they survive reboot."
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/setup-nmmr-net.sh`

- [ ] **Step 3: Document it in `commands.md`** — append a new section to the end of `commands.md`:

```markdown
---

## Networked Labs Setup (python-net / node-net / linux-net)

Networked labs let learners run `pip install` / `npm install` / `apt-get` inside the
terminal. Their containers attach to a dedicated `nmmr-net` Docker network that is
firewalled to allow the public internet but block the host LAN.

```bash
# On the relay host, once (and after any iptables flush):
sudo LAB_NETWORK_NAME=nmmr-net ./scripts/setup-nmmr-net.sh

# Persist the rules across reboots:
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

Verify from inside a `python-net` terminal:

```bash
pip install cowsay        # should succeed (internet allowed)
curl -m 5 http://192.168.1.1   # should hang/fail (LAN blocked)
```

The relay attaches networked containers to `$LAB_NETWORK_NAME` (default `nmmr-net`) with
public DNS (1.1.1.1 / 8.8.8.8). If the network does not exist, container creation fails with
a "Lab setup failed" error — run the script above first.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-nmmr-net.sh commands.md
git commit -m "docs: add nmmr-net firewall setup script and instructions"
```

---

## Task 6: Blog — register the networked labs

All paths in this repo (`nmmr-ai-blogs`). TDD.

**Files:**
- Modify: `src/lib/terminalEmbed.ts`, `tests/terminalEmbed.test.ts`

- [ ] **Step 1: Add the failing test** — append to `tests/terminalEmbed.test.ts`:

```typescript
describe('networked labs', () => {
  it('parses a networked lab fence', () => {
    expect(parseTerminalFence('terminal', 'lab: python-net')).toEqual({ labId: 'python-net' });
  });
  it('labels networked labs', () => {
    expect(TERMINAL_LABS['python-net']).toBe('Python (networked)');
    expect(TERMINAL_LABS['node-net']).toBe('Node.js (networked)');
    expect(TERMINAL_LABS['linux-net']).toBe('Linux (networked)');
  });
  it('still parses the offline labs', () => {
    expect(parseTerminalFence('terminal', 'lab: python-basics')).toEqual({ labId: 'python-basics' });
  });
});
```

(`parseTerminalFence` and `TERMINAL_LABS` are already imported at the top of this file.)

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/terminalEmbed.test.ts`
Expected: FAIL — `TERMINAL_LABS['python-net']` is undefined.

- [ ] **Step 3: Implement** — in `src/lib/terminalEmbed.ts`, change the `TERMINAL_LABS` object to:

```typescript
export const TERMINAL_LABS = {
  'python-basics': 'Python',
  'node-basics': 'Node.js',
  'linux-basics': 'Linux',
  'python-net': 'Python (networked)',
  'node-net': 'Node.js (networked)',
  'linux-net': 'Linux (networked)',
} as const;
```

(`ALLOWED_LAB_IDS` is derived as `Object.keys(TERMINAL_LABS)`, so it picks these up automatically; `LabId` widens to include them.)

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run tests/terminalEmbed.test.ts`
Expected: PASS. Then `npx vitest run` to confirm the whole suite stays green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/terminalEmbed.ts tests/terminalEmbed.test.ts
git commit -m "feat: register networked lab variants in the blog"
```

---

## Task 7: Verification + docs + manual end-to-end

**Files:**
- Modify: `README.md` (this repo).

- [ ] **Step 1: Document in the blog README** — append to the existing "Coder terminals" section of `README.md`:

```markdown

Networked lab variants (`python-net`, `node-net`, `linux-net`) give the terminal internet
access so `pip install` / `npm install` / `apt-get` work; the plain `*-basics` labs stay
offline. Networked containers run on a firewalled `nmmr-net` Docker network (internet
allowed, host LAN blocked) — see `nmmr-terminal/commands.md` and
`scripts/setup-nmmr-net.sh`.
```

- [ ] **Step 2: Commit the README**

```bash
git add README.md
git commit -m "docs: document networked lab variants"
```

- [ ] **Step 3: Full automated verification**

```bash
# Blog (this repo)
npx vitest run        # all green, incl. the networked-labs cases
npm run build         # succeeds
# Relay
cd ../nmmr-terminal && npm test && npm run build && cd -   # network-mode + allowlist tests green; tsc clean
```

- [ ] **Step 4: Manual end-to-end (requires Docker + the relay host)**

1. On the relay host, run `sudo ./scripts/setup-nmmr-net.sh` (creates `nmmr-net` + firewall rules).
2. Start the relay (`npm run build && npm start`) and the blog (sandbox + `npm run dev`).
3. As a Coder, publish a post with a ` ```terminal ` fence containing `lab: python-net` and **Launch** it.
4. Inside the terminal run `pip install cowsay` → it should succeed (internet reachable).
5. Run `curl -m 5 http://192.168.1.1` (your router) → it should hang/fail (LAN blocked).
6. Launch a `lab: python-basics` terminal and confirm `pip install cowsay` fails immediately (no network).
7. On `/account`, confirm the networked container is listed as "Python (networked)" and **Stop** works.

---

## Self-review notes

- **Spec coverage:** networked lab variants in `DEFAULT_LABS` with 512m + `networkEnabled` (Task 3); named-network + public DNS via `networkModeFor` (Tasks 1–2); `labNetworkName` config (Task 1); host firewall script + docs (Task 5); relay allowlist (Task 4); blog `TERMINAL_LABS`/`ALLOWED_LAB_IDS` (Task 6); tests for `networkModeFor`, the allowlist, and `parseTerminalFence`/labels (Tasks 1, 4, 6); README + manual e2e (Task 7). All spec sections map to a task.
- **Type consistency:** `networkModeFor(networkEnabled: boolean, labNetworkName: string): string` is defined in Task 1 and used in Task 2; `config.labNetworkName` added in Task 1, consumed in Task 2; the six lab ids (`python-basics`…`linux-net`) are consistent across `DEFAULT_LABS` (Task 3), `DEFAULT_ALLOWED` (Task 4), and `TERMINAL_LABS` (Task 6).
- **Deferred (not in this plan, per spec):** per-container disk quotas, registry-allowlist proxy, Cognito-native relay auth, email notifications, admin all-containers view.
```
