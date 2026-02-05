---
phase: 05-ui-and-extensions
plan: 01
subsystem: ui
tags: [lit, vite, vitest, esbuild, web-components, browser-ui]

# Dependency graph
requires:
  - phase: 01-build-tooling
    provides: "ESLint config, build pipeline, esbuild devDependency"
  - phase: 02-foundation-layer
    provides: "Established esbuild conversion pipeline patterns"
provides:
  - "All 111 UI source and test files converted from .ts to .js"
  - "Lit decorator components converted to static properties + constructor pattern"
  - "Vite and Vitest configs converted to .js"
  - "index.html entry point updated to .js"
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lit static properties pattern (no decorators) for web components"
    - "Side-effect import path rewriting (import './file.ts' -> './file.js')"

key-files:
  created:
    - "ui/src/ui/app.js"
    - "ui/src/ui/components/resizable-divider.js"
    - "ui/vite.config.js"
    - "ui/vitest.config.js"
  modified:
    - "ui/index.html"
    - "ui/src/main.js"
    - "ui/src/ui/views/chat.js"

key-decisions:
  - "Private fields kept without underscore prefix in app.js (accessed externally by extracted helper modules)"
  - "Side-effect imports (no 'from' keyword) need separate regex pass for .ts->.js rewriting"
  - "Browser globals (document, window, MouseEvent) cause no-undef ESLint errors - pre-existing issue from TS era (UI files were excluded from ESLint when .ts)"

patterns-established:
  - "Lit static properties: convert @state() to { state: true }, @property({type: X}) to { type: X }"
  - "Lit constructor: ALL reactive property initializations moved to constructor after super()"
  - "customElements.define() call after class declaration replaces @customElement decorator"

# Metrics
duration: 10min
completed: 2026-02-05
---

# Phase 5 Plan 1: UI Source Conversion Summary

**111 Lit web component files converted from TypeScript to JavaScript with decorator-to-static-properties transformation, null equality fixes across 21 files, and Vite/Vitest config migration**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-05T18:42:57Z
- **Completed:** 2026-02-05T18:53:03Z
- **Tasks:** 2
- **Files modified:** 199

## Accomplishments
- Converted 111 UI source and test files from .ts to .js using esbuild pipeline
- Manually converted 2 Lit decorator files (app.ts with ~70 @state properties, resizable-divider.ts) to static properties + constructor pattern
- Removed all 3 declare global blocks (app, resizable-divider, assistant-identity)
- Fixed broken null equality regex patterns across 21 files (esbuild regex only captured single-char prefix)
- Updated Vite config, Vitest config, index.html entry point, and screenshot directories

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert 111 UI source and test files to JavaScript** - `ef8de8db0` (feat)
2. **Task 2: Update Vite config, Vitest config, index.html, and screenshot directories** - `ecb080afb` (chore)
3. **Fix: 2 side-effect imports still referencing .ts** - `09da8c6d7` (fix)

## Files Created/Modified
- `ui/src/ui/app.js` - Main Lit app component with static properties (70+ reactive props)
- `ui/src/ui/components/resizable-divider.js` - Resizable divider with static properties
- `ui/src/ui/assistant-identity.js` - Assistant identity (declare global removed)
- `ui/vite.config.js` - Vite config (type annotations stripped)
- `ui/vitest.config.js` - Vitest config (include pattern updated to *.test.js)
- `ui/index.html` - Entry point updated from main.ts to main.js
- `ui/src/main.js` - Side-effect import fixed (.ts -> .js)
- `ui/src/ui/views/chat.js` - Side-effect import fixed (.ts -> .js)
- 103 additional files converted from .ts to .js via esbuild bulk pipeline

## Decisions Made
- Private fields in app.js kept without underscore prefix because they are accessed by external helper modules (app-scroll.js, app-polling.js, app-tool-stream.js, etc.)
- Side-effect imports (bare `import './file.ts'` without `from`) required a separate fix pass since the esbuild pipeline only rewrote `from '...'` patterns
- Browser globals (document, window, MouseEvent) ESLint no-undef errors are pre-existing -- UI .ts files were excluded from ESLint, so these errors only surface now that files are .js

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken null equality regex output across 21 files**
- **Found during:** Task 1 (post-conversion verification)
- **Issue:** The null equality regex `([a-zA-Z0-9_$)\].])\s*==\s*null` captured only the last character before `==`, producing broken expansions like `row.totalTokens === null || s === undefined` (where `s` is wrong, should be `row.totalTokens`)
- **Fix:** Wrote fix-null-eq.mjs script with proper expression-capturing regex to repair all 21 affected files
- **Files modified:** 21 files across ui/src/
- **Verification:** Zero broken single-char null patterns remain
- **Committed in:** ef8de8db0 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed 2 side-effect imports still referencing .ts**
- **Found during:** Post-task verification
- **Issue:** Side-effect imports (`import './file.ts'` without `from` keyword) were not caught by the rewrite regex which only matched `from.*\.ts`
- **Fix:** Manually updated main.js and views/chat.js
- **Files modified:** ui/src/main.js, ui/src/ui/views/chat.js
- **Verification:** Zero .ts references remain in any .js file
- **Committed in:** 09da8c6d7 (separate fix commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- ESLint `no-undef` errors for browser globals (document, window, MouseEvent) across UI files -- these are pre-existing issues from the TS era when .ts files were excluded from ESLint config. Not a blocker for this conversion plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All UI source files converted to JavaScript
- Ready for Phase 5 Plan 2 (extensions conversion)
- Browser globals ESLint issue should be addressed in cleanup (add browser environment to ESLint config for ui/ files)

---
*Phase: 05-ui-and-extensions*
*Completed: 2026-02-05*
