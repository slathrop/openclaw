---
phase: 08-windows-acl-telegram-threading
plan: 06
subsystem: telegram
tags: [telegram, forum-topics, threading, parentPeer, onboarding, docs]

# Dependency graph
requires:
  - phase: 08-03
    provides: DM topic threadId preservation (SYNC-028/029)
  - phase: 08-04
    provides: Deps cleanup and test helpers (SYNC-031 to SYNC-034)
provides:
  - Forum topic binding inheritance via parentPeer
  - Auto-injected forum topic threadId in message tool
  - Streamlined CLI onboarding docs (hub + reference + automation)
affects: [09-threading-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parentPeer fallback for binding inheritance (mirrors Discord pattern)"
    - "Auto-threading injection pattern: resolveTelegramAutoThreadId mirrors resolveSlackAutoThreadId"

key-files:
  created:
    - docs/start/wizard-cli-reference.md
    - docs/start/wizard-cli-automation.md
  modified:
    - src/telegram/bot/helpers.js
    - src/telegram/bot-handlers.js
    - src/telegram/bot-message-context.js
    - src/telegram/bot-native-commands.js
    - src/telegram/bot.js
    - src/infra/outbound/message-action-runner.js
    - docs/cli/onboard.md
    - docs/start/wizard.md
    - docs/docs.json
    - CHANGELOG.md

key-decisions:
  - "resolveTelegramAutoThreadId uses parseTelegramTarget for canonical chat ID comparison"

patterns-established:
  - "parentPeer pattern: group-level bindings apply to all topics via parentPeer fallback in resolveAgentRoute"
  - "Channel auto-threading: each channel gets a resolveXxxAutoThreadId function in message-action-runner"

# Metrics
duration: 10min
completed: 2026-02-06
---

# Phase 8 Plan 6: Telegram Forum Topic Threading and Onboarding Docs Summary

**Forum topic parentPeer binding inheritance, auto-injected threadId in message tool, and CLI onboarding docs split into hub/reference/automation pages**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-06T17:50:07Z
- **Completed:** 2026-02-06T18:00:30Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Forum topic messages now inherit group-level bindings via parentPeer fallback (SYNC-040)
- CLI onboarding docs streamlined: wizard.md split into hub + reference + automation subpages (SYNC-041)
- Message tool auto-injects threadId for Telegram forum topics, mirroring Slack auto-threading (SYNC-042)
- Two new test cases for forum topic routing and topic precedence

## Task Commits

Each task was committed atomically:

1. **Task 1: SYNC-040 - Pass parentPeer for forum topic binding** - `4c8cc7c38` (fix)
2. **Task 2: SYNC-041 - Streamline CLI onboarding docs** - `a66dff266` (docs)
3. **Task 3: SYNC-042 - Auto-inject Telegram forum topic threadId** - `fdc7fd726` (fix)

## Files Created/Modified
- `src/telegram/bot/helpers.js` - Added buildTelegramParentPeer() helper
- `src/telegram/bot-handlers.js` - Pass parentPeer to resolveAgentRoute
- `src/telegram/bot-message-context.js` - Pass parentPeer to resolveAgentRoute
- `src/telegram/bot-native-commands.js` - Pass parentPeer to resolveAgentRoute
- `src/telegram/bot.js` - Pass parentPeer to resolveAgentRoute (reaction handler)
- `src/telegram/bot.create-telegram-bot.routes-dms-by-telegram-accountid-binding.test.js` - Forum topic routing tests
- `src/infra/outbound/message-action-runner.js` - resolveTelegramAutoThreadId + auto-injection
- `docs/cli/onboard.md` - Expanded with related guides and follow-up commands
- `docs/start/wizard.md` - Streamlined into hub page with cards to subpages
- `docs/start/wizard-cli-reference.md` - NEW: full flow, auth matrix, outputs, RPC
- `docs/start/wizard-cli-automation.md` - NEW: non-interactive recipes, provider examples
- `docs/docs.json` - Nav restructured with CLI/macOS onboarding subgroups + redirects
- `CHANGELOG.md` - parentPeer fix entry

## Decisions Made
- resolveTelegramAutoThreadId uses parseTelegramTarget for canonical chat ID comparison (mirrors Slack pattern with parseSlackTarget)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Git index.lock from parallel agent required removal before SYNC-041 commit (resolved immediately)
- CHANGELOG edit for SYNC-040 was committed correctly but overlapped with parallel agent activity (no data loss)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8 complete: all 42 commits (SYNC-001 through SYNC-042) ported
- Ready for Phase 9 (Threading + Features)
- Forum topic threading stack is complete: DM threadId (08-03) + parentPeer (08-06) + auto-injection (08-06)

---
*Phase: 08-windows-acl-telegram-threading*
*Completed: 2026-02-06*
