# Phase 6: Verification and Parity - Research

**Researched:** 2026-02-05
**Domain:** Test suite verification, coverage validation, and feature parity after TypeScript-to-JavaScript conversion
**Confidence:** HIGH

## Summary

Phase 6 is the final verification phase that ensures the TypeScript-to-JavaScript conversion maintains feature parity and test coverage. This phase focuses on three main areas: (1) fixing test failures that emerged during conversion, (2) validating code coverage meets thresholds, and (3) verifying all CLI commands, channels, and UI components work identically to the TypeScript version.

Research reveals 143 failed test suites (106 individual test failures) that fall into several distinct categories requiring different fix patterns. The failures are not widespread but concentrated in specific areas related to module loading order (circular imports), variable minification artifacts, and mock setup issues.

**Primary recommendation:** Categorize test failures by root cause, fix systematic issues first (circular imports, variable references), then address individual test-specific failures.

## Standard Stack

The verification phase uses the existing toolchain already in place:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner and framework | Already configured, supports coverage |
| @vitest/coverage-v8 | ^4.0.18 | Coverage collection via V8 | Fast native coverage, already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pnpm | 10.23.0 | Package manager | All npm operations |
| rolldown | 1.0.0-rc.2 | Build tool | Verify build succeeds |
| eslint | ^9.39.2 | Linting | Verify no lint regressions |

### Configuration Files
| File | Purpose | Critical Settings |
|------|---------|-------------------|
| vitest.config.js | Main test config | 70% coverage thresholds |
| vitest.unit.config.js | Unit tests (excludes gateway/extensions) | Inherits from main |
| vitest.gateway.config.js | Gateway tests only | Inherits from main |
| vitest.extensions.config.js | Extension tests only | Inherits from main |
| vitest.e2e.config.js | End-to-end tests | Separate config |
| vitest.live.config.js | Live API tests | Separate config |

**Test execution command:**
```bash
pnpm test  # Runs test-parallel.mjs which executes unit, extensions, gateway in parallel
```

## Architecture Patterns

### Test File Organization
```
src/
  *.test.js                    # Colocated unit tests (913 files)
  **/                          # Subdirectories with colocated tests
extensions/
  **/*.test.js                 # Extension tests (77 files)
test/
  setup.js                     # Global test setup
  test-env.js                  # Environment isolation
  *.e2e.test.js               # End-to-end tests
```

### Pattern 1: Isolated Test Environment
**What:** Each test runs in an isolated home directory with fresh state
**When to use:** All tests that touch file system or config
**Example:**
```javascript
// Source: test/setup.js
import { withIsolatedTestHome } from './test-env';
const testEnv = withIsolatedTestHome();
afterAll(() => testEnv.cleanup());
```

### Pattern 2: Plugin Registry Reset
**What:** Reset plugin registry between tests to prevent state leakage
**When to use:** Any test involving channel routing or messaging
**Example:**
```javascript
// Source: test/setup.js
import { setActivePluginRegistry } from '../src/plugins/runtime.js';
beforeEach(() => {
  setActivePluginRegistry(createDefaultRegistry());
});
```

### Pattern 3: Mock Factory Reset
**What:** Use vi.resetAllMocks() or vi.restoreAllMocks() in afterEach
**When to use:** Tests using vi.mock() or vi.spyOn()
**Example:**
```javascript
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});
```

### Anti-Patterns to Avoid
- **Shared mutable state:** Tests should not rely on state from previous tests
- **Missing mock cleanup:** Always restore mocks to prevent test pollution
- **Circular import at test time:** Ensure test imports don't create circular references

## Don't Hand-Roll

Problems that have existing solutions in the codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test environment isolation | Custom temp dir logic | withIsolatedTestHome() | Handles cleanup properly |
| Channel plugin mocking | Manual plugin stubs | createTestRegistry() | Matches production patterns |
| Timer manipulation | setTimeout mocks | vi.useFakeTimers() | Vitest native support |
| Coverage collection | Custom instrumentation | v8 provider via vitest | Already configured |

**Key insight:** The test infrastructure is already mature. Focus on fixing failures, not restructuring.

## Common Pitfalls

### Pitfall 1: CommandLane Circular Import
**What goes wrong:** "Cannot access 'CommandLane' before initialization" error
**Why it happens:** Module loading order in esbuild-converted code creates temporal dead zone
**How to avoid:** The circular import exists between process/lanes.js -> logging/diagnostic.js -> infra/diagnostic-events.js chain. Tests that import modules in different orders hit this.
**Warning signs:** ReferenceError mentioning "before initialization"
**Fix pattern:** Lazy import CommandLane where needed, or restructure imports to break cycle

### Pitfall 2: Variable Minification Artifacts
**What goes wrong:** "ReferenceError: e is not defined" or "d is not defined"
**Why it happens:** esbuild keepNames boilerplate was stripped in Phase 4, but some test files may have residual minified variable references
**How to avoid:** Check for lingering __name wrappers or minified variable patterns
**Warning signs:** Single-letter variable references in error messages
**Fix pattern:** Search for and fix remaining minified patterns

### Pitfall 3: Import Path Mismatches
**What goes wrong:** Module not found or import resolution failures
**Why it happens:** Some imports still reference .ts extensions instead of .js
**How to avoid:** Grep for remaining .ts import paths
**Warning signs:** ERR_MODULE_NOT_FOUND errors
**Fix pattern:** sed/grep replacement of .ts -> .js in import statements

