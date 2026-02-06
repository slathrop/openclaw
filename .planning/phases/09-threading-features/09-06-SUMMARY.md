---
phase: 09-threading-features
plan: 06
subsystem: agents
tags: [compaction, overflow, billing, errors, qr-code, revert]

# Dependency graph
requires:
  - phase: 09-04
    provides: Error handling and helpers foundation (errors.js, run.js)
provides:
  - Multiple compaction retry attempts (up to 3) on context overflow
  - User-friendly billing error messages
  - QR code skill reverted
affects: [10-xai-cron-scanner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Counter-based retry loop (replaces boolean one-shot pattern)
    - Shared error message constants for user-facing text

key-files:
  created: []
  modified:
    - src/agents/pi-embedded-runner/run.js
    - src/agents/pi-embedded-runner/run.overflow-compaction.test.js
    - src/agents/pi-embedded-helpers/errors.js
    - src/agents/pi-embedded-helpers.js
    - src/agents/pi-embedded-helpers.formatassistanterrortext.test.js
    - CHANGELOG.md
    - CLAUDE.md

key-decisions:
  - "Counter-based compaction retry (0..3) replaces boolean one-shot flag"
  - "BILLING_ERROR_USER_MESSAGE shared constant for consistent billing error presentation"

patterns-established:
  - "Counter-based retry with MAX constant for bounded retry loops"

# Metrics
duration: 6min
completed: 2026-02-06
---

# Phase 9 Plan 6: Compaction Retries, Billing Errors, QR Revert Summary

**Counter-based compaction retries (max 3), user-friendly billing error detection with BILLING_ERROR_USER_MESSAGE constant, and QR code skill revert**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-06T20:00:56Z
- **Completed:** 2026-02-06T20:06:40Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Changed overflow compaction from boolean one-shot to counter allowing up to 3 retry attempts
- Added diagnostic logging on context overflow events for debugging early-overflow issues
- Added BILLING_ERROR_USER_MESSAGE constant and billing detection in formatAssistantErrorText, sanitizeUserFacingText, and run loop failover
- Reverted QR code skill (removed skills/qr-code/ directory and CLAUDE.md trailing newline)

## Task Commits

Each task was committed atomically:

1. **Task 1: SYNC-061 - Allow multiple compaction retries on context overflow** - `72c584e17` (fix)
2. **Task 2: SYNC-062 - Billing error detection** - `36eff3ea5` (fix)
3. **Task 2: SYNC-063 - QR code skill revert** - `30d67ba4f` (revert)

## Files Created/Modified
- `src/agents/pi-embedded-runner/run.js` - Counter-based compaction retry (MAX_OVERFLOW_COMPACTION_ATTEMPTS=3), diagnostic logging, billingFailure detection, BILLING_ERROR_USER_MESSAGE import
- `src/agents/pi-embedded-runner/run.overflow-compaction.test.js` - Updated tests: 3-retry test, mid-retry success test, isBillingAssistantError mock
- `src/agents/pi-embedded-helpers/errors.js` - BILLING_ERROR_USER_MESSAGE constant, billing checks in formatAssistantErrorText and sanitizeUserFacingText
- `src/agents/pi-embedded-helpers.js` - Barrel export for BILLING_ERROR_USER_MESSAGE
- `src/agents/pi-embedded-helpers.formatassistanterrortext.test.js` - 3 new billing error test cases
- `CHANGELOG.md` - Billing error fix entry
- `CLAUDE.md` - Symlink trailing newline removed (part of QR revert)
- `skills/qr-code/` - Deleted (SKILL.md, qr_generate.py, qr_read.py)

## Decisions Made
- Counter-based compaction retry (0..3) replaces boolean one-shot flag, matching upstream exactly
- BILLING_ERROR_USER_MESSAGE as shared constant ensures consistent billing error messaging across formatAssistantErrorText, sanitizeUserFacingText, and run loop failover

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Linter auto-converted `let overflowCompactionAttempts = 0` to `const` (since it doesn't track mutation through increment); manually restored to `let`
- Interleaved commit from parallel agent appeared between SYNC-061 and SYNC-062; normal multi-agent behavior, all three SYNC commits exist in correct order

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 plans in Phase 9 complete (SYNC-043 through SYNC-063)
- Ready for Phase 10 (xAI + Cron + Security Scanner)
- No blockers

---
*Phase: 09-threading-features*
*Completed: 2026-02-06*
