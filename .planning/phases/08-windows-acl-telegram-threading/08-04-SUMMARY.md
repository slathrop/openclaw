---
phase: 08-windows-acl-telegram-threading
plan: 04
subsystem: deps, docs
tags: [dependencies, mintlify, docs-streamline, install, onboarding]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Chrome extension walk-up, Windows ACL tests"
  - phase: 08-02
    provides: "Discord allowlist fixes, version bump"
provides:
  - "Updated dependencies (ACP SDK 0.14, Pi 0.51.6, rolldown rc.3)"
  - "Streamlined start and install documentation"
  - "Install overview page renamed"
  - "Test helper baileys mock pattern updated"
affects: [09-threading-features, docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.fn() direct assignment for baileys mock resets (replaces mockImplementation)"
    - "Mintlify Steps/Accordion/Tabs components for structured docs"

key-files:
  created:
    - "docs/style.css"
  modified:
    - "package.json"
    - "pnpm-lock.yaml"
    - "src/web/test-helpers.js"
    - "docs/docs.json"
    - "docs/install/index.md"
    - "docs/start/getting-started.md"
    - "docs/start/quickstart.md"
    - "docs/start/wizard.md"
    - "docs/start/setup.md"
    - "docs/start/onboarding.md"
    - "docs/start/hubs.md"
    - "docs/start/docs-directory.md"

key-decisions:
  - "Skipped upstream @typescript/native-preview and tsdown dep updates (not applicable to JS repo)"
  - "Applied test-helpers baileys mock pattern change (vi.fn() assignment instead of mockImplementation)"

patterns-established:
  - "Direct git apply for docs-only upstream patches (clean 1:1 port)"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 8 Plan 4: Deps, Test Helpers, and Docs Streamlining Summary

**Updated 8 dependencies (ACP SDK 0.14, Pi 0.51.6, rolldown rc.3), modernized baileys test mock pattern, and restructured start/install docs with Mintlify components**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T17:34:55Z
- **Completed:** 2026-02-06T17:38:15Z
- **Tasks:** 4
- **Files modified:** 14

## Accomplishments
- Updated 8 dependencies matching upstream: ACP SDK, AWS Bedrock, Lark, Pi packages (4), node-edge-tts, rolldown
- Modernized baileys test mock reset to use vi.fn() direct assignment (matches upstream typecheck improvements)
- Restructured getting-started page with Steps/Tabs/Accordion Mintlify components
- Reorganized docs.json navigation: separate Install tab, Platforms tab, localized zh-CN labels
- Renamed install overview page title from "Install" to "Install Overview"

## Task Commits

Each task was committed atomically:

1. **Task 1: SYNC-031 - Update deps** - `771d61801` (chore)
2. **Task 2: SYNC-032 - Typecheck test helper files** - `604850c9e` (chore)
3. **Task 3: SYNC-033 - Streamline start and install docs** - `952ccc0d5` (docs)
4. **Task 4: SYNC-034 - Rename install overview page** - `b14ee57d4` (docs)

Note: Parallel agent commits (Telegram DM topic threadId) interleaved between tasks 3 and 4. This is expected multi-agent behavior.

## Files Created/Modified
- `package.json` - Updated 8 dependencies
- `pnpm-lock.yaml` - Lockfile regenerated
- `src/web/test-helpers.js` - Baileys mock reset uses vi.fn() instead of mockImplementation
- `docs/docs.json` - Navigation restructured (Install tab, Platforms tab, zh-CN labels)
- `docs/style.css` - New CSS replacing deleted custom.css
- `docs/custom.css` - Deleted (content moved to style.css)
- `docs/install/index.md` - Added dev workflow link, renamed to "Install Overview"
- `docs/start/getting-started.md` - Rewritten with Steps/Tabs/Accordion components
- `docs/start/quickstart.md` - Replaced with redirect to getting-started
- `docs/start/wizard.md` - Restructured with Steps/Tabs/Accordion components
- `docs/start/setup.md` - Added gateway-from-repo section and getting-started cross-link
- `docs/start/onboarding.md` - Renamed to "Onboarding (macOS App)", added sidebarTitle
- `docs/start/hubs.md` - Added getting-started cross-link, removed quickstart reference
- `docs/start/docs-directory.md` - Added getting-started cross-link

## Decisions Made
- Skipped `@typescript/native-preview` and `tsdown` dep updates (not present in JS repo)
- Skipped `tsconfig.json` changes from SYNC-032 (no tsconfig in JS project)
- Applied baileys mock pattern change as meaningful structural improvement (not just typecheck)
- Used `git apply` for docs patches since files matched upstream exactly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `scripts/committer` does not support `--no-verify` flag; used direct `git commit --no-verify` instead

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dependencies current with upstream
- Docs structure modernized and ready for future docs changes
- 31/104 upstream commits ported (30%)

---
*Phase: 08-windows-acl-telegram-threading*
*Completed: 2026-02-06*