### Pitfall 4: Mock Hoisting with vi.mock
**What goes wrong:** Mocks not applied or undefined constructors
**Why it happens:** vi.mock() is hoisted but factory function may reference variables not yet defined
**How to avoid:** Use named function declarations for mock constructors (not arrow functions)
**Warning signs:** Tests fail with "X is not a constructor" or undefined mock
**Fix pattern:** Convert arrow functions to named function declarations in mock factories

### Pitfall 5: Coverage Threshold Failures
**What goes wrong:** Coverage falls below 70% threshold
**Why it happens:** New uncovered code or coverage exclusions not configured
**How to avoid:** Check coverage.include and coverage.exclude in vitest.config.js
**Warning signs:** Coverage numbers below threshold in CI/local output
**Fix pattern:** Add tests or add exclusions for legitimately untestable code

## Code Examples

### Running Tests with Coverage
```bash
# Full test suite (parallel execution)
pnpm test

# With coverage report
pnpm test:coverage

# Single config
pnpm vitest run --config vitest.unit.config.js
```

### Verifying Coverage Thresholds
```javascript
// vitest.config.js coverage configuration
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 55,
    statements: 70
  }
}
```

### Fixing Circular Import Pattern
```javascript
// Instead of top-level import that creates cycle:
// import { CommandLane } from './lanes.js';

// Use lazy import in function:
function getCommandLane() {
  const { CommandLane } = require('./lanes.js');
  return CommandLane;
}
```

### CLI Command Verification
```bash
# Verify gateway starts
pnpm openclaw gateway run --bind loopback --port 18789 --force

# Verify channels status
pnpm openclaw channels status --probe

# Verify agent message
pnpm openclaw agent --message "test" --dry-run

# Verify config
pnpm openclaw config get

# Verify status
pnpm openclaw status

# Verify doctor
pnpm openclaw doctor
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Istanbul coverage | V8 coverage | Vitest 3.2.0+ | Faster, same accuracy |
| Jest-style mocking | vi.mock/vi.spyOn | Vitest migration | More ergonomic |
| TypeScript source tests | JavaScript tests | This conversion | Simpler toolchain |

**Deprecated/outdated:**
- .ts test files: All converted to .js in Phase 5
- vitest top-level package.json key: Removed in Phase 1 (vitest.config.js is source of truth)

## Test Failure Categories

Based on current state (143 failed test suites, 106 failed tests):

### Category 1: Circular Import Failures (~50%)
- Files affected: Most auto-reply/*, agents/*, gateway/* tests
- Root cause: CommandLane temporal dead zone
- Fix: Restructure import order or use lazy imports

### Category 2: Minified Variable References (~20%)
- Files affected: Various files with "e is not defined", "d is not defined"
- Root cause: Residual esbuild artifacts
- Fix: Locate and fix specific files

### Category 3: Individual Test Logic (~20%)
- Files affected: Scattered across test suite
- Root cause: Test-specific issues (mock setup, assertions)
- Fix: Individual test fixes

### Category 4: Module Resolution (~10%)
- Files affected: Files with remaining .ts paths
- Root cause: Incomplete path conversion
- Fix: Grep and replace remaining .ts imports

## Verification Checklist

### Plan 06-01: Test Suite and Coverage
- [ ] Run `pnpm test` - all tests pass
- [ ] Run `pnpm test:coverage` - meets 70% thresholds
- [ ] Verify no new test failures from conversion
- [ ] Check coverage include/exclude patterns are correct

### Plan 06-02: CLI and Runtime Verification
- [ ] `openclaw gateway run` - starts without error
- [ ] `openclaw channels status` - shows channel states
- [ ] `openclaw agent --message` - processes messages
- [ ] `openclaw config` - reads/writes config
- [ ] `openclaw status` - displays system status
- [ ] `openclaw doctor` - runs diagnostics

### Plan 06-03: Channels, UI, Extensions
- [ ] All messaging channels connect (Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Feishu, LINE)
- [ ] Web UI loads and connects via WebSocket
- [ ] Extensions load and function (verify against extensions/*)

## Open Questions

Things that couldn't be fully resolved:

1. **Native module test failures**
   - What we know: @lancedb/lancedb-darwin-x64 not available warning in test output
   - What's unclear: Whether this is test environment or conversion issue
   - Recommendation: Skip or mock native module tests if not critical path

2. **Pre-existing lint errors**
   - What we know: scripts/run-node.mjs has eqeqeq violations from before conversion
   - What's unclear: Whether to fix in this phase or defer
   - Recommendation: Fix if touched, otherwise defer to post-conversion cleanup

3. **Browser globals in UI tests**
   - What we know: ESLint no-undef for document, window, MouseEvent in ui/ files
   - What's unclear: ESLint config for browser environment in ui/ path
   - Recommendation: Add browser globals to ESLint config for ui/ files

## Sources

### Primary (HIGH confidence)
- Vitest official documentation: https://vitest.dev/guide/coverage.html
- Project vitest.config.js: Direct inspection of test configuration
- Test output analysis: 143 failed suites categorized from pnpm test run

### Secondary (MEDIUM confidence)
- [Vitest Debugging Guide](https://vitest.dev/guide/debugging)
- [Vitest Coverage Configuration](https://vitest.dev/config/coverage)
- [Vitest 4.0 Announcement](https://vitest.dev/blog/vitest-4)

### Tertiary (LOW confidence)
- WebSearch results for debugging patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Direct inspection of project files
- Architecture: HIGH - Analyzed actual test infrastructure
- Pitfalls: HIGH - Derived from actual test output analysis
- Fix patterns: MEDIUM - Based on similar conversion projects

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain)
