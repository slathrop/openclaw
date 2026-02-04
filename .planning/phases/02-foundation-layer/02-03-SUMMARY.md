---
phase: 02-foundation-layer
plan: 03
subsystem: infra
tags: [bonjour, mdns, tailscale, ssh, network-discovery, state-migrations, auto-update, gateway-lock]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Conversion patterns, vitest .test.js glob, eslint config"
provides:
  - "Update system (check, runner, startup, channels, global) in JavaScript"
  - "State migration system in JavaScript with migration strategy comments"
  - "Network discovery (bonjour, tailscale, widearea-dns) in JavaScript"
  - "SSH config and tunnel modules in JavaScript with SECURITY annotations"
  - "Gateway lock mechanism in JavaScript"
affects: [03-cli-commands, 04-messaging-channels]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSDoc @typedef for exported TypeScript type aliases"
    - "Module-level /** ... */ comments explaining orchestration flows"
    - "SECURITY: annotations on SSH and network security code"
    - "Unicode U+2019 preservation in DNS-SD test fixtures"

key-files:
  created:
    - src/infra/update-runner.js
    - src/infra/update-check.js
    - src/infra/update-startup.js
    - src/infra/update-channels.js
    - src/infra/update-global.js
    - src/infra/restart.js
    - src/infra/restart-sentinel.js
    - src/infra/state-migrations.js
    - src/infra/state-migrations.fs.js
    - src/infra/gateway-lock.js
    - src/infra/bonjour.js
    - src/infra/bonjour-discovery.js
    - src/infra/bonjour-ciao.js
    - src/infra/bonjour-errors.js
    - src/infra/tailscale.js
    - src/infra/tailnet.js
    - src/infra/widearea-dns.js
    - src/infra/ssh-config.js
    - src/infra/ssh-tunnel.js
  modified: []

key-decisions:
  - "Preserved Unicode RIGHT SINGLE QUOTATION MARK (U+2019) in bonjour-discovery test fixtures using \\u2019 escapes"
  - "Removed unused _options parameters in update-runner.test.js arrow functions (ESLint no-unused-vars)"

patterns-established:
  - "Module-level JSDoc comments on complex orchestration files (update-runner, state-migrations, gateway-lock)"
  - "SECURITY: annotations on SSH key handling, tunnel establishment, and port forwarding"
  - "JSDoc @typedef replacing TypeScript export type in infra modules"

# Metrics
duration: 29min
completed: 2026-02-04
---

# Phase 2 Plan 03: Update System, State Migrations, Network Discovery, and SSH Modules Summary

**33 infra files converted from TypeScript to JavaScript: update lifecycle (check/runner/startup), state migrations, mDNS/Bonjour discovery with Tailnet DNS fallback, Tailscale integration, wide-area DNS-SD, SSH config/tunnel with SECURITY annotations, and gateway lock**

## Performance

- **Duration:** 29 min (across 2 continuation sessions)
- **Started:** 2026-02-04T23:24:33Z
- **Completed:** 2026-02-04T23:54:00Z
- **Tasks:** 2/2
- **Files modified:** 33 (17 Task 1 + 16 Task 2)

## Accomplishments
- Converted 17 update system and state migration files to JavaScript with module-level comments explaining orchestration flows and migration strategies
- Converted 16 network discovery and SSH files to JavaScript with SECURITY annotations on SSH key handling, tunnel establishment, and argument injection prevention
- All 54 tests pass across 14 test files (24 in Task 1, 30 in Task 2)
- ESLint reports 0 errors across all converted files

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert update system and state migration modules** - `914bf7d51` (feat)
2. **Task 2: Convert network discovery and SSH modules** - `1fc1ea523` (feat)

## Files Created/Modified

### Task 1: Update System and State Migrations (17 files)
- `src/infra/update-check.js` - Update availability checking for git/npm installs
- `src/infra/update-check.test.js` - Tests for npm channel tag resolution
- `src/infra/update-runner.js` - Update orchestration flow (check -> download -> verify -> apply -> restart)
- `src/infra/update-runner.test.js` - Tests for update runner strategies
- `src/infra/update-startup.js` - Startup update check
- `src/infra/update-startup.test.js` - Tests for startup update hint
- `src/infra/update-channels.js` - Update channel definitions (stable/beta/dev)
- `src/infra/update-global.js` - Global package manager detection (npm/pnpm/bun)
- `src/infra/restart.js` - Gateway restart orchestration
- `src/infra/restart.test.js` - Tests for restart authorization
- `src/infra/restart-sentinel.js` - Restart sentinel file management
- `src/infra/restart-sentinel.test.js` - Tests for sentinel write/read/consume
- `src/infra/state-migrations.js` - State file migration system (905 lines, largest conversion)
- `src/infra/state-migrations.fs.js` - Filesystem helpers for state migrations
- `src/infra/state-migrations.fs.test.js` - Tests for array session stores
- `src/infra/gateway-lock.js` - Lock file mechanism with PID-based ownership and stale lock detection
- `src/infra/gateway-lock.test.js` - Tests for concurrent lock acquisition and recycled PID detection

