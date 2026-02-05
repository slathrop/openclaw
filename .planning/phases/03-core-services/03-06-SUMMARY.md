---
phase: 03-core-services
plan: 06
subsystem: agents-subdirectories
tags: [agents, tools, auth-profiles, pi-embedded, sandbox, skills, esbuild, security]
dependency-graph:
  requires: ["03-01", "03-05"]
  provides: ["agents subdirectory JavaScript modules", "auth-profiles SECURITY annotations", "tool implementations in JS"]
  affects: ["03-07", "03-08"]
tech-stack:
  added: []
  patterns: ["esbuild bulk conversion", "SECURITY annotations on credential files", "module-level JSDoc"]
file-tracking:
  key-files:
    created:
      - src/agents/auth-profiles/*.js (15 files)
      - src/agents/cli-runner/helpers.js
      - src/agents/pi-embedded-helpers/*.js (9 files)
      - src/agents/pi-embedded-runner/*.js (30 files)
      - src/agents/pi-extensions/*.js (10 files)
      - src/agents/sandbox/*.js (17 files)
      - src/agents/schema/*.js (2 files)
      - src/agents/skills/*.js (13 files)
      - src/agents/tools/*.js (60 files)
    modified: []
decisions:
  - id: "03-06-01"
    decision: "Multi-agent interleaving: 03-05 committed subdirectory files alongside root-level agents"
    reason: "Parallel agent 03-05 had overlapping scope; both agents wrote to same files simultaneously"
  - id: "03-06-02"
    decision: "SECURITY annotations on 4 auth-profiles files (store, oauth, profiles, types)"
    reason: "Credential storage, token refresh, profile scoping, and type definitions are security-sensitive"
  - id: "03-06-03"
    decision: "== null / != null replaced with strict equality in 3 files"
    reason: "eqeqeq ESLint compliance; content === null || content === undefined"
metrics:
  duration: "13m 44s"
  completed: "2026-02-05"
---

# Phase 3 Plan 6: Convert Agents Subdirectories Summary

**One-liner:** Auth-profiles with SECURITY annotations, tools with JSDoc, and 7 more subdirectories -- 159 files to JS with all 312 tests passing.

## What Was Done

### Task 1: Post-process agents subdirectory source files (excluding tools/)

The non-tools subdirectories (auth-profiles, cli-runner, pi-embedded-helpers, pi-embedded-runner, pi-extensions, sandbox, schema, skills) were bulk-converted by parallel agent 03-05. This plan added:

1. **SECURITY annotations** on 4 auth-profiles credential files:
   - `store.js` -- credential persistence, load/save/merge with file-level locking
   - `oauth.js` -- token refresh and exchange, lock-based concurrent refresh prevention
   - `profiles.js` -- per-profile credential scoping and ordering
   - `types.js` -- credential type definitions (API key, OAuth, token shapes)

2. **Module-level JSDoc** on 78 source files across all 8 subdirectories

3. **Strict equality fixes** in 3 files:
   - `pi-embedded-helpers/images.js`: `content == null` -> `content === null || content === undefined`
   - `pi-embedded-runner/run/attempt.js`: `c != null` -> `c !== null && c !== undefined`
   - `pi-embedded-runner/run/images.js`: `part != null` -> `part !== null && part !== undefined`

4. **ESLint auto-fixes** applied (unused parameter cleanup in context-pruning.test.js)

### Task 2: Convert agents/tools/ and verify all subdirectory tests

1. **Bulk conversion** of 60 .ts files via esbuild transformSync (done by parallel agent)
2. **Module-level JSDoc** added to 38 source files in tools/
3. **ESLint --fix** applied (0 errors, 47 warnings -- all max-len)
4. **All 36 test files pass** (312 tests) across all subdirectories:
   - auth-profiles: 2 test files
   - pi-embedded-runner: 6 test files
   - pi-extensions: 2 test files
   - sandbox: 1 test file
   - skills: 3 test files
   - tools: 22 test files

## Decisions Made

| ID | Decision | Reason |
|----|----------|--------|
| 03-06-01 | Multi-agent interleaving with 03-05 | Parallel agent committed subdirectory files as part of root-level agents batch; work was complementary |
| 03-06-02 | SECURITY annotations on 4 auth-profiles files | Credential storage, OAuth token refresh, profile scoping, and type shapes are security-sensitive |
| 03-06-03 | Strict equality replacement in 3 files | eqeqeq ESLint compliance for null checks |

## Deviations from Plan

### Multi-Agent Interleaving

**Found during:** Task 1 and Task 2
**Issue:** Parallel agent 03-05 converted and committed both the non-tools subdirectories (batch 1) and tools/ (batch 2) alongside root-level agents files. This plan's scope overlapped with 03-05.
**Resolution:** Post-processing work (SECURITY annotations, JSDoc, null-check fixes) was written to files before 03-05 committed, so all changes were included in 03-05's commits. No separate task commits needed.
**Commits:** d111d3d3c (batch 1: non-tools subdirs), 48e044b1d (batch 2: tools/)

## Verification Results

- Zero .ts files in all 9 agents subdirectories: PASS
- SECURITY annotations on auth-profiles store, oauth, profiles, types: PASS (4 files)
- Module-level JSDoc on all source files: PASS
- All subdirectory tests pass: PASS (36 test files, 312 tests)
- ESLint 0 errors: PASS (only max-len warnings)
- Cross-module imports preserved with .js extensions: PASS

## Files Changed

**Created (159 .js files replacing .ts originals):**
- `src/agents/auth-profiles/` -- 15 files (13 source + 2 tests)
- `src/agents/cli-runner/` -- 1 file
- `src/agents/pi-embedded-helpers/` -- 9 files
- `src/agents/pi-embedded-runner/` -- 30 files (24 source + 6 tests)
- `src/agents/pi-extensions/` -- 10 files (8 source + 2 tests)
- `src/agents/sandbox/` -- 17 files (16 source + 1 test)
- `src/agents/schema/` -- 2 files
- `src/agents/skills/` -- 13 files (10 source + 3 tests)
- `src/agents/tools/` -- 60 files (38 source + 22 tests)

## Next Phase Readiness

With all agents subdirectories converted, the entire `src/agents/` directory is now fully in JavaScript. Plans 03-07 (gateway tests) and 03-08 (agents root-level tests) can proceed to verify the full test suites.
