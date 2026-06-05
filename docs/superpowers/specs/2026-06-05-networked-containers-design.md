# Networked Containers — opt-in internet access for terminals

**Date:** 2026-06-05
**Status:** Approved (design)
**Repos:** `nmmr-terminal` (primary), `nmmr-ai-blogs` (allowlist + labels)
**Builds on:** [2026-06-05-coder-terminals-design.md](2026-06-05-coder-terminals-design.md)

## Summary

Add opt-in networked lab variants (`python-net`, `node-net`, `linux-net`) so an author can
embed a terminal that reaches the internet — making `pip install` / `npm install` /
`apt-get` work — while the existing `*-basics` labs stay fully offline. Networked
containers attach to a dedicated, firewall-restricted Docker network that allows the public
internet but blocks the host's LAN, so user-run code cannot reach the home network.

## Context

The relay already gates networking per lab:

- `src/container-manager.ts` line 82: `NetworkMode: labConfig.networkEnabled ? "bridge" : "none"`.
- `src/lab-cache.ts` `DEFAULT_LABS` defines `python-basics`, `node-basics`, `linux-basics`,
  all with `networkEnabled: false`, `memoryLimit: "256m"`, `cpuLimit: 0.5`.
- The lab images already ship package managers (`pip` in `python:3.12-slim`, `npm` in
  `node:20-slim`, `apt` in `ubuntu:22.04`), so egress is the only thing missing for installs.
- The relay runs on home/on-prem infrastructure behind a Cloudflare tunnel. Plain `bridge`
  networking would let a container reach not just the internet but the local LAN
  (router, other machines) — the security risk this design must contain.

Lab ids are allowlisted in two places: the relay (`src/lab-allowlist.ts`) and the blog
(`src/lib/terminalEmbed.ts` `ALLOWED_LAB_IDS` / `TERMINAL_LABS`).

## Design

### 1. Networked lab variants (relay `src/lab-cache.ts`)

Add three entries to `DEFAULT_LABS`, reusing the existing images (no rebuild):

- `python-net` → image `nmmr-python-lab:latest`, `networkEnabled: true`, `memoryLimit: "512m"`.
- `node-net` → image `nmmr-node-lab:latest`, `networkEnabled: true`, `memoryLimit: "512m"`.
- `linux-net` → image `nmmr-linux-lab:latest`, `networkEnabled: true`, `memoryLimit: "512m"`.

Each has a name like "Python (networked)"; `cpuLimit` stays `0.5`, `timeoutMinutes` `30`.
The `*-basics` labs are unchanged (still `networkEnabled: false`, `256m`).

### 2. Locked-down network + DNS (relay `src/container-manager.ts`, `src/config.ts`)

- Add `labNetworkName` to `config` (env `LAB_NETWORK_NAME`, default `"nmmr-net"`).
- Extract a pure helper `networkModeFor(networkEnabled: boolean, labNetworkName: string): string`
  returning `labNetworkName` when enabled and `"none"` otherwise. Use it in `createContainer`
  in place of the inline ternary (line 82).
- For networked containers, also set `HostConfig.Dns = ["1.1.1.1", "8.8.8.8"]` so name
  resolution uses public resolvers and never depends on the LAN. (Offline containers keep no
  explicit DNS; with `NetworkMode: "none"` it is irrelevant.)

The relay only *attaches* to the named network; creating it and firewalling it is host setup
(next section).

### 3. Egress guardrails — host setup (relay `scripts/setup-nmmr-net.sh`, `commands.md`)

A documented, idempotent script (manually run on the host; not unit-testable) that:

1. Creates the `nmmr-net` Docker network with a fixed subnet (`172.31.0.0/24`) if absent:
   `docker network create --subnet 172.31.0.0/24 nmmr-net`.
2. Installs `DOCKER-USER` iptables rules dropping egress from `172.31.0.0/24` to private and
   link-local ranges, while leaving the public internet allowed:
   - DROP `-s 172.31.0.0/24 -d 10.0.0.0/8`
   - DROP `-s 172.31.0.0/24 -d 172.16.0.0/12`
   - DROP `-s 172.31.0.0/24 -d 192.168.0.0/16`
   - DROP `-s 172.31.0.0/24 -d 169.254.0.0/16`

Because networked containers use public DNS (1.1.1.1/8.8.8.8) and reach registries over the
public internet, installs work; any attempt to reach the LAN is dropped. The script and its
verification are documented in `commands.md`; the rules must be made persistent on the host
(e.g. via `iptables-persistent`) — noted in the docs.

### 4. Allowlists and labels

- Relay `src/lab-allowlist.ts`: add `python-net`, `node-net`, `linux-net` to the default
  allowed list.
- Blog `src/lib/terminalEmbed.ts`: add the three ids to `TERMINAL_LABS` (labels
  "Python (networked)", "Node.js (networked)", "Linux (networked)"); `ALLOWED_LAB_IDS` derives
  from `TERMINAL_LABS`, so the fence parser, the `/api/terminal-token` lab check, and the
  `MyContainers` labels all recognize them automatically.

## Data flow

`lab: python-net` fence → `parseTerminalFence` accepts it → blog mints a token (labId now in
`ALLOWED_LAB_IDS`) → relay validates against the expanded allowlist → `createContainer` reads
`networkEnabled: true` → `networkModeFor` returns `nmmr-net`, DNS set to public resolvers →
container installs packages over the internet; the firewall blocks LAN access. The container
appears under "My containers" labelled "Python (networked)".

## Error handling

| Situation | Behavior |
|-----------|----------|
| Unknown / disallowed `-net` lab | Existing 400 (blog) / 4009 (relay) paths |
| `nmmr-net` network missing on the host | `createContainer` fails → existing 4007 "Lab setup failed" surfaces in the terminal (the setup script is a documented prerequisite) |
| Install fails due to blocked LAN dependency | Surfaces as the package manager's own error inside the terminal (expected; LAN egress is intentionally blocked) |

## Testing

- **Relay (node:test):** `networkModeFor(true, 'nmmr-net')` → `'nmmr-net'`; `networkModeFor(false, 'nmmr-net')` → `'none'`. Allowlist accepts `python-net` / `node-net` / `linux-net` and still rejects an unknown id.
- **Blog (vitest):** `parseTerminalFence('terminal', 'lab: python-net')` → `{ labId: 'python-net' }`; `TERMINAL_LABS['python-net']` is "Python (networked)"; an offline `lab: python-basics` still resolves.
- **Manual:** run `scripts/setup-nmmr-net.sh`; embed `lab: python-net` and launch it; `pip install cowsay` succeeds; `curl http://192.168.1.1` (the router) hangs/fails; confirm `lab: python-basics` still has no network (`curl` to anything fails immediately).

## Out of scope (still deferred)

Per-container disk quotas (networked installs write to the unbounded writable layer — a known
limitation; optional later hardening via Docker `StorageOpt` with overlay2 + pquota), the
registry-allowlist egress proxy, Cognito-native relay auth, email notifications, and an admin
all-containers view.