### Task 2: Network Discovery and SSH (16 files)
- `src/infra/bonjour.js` - mDNS service advertising via @homebridge/ciao with watchdog
- `src/infra/bonjour.test.js` - Tests for bonjour advertiser (7 tests)
- `src/infra/bonjour-discovery.js` - mDNS discovery with Tailnet DNS fallback probing
- `src/infra/bonjour-discovery.test.js` - Tests for gateway beacon discovery (4 tests)
- `src/infra/bonjour-ciao.js` - Ciao cancellation rejection handler
- `src/infra/bonjour-errors.js` - Bonjour error formatting utilities
- `src/infra/tailscale.js` - Tailscale integration (binary detection, funnel, serve, whois)
- `src/infra/tailscale.test.js` - Tests for tailscale helpers (10 tests)
- `src/infra/tailnet.js` - Tailnet address detection (IPv4/IPv6)
- `src/infra/tailnet.test.js` - Tests for tailnet address detection
- `src/infra/widearea-dns.js` - Wide-area DNS-SD zone file rendering
- `src/infra/widearea-dns.test.js` - Tests for zone rendering
- `src/infra/ssh-config.js` - SSH config resolution via `ssh -G` (3 SECURITY annotations)
- `src/infra/ssh-config.test.js` - Tests for SSH config parsing
- `src/infra/ssh-tunnel.js` - SSH tunnel lifecycle management (6 SECURITY annotations)
- `src/infra/ssh-tunnel.test.js` - Tests for SSH target parsing

## Decisions Made

1. **Unicode preservation in test fixtures:** The bonjour-discovery test uses RIGHT SINGLE QUOTATION MARK (U+2019) in instance names to match DNS-SD octal escape decoding (`\226\128\153`). Used explicit `\u2019` JS escape sequences to preserve character fidelity.

2. **Removed unused `_options` parameters:** ESLint flagged `_options` as unused in update-runner.test.js mock functions. Removed the parameter entirely since it was not referenced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Unicode smart quote loss in bonjour-discovery.test.js**
- **Found during:** Task 2 (network discovery conversion)
- **Issue:** During TS-to-JS conversion, the RIGHT SINGLE QUOTATION MARK (U+2019) in `studioInstance` and assertion strings was inadvertently replaced with ASCII APOSTROPHE (U+0027), causing `instance === studioInstance` comparison to fail in test mocks, resulting in incorrect displayName construction and 2 test failures
- **Fix:** Replaced all 5 occurrences of plain apostrophe with `\u2019` escape sequences in the test file
- **Files modified:** src/infra/bonjour-discovery.test.js
- **Verification:** All 4 bonjour-discovery tests pass (including both previously failing tests)
- **Committed in:** 1fc1ea523 (Task 2 commit)

**2. [Rule 1 - Bug] Removed unused `_options` parameter in update-runner.test.js**
- **Found during:** Task 1 (update system conversion)
- **Issue:** ESLint `no-unused-vars` flagged `_options` parameter in 10 mock arrow functions
- **Fix:** Removed the unused parameter from all affected functions
- **Files modified:** src/infra/update-runner.test.js
- **Verification:** All 10 update-runner tests pass, ESLint reports 0 errors
- **Committed in:** 914bf7d51 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered

- **Context continuation:** Plan execution required 2 continuation sessions due to the large scope (33 files). Task 1 was completed across the first two sessions; Task 2 was completed in the final session. All state was properly tracked across continuations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 33 infra files in this plan's scope are now JavaScript
- Update system, state migrations, network discovery, and SSH modules ready for dependent modules
- Remaining Phase 2 plans: 02-02 (env/process), 02-08 (core config), 02-10 (remaining infra)

---
*Phase: 02-foundation-layer*
*Completed: 2026-02-04*
