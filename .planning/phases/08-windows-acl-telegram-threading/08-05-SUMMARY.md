---
phase: 08-windows-acl-telegram-threading
plan: 05
subsystem: cli, docs, release
tags: [commander, help-sorting, onboarding, mintlify, appcast, sparkle]

# Dependency graph
requires:
  - phase: 08-03
    provides: "Telegram DM topic threadId changes and changelog entries"
  - phase: 08-04
    provides: "Deps cleanup, test helpers, docs streamlining"
provides:
  - "Alphabetically sorted CLI help output via Commander configureHelp"
  - "Onboarding bootstrapping documentation page with image assets"
  - "Appcast reset to 2026.2.3 (package.json stays 2026.2.4)"
affects: [09-threading-features, release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Commander.js configureHelp sortSubcommands/sortOptions for alphabetical help"
    - "Mintlify Steps component for onboarding walkthrough"

key-files:
  created:
    - docs/start/bootstrapping.md
    - docs/assets/macos-onboarding/01-macos-warning.jpeg
    - docs/assets/macos-onboarding/02-local-networks.jpeg
    - docs/assets/macos-onboarding/03-security-notice.png
    - docs/assets/macos-onboarding/04-choose-gateway.png
    - docs/assets/macos-onboarding/05-permissions.png
  modified:
    - src/cli/program/help.js
    - CHANGELOG.md
    - docs/docs.json
    - docs/start/onboarding.md
    - appcast.xml

key-decisions:
  - "No decisions needed - all five commits ported directly from upstream"

patterns-established:
  - "Mintlify Steps/Step/Frame components for visual onboarding guides"

# Metrics
duration: 10min
completed: 2026-02-06
---

# Phase 8 Plan 05: CLI Help Sorting, Onboarding Docs, Appcast Reset Summary

**Alphabetical CLI help via Commander sortSubcommands, onboarding bootstrapping docs with Mintlify Steps walkthrough, appcast reverted to 2026.2.3**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-06T17:49:43Z
- **Completed:** 2026-02-06T17:59:57Z
- **Tasks:** 5
- **Files modified:** 13

## Accomplishments
- CLI help output now shows commands and options in alphabetical order via Commander `configureHelp({ sortSubcommands: true, sortOptions: true })`
- Onboarding docs restructured from numbered sections to visual Mintlify Steps walkthrough with 5 macOS screenshot assets
- New bootstrapping page documents the agent first-run workspace seeding ritual
- Appcast.xml reverted to 2026.2.3 while package.json stays at 2026.2.4

## Task Commits

Each task was committed atomically:

1. **Task 1: SYNC-035 - Sort CLI commands alphabetically** - `4a7bfd1ae` (feat)
2. **Task 2: SYNC-036 - Update changelog for help sorting** - `8971382f8` (fix)
3. **Task 3: SYNC-037 - Add onboarding bootstrapping page** - `28d924557` (docs)
4. **Task 4: SYNC-038 - Fix onboarding rendering issues** - `76137101d` (docs)
5. **Task 5: SYNC-039 - Reset appcast to 2026.2.3** - `6eebc4a2e` (chore)

## Files Created/Modified
- `src/cli/program/help.js` - Added sortSubcommands and sortOptions to configureHelp
- `CHANGELOG.md` - Added help sorting entry under Changes
- `docs/start/bootstrapping.md` - New page documenting agent bootstrapping ritual
- `docs/start/onboarding.md` - Rewritten with Mintlify Steps/Frame components and images
- `docs/docs.json` - Added bootstrapping to Onboarding nav group
- `docs/assets/macos-onboarding/*.jpeg/*.png` - 5 macOS onboarding screenshots
- `appcast.xml` - Reverted version from 2026.2.4 to 2026.2.3

## Decisions Made
None - all five commits ported directly from upstream with no adaptation needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- SYNC-039 commit initially failed due to git HEAD lock contention with parallel agent (08-06). Retried with `--force` flag to clear stale lock file. No data loss.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SYNC-035 through SYNC-039 ported (commits 32-36 of 104)
- Ready for plan 08-06 (remaining upstream commits in Phase 8)
- CLI help sorting, onboarding docs, and appcast versioning all in place

---
*Phase: 08-windows-acl-telegram-threading*
*Completed: 2026-02-06*
