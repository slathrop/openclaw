---
phase: 02-foundation-layer
plan: 06
subsystem: infra-security
tags: [typescript-to-javascript, ssrf, tls, outbound, security, fetch-guard, dns-pinning, certificate-fingerprint, delivery-routing]
dependency-graph:
  requires: [02-01]
  provides: [ssrf-protection-js, tls-fingerprint-js, outbound-delivery-js, fetch-guard-js]
  affects: [02-08, 02-10, 03-channels, 03-routing]
tech-stack:
  added: []
  patterns: [esbuild-type-stripping, security-jsdoc-annotations, eqeqeq-null-expansion]
key-files:
  created:
    - src/infra/net/ssrf.js
    - src/infra/net/fetch-guard.js
    - src/infra/tls/fingerprint.js
    - src/infra/tls/gateway.js
    - src/infra/outbound/deliver.js
    - src/infra/outbound/targets.js
    - src/infra/outbound/outbound-policy.js
    - src/infra/outbound/outbound-session.js
    - src/infra/outbound/message-action-runner.js
    - src/infra/outbound/message.js
    - src/infra/outbound/outbound-send-service.js
    - src/infra/outbound/target-resolver.js
    - src/infra/outbound/target-normalization.js
    - src/infra/outbound/target-errors.js
    - src/infra/outbound/channel-target.js
    - src/infra/outbound/agent-delivery.js
    - src/infra/outbound/channel-adapters.js
    - src/infra/outbound/channel-selection.js
    - src/infra/outbound/directory-cache.js
    - src/infra/outbound/envelope.js
    - src/infra/outbound/format.js
    - src/infra/outbound/message-action-spec.js
    - src/infra/outbound/payloads.js
  modified: []
decisions:
  - "esbuild transformSync used for bulk TS-to-JS conversion (regex approach insufficient for complex type annotations)"
  - "Unused tls import removed from gateway.js (was type-only in TS original)"
  - "Empty catch blocks annotated with explanatory comments for no-empty compliance"
  - "== null / != null expanded to === null || === undefined for eqeqeq compliance"
  - "SECURITY: comments added to all security-critical source files (17 files)"
patterns-established:
  - "esbuild-bulk-conversion: Use esbuild transformSync for directories with 10+ files instead of manual regex conversion"
  - "security-annotation: SECURITY: module-level JSDoc on all files handling SSRF, TLS, delivery routing, or policy enforcement"
metrics:
  duration: ~12m
  completed: 2026-02-04
---

# Phase 2 Plan 6: Net/TLS/Outbound Conversion Summary

**SSRF protection, TLS certificate handling, and outbound delivery engine (37 files) converted to JS with comprehensive SECURITY: annotations on all security-critical modules.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-04T23:28:00Z
- **Completed:** 2026-02-04T23:40:00Z
- **Tasks:** 2
- **Files modified:** 73 (37 created, 36 deleted)

## Accomplishments

- Converted 37 files across src/infra/net/, src/infra/tls/, and src/infra/outbound/ from TypeScript to JavaScript
- Added SECURITY: annotations to 17 security-critical source files documenting SSRF threat model, DNS pinning, TLS fingerprinting, delivery routing policy, and target allowlist validation
- All 86 tests passing (4 in net/tls, 82 in outbound across 12 test files)
- Zero TypeScript files remain in any of the three directories

## What Was Done

### Task 1: Convert src/infra/net/ and src/infra/tls/ (6 files)

Manually converted each file with comprehensive hand-written SECURITY: comments and JSDoc annotations.

**src/infra/net/ (SSRF Protection):**
- `ssrf.js` -- 14 SECURITY: comments documenting the full threat model: private IP range blocking (RFC 1918, loopback, link-local, IPv4-mapped IPv6), DNS pinning to prevent TOCTOU attacks, hostname blocklisting, and createPinnedDispatcher for connection-level enforcement
- `fetch-guard.js` -- 3 SECURITY: comments explaining SSRF-guarded fetch wrapper with per-hop redirect validation to prevent credential forwarding to unauthorized hosts

**src/infra/tls/ (Certificate Handling):**
- `fingerprint.js` -- 2 SECURITY: comments on TLS certificate fingerprint normalization and constant-format enforcement
- `gateway.js` -- 4 SECURITY: comments documenting TLSv1.3 minimum enforcement, auto-generated self-signed certificates, and fingerprint extraction for mTLS identity. Removed unused `tls` import (was type-only in TypeScript original).

**Tests:** `ssrf.pinning.test.js` and `fingerprint.test.js` converted; all 4 tests pass.

### Task 2: Convert src/infra/outbound/ (31 files)

Used esbuild's `transformSync` API for bulk type stripping (regex approach failed on complex TypeScript patterns like inline object type annotations and multi-line generics). Post-processed with eslint --fix and manual SECURITY: comment injection.

