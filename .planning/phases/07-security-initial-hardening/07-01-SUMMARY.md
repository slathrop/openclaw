---
phase: 07-security-initial-hardening
plan: 01
subsystem: security
tags: [gateway, credentials, sandbox, media, url-validation, path-traversal]

# Dependency graph
requires:
  - phase: 04-cli-and-channels
    provides: JavaScript gateway/call.js, message-tool.js, message-action-runner.js
provides:
  - URL credential exfiltration prevention for gateway overrides
  - Sandboxed media path validation (assertMediaNotDataUrl, resolveSandboxedMediaSource)
  - TUI test environment restoration
affects: [07-security-initial-hardening, upstream-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveExplicitGatewayAuth + ensureExplicitGatewayAuth pattern for URL override auth"
    - "normalizeSandboxMediaParams/normalizeSandboxMediaList for media path validation"

key-files:
  created:
    - src/tui/gateway-chat.test.js
  modified:
    - src/gateway/call.js
    - src/gateway/call.test.js
    - src/tui/gateway-chat.js
    - src/agents/sandbox-paths.js
    - src/agents/tools/message-tool.js
    - src/agents/tools/message-tool.test.js
    - src/infra/outbound/message-action-runner.js
    - src/infra/outbound/message-action-runner.test.js
    - CHANGELOG.md

key-decisions:
  - "Proactively fixed MEDIA newline test bug (upstream commit a6fd76efe) to maintain green tests"
  - "Moved sandbox validation from message-tool to message-action-runner per upstream refactor"

patterns-established:
  - "explicitAuth pattern: URL overrides require explicit --token or --password, no env/config fallback"
  - "Sandbox media normalization at action runner level rather than tool level"

# Metrics
duration: 56min
completed: 2026-02-05
---

# Phase 7 Plan 1: Security Foundation - Gateway Credentials and Sandboxed Media

**Gateway URL override credential exfiltration prevention, TUI test env restoration, and sandboxed media path validation moved to message action runner**

## Performance

- **Duration:** 56 min
- **Started:** 2026-02-06T03:29:14Z
- **Completed:** 2026-02-06T04:25:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Gateway rejects URL overrides without explicit credentials (prevents credential leakage to attacker URLs)
- Sandbox media validation moved from message-tool to message-action-runner (catches all code paths)
- New functions: assertMediaNotDataUrl, resolveSandboxedMediaSource for comprehensive media source validation
- TUI gateway chat tests properly save/restore environment variables

## Task Commits

Each task was committed atomically:

1. **Task 1: SYNC-001 - Prevent gateway credential exfiltration via URL override** - `6b8dd8a28` (security)
2. **Task 2: SYNC-002 - Restore TUI gateway env** - `52f7aea54` (test)
3. **Task 3: SYNC-003 - Harden sandboxed media handling** - `d59f0e3f0` (security)

## Files Created/Modified

- `src/gateway/call.js` - Added resolveExplicitGatewayAuth() and ensureExplicitGatewayAuth(); token/password resolution now guards against URL override credential fallback
- `src/gateway/call.test.js` - Tests for URL override auth requirements, explicit token/password with overrides
- `src/tui/gateway-chat.js` - Uses explicit auth helpers for URL override credential enforcement
- `src/tui/gateway-chat.test.js` - New test file with env save/restore for OPENCLAW_GATEWAY_TOKEN and OPENCLAW_GATEWAY_PASSWORD
- `src/agents/sandbox-paths.js` - Added assertMediaNotDataUrl() and resolveSandboxedMediaSource() for data URL rejection and sandbox-relative path resolution
- `src/agents/tools/message-tool.js` - Removed inline sandbox validation; passes sandboxRoot to runMessageAction instead
- `src/agents/tools/message-tool.test.js` - Replaced sandbox path validation tests with passthrough tests (validation now at runner level)
- `src/infra/outbound/message-action-runner.js` - Added normalizeSandboxMediaParams() and normalizeSandboxMediaList(); validates media/path/filePath params and MEDIA directives against sandbox root
- `src/infra/outbound/message-action-runner.test.js` - Added tests for sandbox media rejection, path rewriting, MEDIA directive rewriting, and data URL rejection
- `CHANGELOG.md` - Added sandboxed media security fix entry

## Decisions Made

- Proactively applied MEDIA newline fix from upstream commit a6fd76efe (changed `\\n` to `\n` in test) because the original test at 4434cae56 was broken and would fail. This matches what upstream fixed 3 commits later.
- Moved sandbox validation from message-tool to message-action-runner per upstream architectural change -- this ensures all media paths are validated regardless of which code path invokes the runner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MEDIA newline test string**
- **Found during:** Task 3 (SYNC-003 sandboxed media)
- **Issue:** Upstream commit 4434cae56 used `'Hello\\nMEDIA: ./data/note.ogg'` (literal backslash-n) which doesn't produce a real newline for the MEDIA parser. The upstream test was also broken and fixed in a6fd76efe.
- **Fix:** Changed to `'Hello\nMEDIA: ./data/note.ogg'` (real newline) matching the fix in upstream a6fd76efe
- **Files modified:** src/infra/outbound/message-action-runner.test.js
- **Verification:** All 24 tests in message-action-runner.test.js pass
- **Committed in:** d59f0e3f0 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix was necessary for test correctness. Matches upstream's own fix. No scope creep.

## Issues Encountered

- Multi-agent environment: Other agents committed between our tasks (2e57ea828, c0ca7bcb2, b9317b50b). This is expected and did not cause conflicts.
- Background test runner produced empty output files; switched to foreground execution for reliable results.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Security foundation in place for remaining phase 7 plans
- Gateway credential protection active for all URL overrides
- Sandbox media validation ready for any downstream code that invokes runMessageAction
- 3/104 upstream commits ported (a13ff55bd, 5e025c4ba, 4434cae56)

---
*Phase: 07-security-initial-hardening*
*Completed: 2026-02-05*
