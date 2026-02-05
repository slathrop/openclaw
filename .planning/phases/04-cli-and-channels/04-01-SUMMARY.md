---
phase: 04-cli-and-channels
plan: 01
subsystem: cli
tags: [esbuild, vitest, jsdoc, security-annotations, commander]

# Dependency graph
requires:
  - phase: 03-core-services
    provides: "Converted core services (agents, gateway, plugins, protocol) that CLI imports"
  - phase: 02-foundation-layer
    provides: "Converted foundation modules (config, routing, channels) that commands import"
  - phase: 01-build-tooling
    provides: "ESLint config, rolldown build, vitest config for .js files"
provides:
  - "397 CLI and command files converted from TypeScript to JavaScript"
  - "6 JSDoc @typedef modules for type-only files"
  - "33 SECURITY-annotated auth/credential command files"
  - "508 passing tests (200 CLI + 308 commands)"
affects: [04-02-channel-conversion, 04-03-remaining-channels, 05-ui-layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "esbuild transformSync bulk TS-to-JS conversion with keepNames"
    - "Strip esbuild __name/__defProp boilerplate from vi.mock test files"
    - "JSDoc @typedef modules replacing type-only .ts files"
    - "SECURITY annotation pattern for auth/credential files"

key-files:
  created:
    - "src/cli/daemon-cli/types.js (JSDoc @typedef module)"
    - "src/cli/nodes-cli/types.js (JSDoc @typedef module)"
    - "src/commands/agent/types.js (JSDoc @typedef module)"
    - "src/commands/onboard-types.js (JSDoc @typedef module)"
    - "src/commands/status.types.js (JSDoc @typedef module)"
    - "src/commands/models/list.types.js (JSDoc @typedef module)"
  modified:
    - "src/cli/**/*.js (170 files converted)"
    - "src/commands/**/*.js (227 files converted)"

key-decisions:
  - "esbuild keepNames generates __defProp/__name boilerplate; must strip from vi.mock test files"
  - "static { __name(this, 'ClassName') } in class bodies within vi.mock factories must be removed"
  - "Lodash-es not introduced: no patterns found in src/commands/ that would benefit (conservative approach)"
  - "33 auth/credential files annotated with SECURITY comments (exceeds 30+ target)"
  - "onboarding/types.js barrel re-export preserved as runtime re-export (not type-only)"

patterns-established:
  - "vi.mock __name fix: strip /* @__PURE__ */ __name(fn, 'name') wrappers and standalone __name() calls"
  - "Class static initializer __name: remove static { __name(this, 'X') } blocks from mock factories"

# Metrics
duration: ~35min
completed: 2026-02-05
---

# Phase 4 Plan 1: CLI and Commands Conversion Summary

**397 files (170 cli + 227 commands) converted from TypeScript to JavaScript via esbuild with 33 SECURITY annotations, 6 JSDoc @typedef modules, and 508 passing tests**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-02-05
- **Completed:** 2026-02-05
- **Tasks:** 3/3
- **Files modified:** 1158 (397 .ts deleted, 397 .js created, 38 test files fixed, remaining are intermediate)

## Accomplishments

- Converted all 170 files in src/cli/ and 227 files in src/commands/ from TypeScript to JavaScript
- Created 6 JSDoc @typedef modules for type-only files (daemon-cli/types, nodes-cli/types, agent/types, onboard-types, status.types, models/list.types)
- Added SECURITY annotations to 33 auth/credential command files
- Fixed esbuild __name/__defProp hoisting conflict with vitest vi.mock (37 test files cleaned)
- All 508 tests pass (200 CLI + 308 commands), ESLint 0 errors, openclaw --help works

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert src/cli/ (170 files)** - `43c8afad1` (feat)
2. **Task 2: Convert src/commands/ (227 files)** - `d6ef9c08f` (feat)
3. **Task 3: Verify CLI and commands test suites pass** - `ce88af776` (fix)

## Files Created/Modified

### JSDoc @typedef Modules (type-only files)
- `src/cli/daemon-cli/types.js` - GatewayRpcOpts, DaemonStatusOptions, DaemonInstallOptions, DaemonLifecycleOptions
- `src/cli/nodes-cli/types.js` - NodesRpcOpts, NodeListNode, PendingRequest, PairedNode, PairingList
- `src/commands/agent/types.js` - ImageContent, AgentStreamParams, AgentRunContext, AgentCommandOpts
- `src/commands/onboard-types.js` - OnboardMode, AuthChoice, GatewayAuthChoice, ResetScope, GatewayBind, TailscaleMode, NodeManagerChoice, ChannelChoice, OnboardOptions
- `src/commands/status.types.js` - SessionStatus, HeartbeatStatus, StatusSummary
- `src/commands/models/list.types.js` - ConfiguredEntry, ModelRow, ProviderAuthOverview

### SECURITY-Annotated Files (33 files)
- `src/commands/auth-choice*.js` (19 files) - Auth provider selection and credential application
- `src/commands/auth-token.js` - Token management
- `src/commands/configure.gateway-auth.js` - Gateway auth config
- `src/commands/doctor-auth.js`, `doctor-security.js` - Auth/security diagnostics
- `src/commands/oauth-flow.js`, `oauth-env.js` - OAuth token flows
- `src/commands/chutes-oauth.js` - Chutes OAuth flow
- `src/commands/onboard-auth*.js` (6 files) - Onboarding credential setup
- `src/commands/onboard-non-interactive/local/auth-choice.js` - Non-interactive auth

### Key Subdirectories Converted
- `src/cli/program/` (18 files) - Commander.js program setup
- `src/cli/daemon-cli/` (8 files) - Daemon lifecycle management
- `src/cli/nodes-cli/` (12 files) - Node management CLI
- `src/cli/gateway-cli/` (7 files) - Gateway CLI with run loop
- `src/commands/models/` (14 files) - Model management commands
- `src/commands/onboarding/` (5 files) - Onboarding wizard steps
- `src/commands/onboard-non-interactive/` (8 files) - Headless onboarding

## Decisions Made

1. **esbuild keepNames boilerplate must be stripped from test files**: esbuild with `keepNames: true` generates `const __defProp` and `const __name` at the top of every file. When vitest hoists `vi.mock()` factories above these declarations, `__name` is referenced before initialization (const temporal dead zone). Solution: strip all `__name` wrappers from test files that use `vi.mock`.

2. **Class static initializer __name must be removed**: Two test files (models.list.test.js, onboard-non-interactive.gateway.test.js) had `static { __name(this, 'ClassName') }` inside class bodies within mock factories. After the __defProp/__name declarations were removed, these references caused ReferenceError. Fix: remove the entire static initializer blocks.

3. **Lodash-es not introduced**: Scanned src/commands/ for patterns that would benefit from lodash-es (verbose reduce, Object.fromEntries(Object.entries(...).filter()), Object.keys().filter()). No meaningful opportunities found. Conservative approach per plan guidance.

4. **onboarding/types.js is a runtime barrel re-export**: Unlike other type-only files, `src/commands/onboarding/types.js` contains `export * from '../../channels/plugins/onboarding-types.js'` which is a runtime re-export that survived esbuild. Preserved as-is rather than converting to JSDoc @typedef.

5. **gateway.sigterm.test.js had hardcoded .ts paths**: Test contained `path.resolve('src/cli/gateway-cli/run-loop.ts')` and `path.resolve('src/runtime.ts')` which needed updating to `.js` extensions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] esbuild __name hoisting conflict with vitest vi.mock**
- **Found during:** Task 3 (verification)
- **Issue:** 10 of 57 command test files failed with `ReferenceError: Cannot access '__name' before initialization` because vitest hoists vi.mock() factories above the `const __name` declaration
- **Fix:** Created fix-test-mock-name.mjs to strip `/* @__PURE__ */ __name(fn, 'name')` wrappers and standalone `__name()` calls from 37 test files that use vi.mock
- **Files modified:** 37 test files across src/cli/ and src/commands/
- **Verification:** All 508 tests pass
- **Committed in:** ce88af776

