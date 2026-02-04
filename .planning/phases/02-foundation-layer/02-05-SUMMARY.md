---
phase: 02-foundation-layer
plan: 05
subsystem: infra-utilities
tags: [typescript-to-javascript, jsdoc, infra, retry, ports, archive, fetch]
dependency-graph:
  requires: [02-01]
  provides: [infra-utility-modules-js]
  affects: [02-06, 02-08, 02-09, 02-10]
tech-stack:
  added: []
  patterns: [jsdoc-typedef-only-files, optional-chaining-for-type-casts]
key-files:
  created:
    - src/infra/fetch.js
    - src/infra/archive.js
    - src/infra/errors.js
    - src/infra/dedupe.js
    - src/infra/backoff.js
    - src/infra/retry.js
    - src/infra/retry-policy.js
    - src/infra/format-duration.js
    - src/infra/fs-safe.js
    - src/infra/json-file.js
    - src/infra/is-main.js
    - src/infra/machine-name.js
    - src/infra/os-summary.js
    - src/infra/openclaw-root.js
    - src/infra/warnings.js
    - src/infra/brew.js
    - src/infra/canvas-host-url.js
    - src/infra/clipboard.js
    - src/infra/control-ui-assets.js
    - src/infra/git-commit.js
    - src/infra/voicewake.js
    - src/infra/ports.js
    - src/infra/ports-format.js
    - src/infra/ports-inspect.js
    - src/infra/ports-lsof.js
    - src/infra/ports-types.js
    - src/infra/binaries.js
    - src/infra/ws.js
    - src/infra/wsl.js
    - src/infra/node-shell.js
  modified: []
decisions:
  - "ports-types.ts converted to JSDoc typedef-only file (no runtime code)"
  - "Generic retryAsync<T> simplified by removing <T>, using Promise<*> in JSDoc"
  - "Type-only imports (import type) deleted; import { type Foo } reduced to import {}"
  - "(err as { code?: unknown }).code replaced with err?.code optional chaining"
metrics:
  duration: 11m 55s
  completed: 2026-02-04
---

# Phase 2 Plan 5: Misc Infrastructure Utilities Summary

Converted 43 miscellaneous infrastructure utility modules from TypeScript to JavaScript with JSDoc annotations.

## One-liner

Core infra utilities (retry, backoff, fetch, archive, ports, clipboard, voicewake, brew, etc.) converted to JS with JSDoc typedefs and module comments.

## What Was Done

### Task 1: Core utility and file I/O modules (21 files)

Converted fetch, archive, errors, dedupe, backoff, retry, retry-policy, format-duration, fs-safe, json-file, is-main, machine-name, os-summary, openclaw-root, and warnings from TypeScript to JavaScript. All type annotations stripped, JSDoc module comments and @param/@returns annotations added.

Key conversion patterns:
- `retryAsync<T>` generic removed; JSDoc uses `@param {() => Promise<*>}` and `@returns {Promise<*>}`
- `(err as { code?: unknown }).code` replaced with `err?.code` optional chaining
- `import type` lines deleted; mixed imports reduced to value-only
- Exported types converted to `@typedef` JSDoc comments
- SECURITY comments preserved on fs-safe (path traversal prevention) and json-file (0o600 permissions)

### Task 2: Platform, port management, and remaining modules (22 files)

Converted brew, canvas-host-url, clipboard, control-ui-assets, git-commit, voicewake, ports (5 files), binaries, ws, wsl, and node-shell.

Key conversions:
- `ports-types.ts` (type-only file) converted to `ports-types.js` with JSDoc `@typedef` definitions only (no runtime code)
- `control-ui-assets.ts` (222 lines) converted with full module documentation for asset resolution logic
- `ports-inspect.ts` (296 lines) converted with JSDoc cross-references to ports-types.js typedefs
- `voicewake.ts` converted preserving atomic file write and serialized lock patterns

**Note:** Agent 02-02 running in parallel had already committed Task 2 files. This plan's Task 2 produced identical conversions, confirming consistency.

## Verification

- All 47 tests passing across 13 test files
- ESLint: 0 errors, warnings only (JSDoc description completeness)
- ports-types.js verified to contain JSDoc typedefs (PortListener, PortUsageStatus, PortUsage, PortListenerKind)

## Deviations from Plan

### Overlap with parallel agent

**Found during:** Task 2 commit
**Issue:** Agent 02-02 (device/auth/security modules) also converted the Task 2 files as part of its larger scope
**Resolution:** Verified conversions were identical; committed only the unique Task 1 work and a minor style fix from the pre-commit hook
**Files affected:** All 22 Task 2 files

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| ports-types as typedef-only .js | Type-only .ts files become JSDoc typedef modules; no runtime code needed |
| Generic removal from retryAsync | JavaScript has no generics; Promise<*> in JSDoc conveys intent |
| Optional chaining for type casts | `err?.code` is cleaner than `(err as {...}).code` and works at runtime |

## Commits

| Hash | Message |
|------|---------|
| 0d9357d54 | feat(02-05): convert core utility and file I/O modules to JavaScript |
| 65812843e | style(02-05): fix trailing commas in test files from pre-commit hook |

## Next Phase Readiness

No blockers. All 43 files converted and tests passing. The infra/ directory modules that depend on these (e.g., routing, channels) can now import from .js files.
