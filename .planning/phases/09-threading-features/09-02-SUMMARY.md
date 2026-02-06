---
phase: 09-threading-features
plan: 02
subsystem: cli, docs
tags: [entry-point, node-options, ollama, contributing]

# Dependency graph
requires:
  - phase: 08-windows-acl-telegram-threading
    provides: Baseline CLI entry point and docs
provides:
  - SYNC-046 contributor handle update
  - SYNC-047 Ollama docs model.fallbacks fix
  - SYNC-048 CLI respawn uses Node CLI flag instead of NODE_OPTIONS
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI respawn passes --disable-warning directly to process.execPath instead of NODE_OPTIONS env var"

key-files:
  created: []
  modified:
    - CONTRIBUTING.md
    - docs/providers/ollama.md
    - docs/zh-CN/providers/ollama.md
    - src/entry.js
    - CHANGELOG.md

key-decisions:
  - "None - followed upstream exactly"

patterns-established:
  - "CLI flag-based respawn: pass Node flags as CLI args to spawned process, not via NODE_OPTIONS"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Phase 9 Plan 2: Contributor Handle, Ollama Docs Fix, CLI Respawn Fix Summary

**Ported SYNC-046/047/048: contributor handle, model.fallbacks docs fix, and CLI --disable-warning respawn via Node CLI arg instead of NODE_OPTIONS**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-06T19:18:55Z
- **Completed:** 2026-02-06T19:23:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added Gustavo Madeira Santana as contributor in CONTRIBUTING.md
- Fixed `model.fallback` to `model.fallbacks` (plural) in both English and zh-CN Ollama docs
- Rewrote CLI entry point respawn to pass `--disable-warning=ExperimentalWarning` as a Node CLI argument instead of setting `NODE_OPTIONS` env var, fixing `npm pack` on modern Node

## Task Commits

Each task was committed atomically:

1. **Task 1: SYNC-046 - Update contributor handle** - `42f178408` (chore)
2. **Task 2: SYNC-047 - Fix model.fallback to model.fallbacks** - `fc6694659` (docs)
3. **Task 3: SYNC-048 - Avoid NODE_OPTIONS for --disable-warning** - `40cb18137` (fix)

## Files Created/Modified
- `CONTRIBUTING.md` - Added Gustavo Madeira Santana contributor entry
- `docs/providers/ollama.md` - Fixed `fallback` to `fallbacks` in model selection example
- `docs/zh-CN/providers/ollama.md` - Same fix in Chinese locale
- `src/entry.js` - Rewrote `hasExperimentalWarningSuppressed()` to check both NODE_OPTIONS and execArgv; removed NODE_OPTIONS mutation; pass flag directly to spawned process CLI args
- `CHANGELOG.md` - Added fix entry for #9691

## Decisions Made
None - followed upstream commits exactly as written.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three upstream commits (SYNC-046 through SYNC-048) cleanly ported
- Ready for next plan in Phase 9

---
*Phase: 09-threading-features*
*Completed: 2026-02-06*