**2. [Rule 1 - Bug] __name in class static initializers within mock factories**
- **Found during:** Task 3 (verification)
- **Issue:** 2 test files still failed after __name stripping because `__name(this, 'ClassName')` appeared inside class `static {}` blocks in mock factory bodies
- **Fix:** Removed `static { __name(this, 'ClassName'); }` blocks from mock class definitions
- **Files modified:** src/commands/models.list.test.js, src/commands/onboard-non-interactive.gateway.test.js
- **Verification:** Both test files pass (11 tests)
- **Committed in:** ce88af776

**3. [Rule 1 - Bug] Hardcoded .ts import paths in gateway sigterm test**
- **Found during:** Task 3 (verification)
- **Issue:** gateway.sigterm.test.js referenced `run-loop.ts` and `runtime.ts` via path.resolve()
- **Fix:** Changed extensions to `.js`
- **Files modified:** src/cli/gateway.sigterm.test.js
- **Verification:** Test passes
- **Committed in:** ce88af776

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for test correctness. The __name hoisting issue is specific to the esbuild+vitest combination and was discovered during verification. No scope creep.

## Issues Encountered

- **esbuild __name hoisting vs vitest vi.mock temporal dead zone**: The most significant issue. esbuild's `keepNames: true` option generates helper declarations at file top using `const`. When vitest hoists `vi.mock()` factory functions above these declarations, JavaScript's temporal dead zone prevents access. Three fix approaches were tried before finding the correct solution:
  1. Changed `const` to `var` for hoisting -- ESLint `no-var` rule flagged 668 errors
  2. Used `var` only in test files with eslint-disable -- `var` hoists declaration but not assignment, so `__name` was `undefined`
  3. Strip `__name` wrappers entirely from test files (correct approach -- __name is only for debugging function names)

- **update-cli.js complex multi-expression line**: Line 636 had 3 occurrences of `!= null` / `== null` on a single complex conditional that the automated regex missed. Required manual fixup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CLI and commands layers fully converted to JavaScript
- All 508 tests pass (200 CLI + 308 commands)
- ESLint reports 0 errors on all converted files
- Ready for Phase 4 Plan 3 (remaining channels: signal, imessage, web, channels, routing)
- The __name stripping pattern is now documented for any remaining test files in future plans

---
*Phase: 04-cli-and-channels*
*Completed: 2026-02-05*
