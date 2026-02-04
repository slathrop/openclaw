# Testing Patterns

**Analysis Date:** 2026-02-04

## Test Framework

**Runner:**
- Vitest 4.0.18
- Multiple config files for different test suites:
  - `vitest.config.ts` - Main unit test config
  - `vitest.e2e.config.ts` - End-to-end tests
  - `vitest.live.config.ts` - Tests with real external services
  - `vitest.unit.config.ts` - Alternative unit config
  - `vitest.gateway.config.ts` - Gateway-specific tests
  - `vitest.extensions.config.ts` - Extension tests

**Assertion Library:**
- Vitest built-in assertions (expect)

**Run Commands:**
```bash
pnpm test                      # Run all unit tests
pnpm test:watch               # Watch mode (re-run on changes)
pnpm test:coverage            # Generate coverage report (V8 provider)
pnpm test:e2e                 # Run E2E tests
pnpm test:live                # Run tests with real external services
OPENCLAW_LIVE_TEST=1 pnpm test:live  # Live tests with OpenClaw setup
LIVE=1 pnpm test:live         # Live tests including provider tests
```

## Test File Organization

**Location:**
- Co-located with source: `src/**/*.test.ts` sits next to `src/**/*.ts`
- E2E tests: `src/**/*.e2e.test.ts` or `test/**/*.e2e.test.ts`
- Live tests: `src/**/*.live.test.ts` (real API keys required)

**Naming:**
- Unit test: `agent-paths.test.ts`
- E2E test: `query-interpreter-runtime.e2e.test.ts`
- Live test: `anthropic.setup-token.live.test.ts`
- Feature-scoped test: `auth-profiles.ensureauthprofilestore.test.ts`, `bash-tools.exec.pty.test.ts`
- Scope clarity: Test names include the specific behavior tested

**Vitest Configuration Exclusions:**
```typescript
// vitest.config.ts exclude patterns
exclude: [
  "dist/**",
  "apps/macos/**",
  "**/node_modules/**",
  "**/vendor/**",
  "**/*.live.test.ts",
  "**/*.e2e.test.ts",
]
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";

describe("resolveOpenClawAgentDir", () => {
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;
  const previousAgentDir = process.env.OPENCLAW_AGENT_DIR;
  let tempStateDir: string | null = null;

  afterEach(async () => {
    // Cleanup
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
      tempStateDir = null;
    }
    // Restore env vars
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
  });

  it("defaults to the multi-agent path when no overrides are set", async () => {
    // Setup
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-agent-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    delete process.env.OPENCLAW_AGENT_DIR;

    // Test
    const resolved = resolveOpenClawAgentDir();

    // Assert
    expect(resolved).toBe(path.join(tempStateDir, "agents", "main", "agent"));
  });
});
```

**Patterns:**
- Setup/teardown via `beforeEach()`/`afterEach()` - NOT `before()`/`after()`
- Capture original state at top of describe block
- Restore state in afterEach (handle undefined vs set values)
- Single assertion per test when possible
- Descriptive test names explaining the behavior: "defaults to X when Y", "honors Z overrides"

## Mocking

**Framework:** Vitest's built-in `vi` object (not sinon, not jest)

**Patterns:**
```typescript
// File system mocking
beforeEach(() => {
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-auth-"));
  // ... use agentDir
  // cleanup in afterEach
});

// Environment variable mocking
const previousVar = process.env.SOME_VAR;
process.env.SOME_VAR = "test-value";
// restore in afterEach

// Fake timers (note: reset in afterEach)
vi.useFakeTimers();
// ... test code
vi.useRealTimers(); // IMPORTANT: reset to avoid leaking to other tests
```

**Fixture Pattern from test/setup.ts:**
```typescript
// Create stub implementations
const createStubPlugin = (params: { id: ChannelId; ... }): ChannelPlugin => ({
  id: params.id,
  meta: { ... },
  config: { ... },
  outbound: createStubOutbound(params.id),
});

// Set in beforeEach
beforeEach(() => {
  setActivePluginRegistry(createDefaultRegistry());
});
```

**What to Mock:**
- File system operations (use `fs.mkdtempSync()` for test isolation)
- Environment variables (save/restore around test)
- Third-party service clients (create stubs in test setup)
- Process state (e.g., fake timers, but restore after)

**What NOT to Mock:**
- Core utilities/helpers (test real implementation)
- Data transformation functions (test real logic)
- Simple predicates/validators
- Unless behavior is external API dependent, test real code

## Fixtures and Factories

**Test Data:**
```typescript
// From test/setup.ts - auth profiles example
const mainStore = {
  version: AUTH_STORE_VERSION,
  profiles: {
    "openai:default": {
      type: "api_key",
      provider: "openai",
      key: "main-key",
    },
  },
};
fs.writeFileSync(
  path.join(mainDir, "auth-profiles.json"),
  `${JSON.stringify(mainStore, null, 2)}\n`,
  "utf8",
);
```

**Location:**
- Test setup helpers: `test/setup.ts` (global test fixtures)
- Test environment: `test/test-env.ts` (isolated home directories)
- Inline fixtures: Most tests create fixtures inline within describe block
- Shared test utilities: `src/test-utils/` (port allocation, channel plugins, etc.)

