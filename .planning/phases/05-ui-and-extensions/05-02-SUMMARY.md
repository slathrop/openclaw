---
phase: 05-ui-and-extensions
plan: 02
subsystem: extensions
tags: [extensions, esbuild, typescript-to-javascript, jsdoc, package-json]
requires:
  - 01-build-tooling (ESLint config, build tooling)
  - 02-foundation-layer (esbuild pipeline patterns)
  - 04-cli-and-channels (private field underscore convention)
provides:
  - All 31 extension packages converted from TypeScript to JavaScript
  - Extension package.json files updated with .js entry points
  - openclaw dependency correctly placed in devDependencies
affects:
  - 05-03 (final verification plan)
  - 06-xx (any future extension work)
tech-stack:
  added: []
  patterns:
    - esbuild transformSync for bulk TS->JS conversion
    - JSDoc @typedef for type-only modules
    - Private field underscore-prefix convention
key-files:
  created:
    - extensions/**/*.js (394 files)
  modified:
    - extensions/*/package.json (30 files)
key-decisions:
  - 15 type-only files converted to JSDoc @typedef modules
  - Private fields converted to underscore-prefix convention
  - Empty catch blocks annotated with explanatory comments
  - openclaw moved from dependencies to devDependencies in 4 extensions
  - 55 remaining ESLint errors are all pre-existing from original TypeScript
duration: ~17m
completed: 2026-02-05
---

# Phase 5 Plan 02: Extension Package Conversion Summary

**Bulk esbuild conversion of 394 extension .ts files to .js across 31 packages with package.json entry point updates**

## Performance

| Metric | Value |
| --- | --- |
| Duration | ~17m |
| Start | 2026-02-05T18:43:55Z |
| End | 2026-02-05T19:01:11Z |
| Tasks | 2/2 |
| Files converted | 394 .ts -> .js |
| Package.json updated | 30 |
| Type-only files | 15 (JSDoc @typedef) |

## Task Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 9f00e5830 | Convert all 394 extension .ts files to JavaScript |
| 2 | 25f1756ca | Update 30 extension package.json entry points to .js |

## Execution Details

### Task 1: Convert 394 Extension .ts Files

Created a conversion script (`convert-extensions.mjs`) using established Phase 4 esbuild pipeline:
- esbuild `transformSync` with `loader: 'ts'`, `format: 'esm'`, `target: 'node22'`
- NO `keepNames` option (avoids `__defProp`/`__name` boilerplate that breaks vi.mock hoisting)
- Post-processing: strict equality replacement, empty catch comments, private field underscore-prefix

**Conversion breakdown:**
- 379 standard conversions (runtime code preserved)
- 15 type-only files converted to JSDoc `@typedef` modules
- 0 errors

**Extensions by size (largest first):**
- matrix: 67 files
- msteams: 58 files
- voice-call: 41 files
- twitch: 31 files
- bluebubbles: 23 files
- nostr: 23 files
- tlon: 20 files
- zalo: 17 files
- mattermost: 17 files
- nextcloud-talk: 16 files
- googlechat: 15 files
- zalouser: 15 files
- Remaining 19 extensions: 1-6 files each

**Special handling:**
- 1 class with inheritance (ZaloApiError extends Error) converted correctly
- 25 files with `private` keyword: field references updated to `_fieldName` convention
- 4 extensions with `openclaw` in `dependencies` moved to `devDependencies` (msteams, nostr, zalo, zalouser)

**Post-conversion fixes:**
- 9 files had broken `!=== null` (quadruple-equals) from null equality regex matching esbuild's existing `!== null`
- 2 files had broken optional chaining null checks (`data.ocs?.data?.id` -> broken expression split)
- 41 files needed empty catch block annotation (parameterless `catch { }` pattern)
- 1 file had `@typescript-eslint/no-useless-constructor` rule reference updated to `no-useless-constructor`
- 1 file had `no-control-regex` eslint-disable comment restored (stripped by esbuild)
- 1 file had `!= 'success'` fixed to `!== 'success'` (eqeqeq)

### Task 2: Update 30 Extension package.json Files

Updated `openclaw.extensions` array in all 30 package.json files from `./index.ts` to `./index.js`. The 31st extension (qwen-portal-auth) uses `openclaw.plugin.json` instead of `package.json`.

Verified all referenced `index.js` files exist (31 total).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Broken null equality replacements**
- **Found during:** Task 1 post-conversion verification
- **Issue:** Null equality regex matched esbuild's existing `!== null` output, creating `!=== null` (4 chars)
- **Fix:** sed replacement of `!=== -> !==` in 9 files; manual fix of 2 broken optional chaining expressions
- **Files modified:** 11 files across extensions

**2. [Rule 1 - Bug] Missing empty catch block comments**
- **Found during:** Task 1 ESLint verification
- **Issue:** Initial conversion script only handled `catch(param) { }` pattern; missed parameterless `catch { }` with newline
- **Fix:** Wrote and ran `fix-empty-catch.mjs` to handle all catch block patterns (41 files)
- **Files modified:** 41 files across extensions

**3. [Rule 3 - Blocking] ESLint TypeScript rule reference in JS file**
- **Found during:** Task 1 ESLint verification
- **Issue:** diagnostics-otel test had `@typescript-eslint/no-useless-constructor` disable comment that doesn't exist in JS
- **Fix:** Changed to `no-useless-constructor` and added empty block comment
- **Files modified:** extensions/diagnostics-otel/src/service.test.js

## Decisions Made

1. **Pre-existing ESLint errors left as-is:** 55 remaining errors are all from patterns in the original TypeScript source (unused destructuring vars like `_ignored`, unused function params like `_ctx`/`_input`, pre-existing `no-undef` for `formatUd`). These are not conversion-introduced.
2. **30 vs 31 package.json:** Plan stated 31 but qwen-portal-auth uses `openclaw.plugin.json` format. 30 package.json files + 1 plugin.json = 31 extensions total.
3. **No import path rewriting needed:** Extensions already use `.js` import extensions (confirmed by plan research).

## Verification Results

| Check | Result |
| --- | --- |
| Zero .ts files in extensions/ | PASS (0) |
| No .ts refs in package.json | PASS (0) |
| All 31 extensions have index.js | PASS (31) |
| No esbuild boilerplate | PASS (0 __defProp/__name) |
| openclaw in devDeps only | PASS (msteams, nostr, zalo, zalouser) |
| ESLint | 55 errors (all pre-existing), 225 warnings (line-length) |

## Next Phase Readiness

All extension packages are now JavaScript. Ready for Phase 5 Plan 03 (final verification).