**Security-critical files with SECURITY: annotations (11 files):**
- `deliver.js` -- Outbound delivery engine with message chunking and retry
- `targets.js` -- Target resolution with allowlist validation and session context
- `outbound-policy.js` -- Cross-context messaging policy enforcement
- `outbound-session.js` -- Session routing and delivery key management
- `message-action-runner.js` -- Action execution engine with security-scoped message delivery
- `message.js` -- High-level send/poll API with target validation
- `outbound-send-service.js` -- Send orchestration with rate limiting
- `target-resolver.js` -- Directory-based target resolution
- `target-normalization.js` -- Target address sanitization
- `target-errors.js` -- Standardized security error messages
- `channel-target.js` -- Channel-specific target parameter routing

**Supporting modules (8 files):**
- `agent-delivery.js`, `channel-adapters.js`, `channel-selection.js`, `directory-cache.js`, `envelope.js`, `format.js`, `message-action-spec.js`, `payloads.js`

**Tests:** 12 test files converted; all 82 tests pass.

**Manual ESLint fixes (5 errors):**
- 2x `no-empty`: Empty catch blocks in message-action-runner.js and outbound-session.js annotated with explanatory comments
- 3x `eqeqeq`: `== null` / `!= null` expanded to `=== null || === undefined` in message-action-runner.js, outbound-session.js, and targets.js

## Verification

- `find src/infra/net/ src/infra/outbound/ src/infra/tls/ -name '*.ts' | wc -l` returns 0
- All 86 tests pass (vitest)
- ESLint reports 0 errors on all three directories
- 17 source files contain SECURITY: comments

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regex-based conversion failed for complex TypeScript patterns**
- **Found during:** Task 2 (outbound/ conversion)
- **Issue:** Two attempts at regex-based TypeScript-to-JavaScript conversion left syntax errors in 25+ files (inline object type annotations like `params: { channel: string; to: string }`, generic type parameters, multi-line type definitions)
- **Fix:** Switched to esbuild's `transformSync` API which properly parses TypeScript AST and strips all type annotations. Post-processed with eslint --fix and manual SECURITY comment injection (esbuild strips all comments)
- **Files affected:** All 31 outbound/ files
- **Verification:** 0 parsing errors, all 82 tests pass
- **Committed in:** 68de13379

**2. [Rule 1 - Bug] Unused tls import in gateway.js**
- **Found during:** Task 1 (tls/ conversion)
- **Issue:** `import tls from 'tls'` was imported only for `tls.TlsOptions` type reference in TypeScript; became unused in JavaScript
- **Fix:** Removed the unused import line
- **Files affected:** src/infra/tls/gateway.js
- **Verification:** ESLint passes, all tests pass
- **Committed in:** 8bb1e8260

**3. [Rule 1 - Bug] ESLint eqeqeq violations from loose null checks**
- **Found during:** Task 2 (outbound/ post-conversion)
- **Issue:** 3 instances of `== null` / `!= null` from esbuild output (TypeScript compiler emits loose equality for null/undefined checks)
- **Fix:** Expanded to explicit `=== null || === undefined` comparisons
- **Files affected:** message-action-runner.js, outbound-session.js, targets.js
- **Verification:** ESLint passes with 0 errors
- **Committed in:** 68de13379

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correctness and lint compliance. No scope creep. The esbuild approach is now established as the preferred bulk conversion method for remaining phases.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| esbuild for bulk conversion | Regex approach failed on complex TS patterns; esbuild properly parses AST |
| Remove unused tls import | Was type-only import; no runtime usage in JavaScript |
| Annotate empty catch blocks | Prefer explanatory comments over `// eslint-disable` for no-empty |
| Expand loose null checks | eqeqeq compliance; `=== null \|\| === undefined` is explicit |

## Commits

| Hash | Message |
|------|---------|
| 8bb1e8260 | feat(02-06): convert src/infra/net/ and src/infra/tls/ to JavaScript |
| 68de13379 | feat(02-06): convert src/infra/outbound/ to JavaScript |

## Issues Encountered

- **Regex conversion failure:** First two attempts at converting 31 outbound files via regex-based Node.js scripts failed badly. Complex TypeScript patterns (inline object type params, generic type parameters, conditional types, multi-line type annotations) are not reliably strippable with regex. Switching to esbuild's `transformSync` API resolved all issues with zero parsing errors. This learning is documented as an established pattern for future plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

No blockers. All 37 files converted with comprehensive security annotations. The security-critical modules (SSRF, TLS, outbound delivery) are now in JavaScript and ready for downstream consumers in routing and channel modules.

---
*Phase: 02-foundation-layer*
*Completed: 2026-02-04*
