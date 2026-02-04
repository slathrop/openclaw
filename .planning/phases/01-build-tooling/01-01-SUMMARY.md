---
phase: 01-build-tooling
plan: 01
subsystem: build-tooling
tags: [rolldown, bundler, dependency-cleanup, toolchain]
requires: []
provides:
  - rolldown.config.js bundler configuration
  - Clean dependency tree with no TS-specific devDependencies
affects:
  - 01-02 (ESLint config replaces removed oxlint/oxfmt)
  - 01-03 (package.json scripts need updating to remove tsdown/tsx/oxlint/oxfmt references)
tech-stack:
  added: []
  removed:
    [
      typescript,
      "@typescript/native-preview",
      tsdown,
      tsx,
      oxlint,
      oxfmt,
      oxlint-tsgolint,
      "@types/express",
      "@types/markdown-it",
      "@types/node",
      "@types/proper-lockfile",
      "@types/qrcode-terminal",
      "@types/ws",
      "@grammyjs/types",
    ]
  patterns: [rolldown-direct-config, esm-bundling]
key-files:
  created: [rolldown.config.js]
  modified: [package.json, pnpm-lock.yaml]
  deleted: [tsconfig.json, tsdown.config.ts, .oxlintrc.json, .oxfmtrc.jsonc]
key-decisions:
  - Rolldown config references current .ts entry points (rolldown strips types natively)
  - Native module bundling errors deferred to Plan 03 (external dependencies config)
duration: 3m 30s
completed: 2026-02-04
---

# Phase 1 Plan 1: Remove TypeScript Toolchain and Create Rolldown Config Summary

Removed all TypeScript compilation toolchain files and dependencies; created rolldown.config.js with 4 ESM entry points replacing tsdown.config.ts.

## Performance

| Metric         | Value                |
| -------------- | -------------------- |
| Duration       | 3m 30s               |
| Started        | 2026-02-04T21:59:34Z |
| Completed      | 2026-02-04T22:03:04Z |
| Tasks          | 2/2                  |
| Files created  | 1                    |
| Files modified | 2                    |
| Files deleted  | 4                    |

## Accomplishments

1. **Deleted all TypeScript config files** from repo root: tsconfig.json, tsdown.config.ts, .oxlintrc.json, .oxfmtrc.jsonc
2. **Removed 14 TS-specific devDependencies**: typescript, @typescript/native-preview, tsdown, tsx, oxlint, oxfmt, oxlint-tsgolint, @types/express, @types/markdown-it, @types/node, @types/proper-lockfile, @types/qrcode-terminal, @types/ws, @grammyjs/types
3. **Created rolldown.config.js** with 4 entry points matching the old tsdown.config.ts: src/index.ts, src/entry.ts, src/plugin-sdk/index.ts, src/extensionAPI.ts
4. **Verified rolldown config** loads as valid ESM and rolldown can process .ts files natively

## Task Commits

| Task | Name                                                    | Commit    | Type  |
| ---- | ------------------------------------------------------- | --------- | ----- |
| 1    | Remove TypeScript toolchain files and dependencies      | 4c417ba9a | chore |
| 2    | Create rolldown.config.js with current .ts entry points | a8f2fe26d | feat  |

## Files Created

- `rolldown.config.js` -- Rolldown bundler config with 4 ESM entry points (replaces tsdown.config.ts)

## Files Modified

- `package.json` -- Removed 14 TS-specific devDependencies from devDependencies
- `pnpm-lock.yaml` -- Updated lockfile to reflect dependency removals

## Files Deleted

- `tsconfig.json` -- TypeScript compiler configuration
- `tsdown.config.ts` -- tsdown bundler configuration
- `.oxlintrc.json` -- Oxlint linter configuration
- `.oxfmtrc.jsonc` -- Oxfmt formatter configuration

## Decisions Made

| Decision                            | Rationale                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry points reference .ts files    | Rolldown strips TypeScript annotations natively (same engine as esbuild). Source files have not been converted to .js yet (Phase 2+). The config will be updated when source files convert. |
| Deferred native module externals    | Rolldown produces errors when bundling .node native modules. This requires `external` config which is a Plan 03 concern (wiring scripts).                                                   |
| Kept vitest and @vitest/coverage-v8 | These are testing tools that stay; they are not TypeScript-specific.                                                                                                                        |
| Kept package.json scripts unchanged | Plan explicitly defers script updates to Plan 01-03. Scripts still reference tsdown/tsx/oxlint/oxfmt but these are non-functional until updated.                                            |

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

1. **pnpm not on PATH initially** -- Resolved by running `corepack enable pnpm` to make pnpm available. This is a local environment issue, not a project issue.
2. **pnpm install postinstall failures** -- node-llama-cpp and @matrix-org/matrix-sdk-crypto-nodejs postinstall scripts fail. These are optional/peer native modules unrelated to our changes. The lockfile resolves correctly (`pnpm install --ignore-scripts` succeeds).

## Next Phase Readiness

Plan 01-02 (ESLint config) can proceed immediately. The removed oxlint/oxfmt configs are no longer present, and eslint.config.js will replace them. No blockers.

Plan 01-03 (script updates) can proceed after 01-02. The package.json scripts still reference tsdown, tsx, oxlint, and oxfmt but this is expected and will be cleaned up in that plan.
