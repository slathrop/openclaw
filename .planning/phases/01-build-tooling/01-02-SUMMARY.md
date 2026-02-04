---
phase: 01-build-tooling
plan: 02
subsystem: infra
tags: [eslint, stylistic, jsdoc, google-style, linting, formatting]

# Dependency graph
requires:
  - phase: 01-build-tooling/01
    provides: "TypeScript toolchain removed, clean devDependencies slate"
provides:
  - "ESLint 9 flat config with Google Style rules"
  - "Stylistic formatting rules (2-space indent, single quotes, always semicolons, no trailing commas)"
  - "JSDoc validation for src/**/*.js"
  - "ESLint ecosystem installed as devDependencies"
affects: [01-build-tooling/03, 02-foundation-layer]

# Tech tracking
tech-stack:
  added: [eslint ^9.39.2, @eslint/js ^9.39.2, @stylistic/eslint-plugin ^5.7.1, eslint-plugin-jsdoc ^62.5.1, globals ^17.3.0]
  patterns: [ESLint 9 flat config with defineConfig/globalIgnores, manual Google Style rules via @stylistic]

key-files:
  created: [eslint.config.js]
  modified: [package.json, pnpm-lock.yaml]

key-decisions:
  - "Manual Google Style rules via @stylistic instead of abandoned eslint-config-google"
  - "Max line length set to warn at 100 (not error at 80) to avoid noise during conversion"
  - "JSDoc require-jsdoc disabled; only validates existing JSDoc annotations"
  - "Accepted oxfmt formatting of eslint.config.js during transition period (Plan 03 will switch formatter)"

patterns-established:
  - "ESLint flat config pattern: defineConfig + globalIgnores + named config objects"
  - "Three-section config structure: base rules, stylistic rules, JSDoc validation"
  - "Trailing comma deviation explicitly documented in config comments"

# Metrics
duration: 5min
completed: 2026-02-04
---

# Phase 1 Plan 2: ESLint Configuration Summary

**ESLint 9 flat config with Google Style rules, @stylistic formatting (no-trailing-comma deviation), and JSDoc validation for src/**/\*.js\*\*

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-04T22:00:19Z
- **Completed:** 2026-02-04T22:05:17Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Installed ESLint 9 ecosystem (5 packages) as devDependencies
- Created comprehensive eslint.config.js with three rule sections: base JS, stylistic, JSDoc
- Configured Google Style rules with explicit no-trailing-comma deviation
- Set up JSDoc validation that validates existing annotations without requiring them everywhere
- All ignore patterns cover non-source directories (apps, assets, dist, docs/\_layouts, node_modules, patches, skills, vendor)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install ESLint dependencies** - `b976c6f61` (chore)
2. **Task 2: Create eslint.config.js with Google Style rules** - `85793313d` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified

- `eslint.config.js` - ESLint 9 flat config: Google Style base rules, @stylistic formatting rules (no-trailing-comma deviation), JSDoc validation for src/\*_/_.js
- `package.json` - Added 5 ESLint-related devDependencies
- `pnpm-lock.yaml` - Lock file updated with ESLint dependency tree

## Decisions Made

- **Manual Google Style rules:** Used @eslint/js recommended + @stylistic/eslint-plugin instead of abandoned eslint-config-google (last release 2016, no ESLint 9 support)
- **Max line length at 100 (warn):** Started with `['warn', 100]` instead of `['error', 80]` to avoid noise during conversion; will tighten in later phases per research recommendation
- **JSDoc require-jsdoc off:** Validates present JSDoc annotations for correctness but does not require JSDoc on every function -- matches project goal of JSDoc where helpful
- **Accepted oxfmt transitional formatting:** The pre-commit hook still runs oxfmt, which reformats eslint.config.js with double quotes and trailing commas (ironic given our rules); Plan 03 will switch the formatter to ESLint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm workspace root flag required**

- **Found during:** Task 1 (Install ESLint dependencies)
- **Issue:** `pnpm add -D` failed with workspace root warning requiring `-w` flag
- **Fix:** Used `pnpm add -Dw` instead of `pnpm add -D`
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** All 5 packages present in devDependencies
- **Committed in:** b976c6f61 (Task 1 commit)

**2. [Rule 3 - Blocking] pnpm install failed on node-llama-cpp postinstall**

- **Found during:** Task 1 (Install ESLint dependencies)
- **Issue:** First install attempt failed because node-llama-cpp postinstall script fails under Rosetta on Apple Silicon (pre-existing issue, not caused by this plan)
- **Fix:** Ran `pnpm install --ignore-scripts` to complete linking, then re-ran `pnpm add -Dw` which succeeded fully
- **Files modified:** none additional
- **Verification:** `pnpm exec eslint --version` outputs v9.39.2
- **Committed in:** b976c6f61 (Task 1 commit)

**3. [Rule 1 - Bug] oxfmt pre-commit hook reformats eslint.config.js**

- **Found during:** Task 2 (Create eslint.config.js)
- **Issue:** Pre-commit hook runs `pnpm format:fix` (oxfmt) which reformats the config file with double quotes and trailing commas, contradicting the ESLint rules the file defines
- **Fix:** Accepted oxfmt formatting during transition period. The file is semantically correct with all intended rules; only surface formatting differs. Plan 03 will switch the formatter.
- **Files modified:** eslint.config.js (reformatted by oxfmt)
- **Verification:** `node -e "import('./eslint.config.js').then(() => console.log('ok'))"` prints ok; ESLint can lint files using this config
- **Committed in:** 85793313d (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correct operation. No scope creep. oxfmt formatting conflict is temporary (resolved by Plan 03).

## Issues Encountered

- Concurrent Plan 01-01 metadata commit (`a79417aad`) advanced HEAD between Task 1 and Task 2 commits. This caused the first Task 2 commit attempt to fail with "cannot lock ref HEAD" error. Resolved by re-staging and committing against the updated HEAD.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ESLint is installed and ready; Plan 03 needs to update package.json scripts to use `eslint` instead of `oxlint`/`oxfmt`
- The pre-commit hook still runs oxfmt; Plan 03 should update it to run `eslint --fix`
- Config file will need reformatting to its own style once oxfmt is replaced (Plan 03)
- No blockers for Plan 03

---

_Phase: 01-build-tooling_
_Completed: 2026-02-04_