**Patterns:**
- Create temporary directories with `fs.mkdtempSync()` for isolation
- Write test data directly to files (not through API when testing file I/O)
- Clean up in afterEach (recursive deletion with force flag)
- Use descriptive paths: `path.join(os.tmpdir(), "openclaw-auth-")`

## Coverage

**Requirements:**
- Lines: 70%
- Functions: 70%
- Branches: 55%
- Statements: 70%

**Configured in:** `vitest.config.ts` coverage section

**View Coverage:**
```bash
pnpm test:coverage
# Output: text report to stdout + lcov report
```

**Excluded from Coverage:**
- `src/**/*.test.ts` (test files)
- `src/entry.ts`, `src/index.ts`, `src/runtime.ts` (entrypoints)
- `src/cli/**`, `src/commands/**` (CLI wiring)
- `src/daemon/**`, `src/hooks/**`, `src/macos/**` (platform-specific)
- `src/agents/model-scan.ts`, `src/agents/pi-*.ts` (validated via e2e)
- Gateway server integration surfaces (`src/gateway/server-*.ts`)
- Interactive UIs (`src/tui/**`, `src/wizard/**`)
- Channel implementations (`src/discord/**`, `src/slack/**`, etc. - integration tested)

## Test Types

**Unit Tests:**
- Scope: Single function/module behavior
- Location: Co-located `.test.ts` files
- Run: `pnpm test` (default config in vitest.config.ts)
- Example: `src/agents/agent-paths.test.ts` tests path resolution functions
- Timeout: 120s (configurable per test)

**Integration Tests:**
- Scope: Multiple modules working together, but not full system
- Location: Same co-location, within describe blocks marked "integration"
- Example: `src/agents/bash-tools.test.ts` tests exec + process tools together
- Setup: Create real temp files, multiple modules interact

**E2E Tests:**
- Scope: Full flows, realistic scenarios
- Location: `src/**/*.e2e.test.ts` or `test/**/*.e2e.test.ts`
- Config: `vitest.e2e.config.ts` (separate from unit tests)
- Parallel: Limited to 2 workers in CI, ~4 in local
- Run: `pnpm test:e2e`
- Example: Onboarding flows, full gateway startup

**Live Tests:**
- Scope: Real external API calls (requires actual credentials)
- Location: `src/**/*.live.test.ts`
- Config: `vitest.live.config.ts`
- Run: `OPENCLAW_LIVE_TEST=1 pnpm test:live` or `LIVE=1 pnpm test:live`
- Env: Requires real API keys (Anthropic, OpenAI, etc.)
- Skip in CI: Conditional skip if env vars not set

## Common Patterns

**Async Testing:**
```typescript
// Use async/await in test function
it("async operation completes", async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});

// Timeout management (vitest default 120s, adjustable per test)
it("slow operation", async () => {
  // Default timeout applies
  await slowFn();
}, { timeout: 300_000 }); // Custom timeout if needed
```

**Error Testing:**
```typescript
// Expect thrown errors
it("throws on invalid input", () => {
  expect(() => {
    validateInput(null);
  }).toThrow("invalid");
});

// Async error testing
it("rejects with specific error", async () => {
  await expect(asyncFn("bad")).rejects.toThrow("error message");
});

// Match error properties
expect(store.profiles["anthropic:default"]).toMatchObject({
  type: "api_key",
  provider: "anthropic",
});
```

**Polling/Waiting:**
```typescript
// Custom helper example from bash-tools.test.ts
async function waitForCompletion(sessionId: string) {
  let status = "running";
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && status === "running") {
    const poll = await processTool.execute("call-wait", {
      action: "poll",
      sessionId,
    });
    status = (poll.details as { status: string }).status;
    if (status === "running") {
      await sleep(20);
    }
  }
  return status;
}

// Usage in test
const status = await waitForCompletion(sessionId);
expect(status).not.toBe("running");
```

**Environment Variable Isolation:**
```typescript
describe("state dir resolution", () => {
  const previous = process.env.OPENCLAW_STATE_DIR;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previous;
    }
  });

  it("uses override", () => {
    process.env.OPENCLAW_STATE_DIR = "/tmp/test";
    const result = resolveStateDir();
    expect(result).toBe("/tmp/test");
  });
});
```

**File System Isolation:**
```typescript
// Create isolated temp directory
const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
try {
  const testFile = path.join(root, "data.json");
  fs.writeFileSync(testFile, JSON.stringify({ key: "value" }));

  // Test reads from testFile
  const data = loadData(testFile);
  expect(data.key).toBe("value");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
```

## Configuration Details

**Pool Strategy:** "forks" (process isolation for each test)
- Prevents state leakage between tests
- Slower but safer for file/env mutations

**Worker Count:**
- Local: Calculated as `Math.max(4, Math.min(16, cpus.length))`
- CI (Windows): 2 workers
- CI (Unix): 3 workers
- E2E: 2 in CI, ~4 locally

**Test Timeout:**
- Default: 120s (20s for hooks)
- Windows hooks: 180s (increased for slow I/O)

**Setup Files:**
- `test/setup.ts` runs before all tests
- Installs warning filters
- Creates test plugin registry
- Initializes isolated home directory

---

*Testing analysis: 2026-02-04*
