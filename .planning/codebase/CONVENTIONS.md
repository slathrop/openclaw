# Coding Conventions

**Analysis Date:** 2026-02-04

## Naming Patterns

**Files:**
- Kebab-case for most files: `agent-paths.ts`, `bash-tools.ts`, `ssh-tunnel.ts`
- Test files: Match source with `.test.ts` suffix: `agent-paths.test.ts`
- E2E tests: `.e2e.test.ts` suffix: `query-interpreter-runtime.e2e.test.ts`
- Live/external tests: `.live.test.ts` suffix: `anthropic.setup-token.live.test.ts`
- Feature-specific test files: Descriptive names with scoped describe blocks: `auth-profiles.ensureauthprofilestore.test.ts`, `bash-tools.exec.approval-id.test.ts`
- Barrel/index files: `index.ts` for re-exports of module contents

**Functions:**
- camelCase for all functions: `resolveOpenClawAgentDir()`, `createCliProgress()`, `pickEphemeralPort()`
- Prefix conventions:
  - `resolve*` for path/config resolution
  - `create*` for factory functions
  - `with*` for higher-order functions or context managers
  - `ensure*` for idempotent initialization
  - `format*` for string formatting
  - `is*`/`can*` for boolean predicates
  - `list*` for array-returning functions
  - `parse*` for parsing/parsing operations
  - `normalize*` for data transformation

**Variables:**
- camelCase for variables and parameters
- Descriptive names: `tempStateDir`, `parsedTarget`, `activeProgress`
- Constants: UPPERCASE_WITH_UNDERSCORES: `DEFAULT_DELAY_MS`, `DEFAULT_AGENT_ID`
- Private module-level state: lowercase: `activeProgress`, `defaultAgentWarned`
- Type parameters: PascalCase: `T`, `U`

**Types:**
- PascalCase for all types: `ProgressOptions`, `SshTunnel`, `AgentEntry`
- Prefix `Channel*` for channel-related types: `ChannelId`, `ChannelPlugin`, `ChannelOutboundAdapter`
- Suffix `Adapter` for interface-like types: `ChannelOutboundAdapter`, `ChannelStatusAdapter`
- Suffix `Result`/`Response` for operation results: `LoginWithQrStartResult`
- Suffix `Context` for context/runtime parameter types: `ChannelOutboundContext`
- Suffix `Config`/`Options` for configuration objects
- Suffix `Map`/`Set` for collection types when name clarity needs it

## Code Style

**Formatting:**
- Tool: Oxfmt (0.28.0)
- Configuration: `.oxfmtrc.jsonc`
- Experimental sort imports enabled (no newlines between groups)
- Experimental sort package.json scripts enabled
- Run: `pnpm format:fix` to auto-fix

**Linting:**
- Tool: Oxlint (1.43.0) with Oxlint-TSGolint plugin
- Configuration: `.oxlintrc.json`
- Categories enforced as errors: `correctness`, `perf`, `suspicious`
- Key rules:
  - `typescript/no-explicit-any`: ERROR (avoid `any` types)
  - `curly`: ERROR (braces required)
  - Unicorn rules: consistent-function-scoping disabled, require-post-message-target-origin disabled
- Run: `pnpm lint --type-aware` for type-aware checking
- Run: `pnpm lint:fix` to auto-fix with formatting

**TypeScript:**
- Strict mode enabled
- Target: ES2023
- Module: NodeNext with ESM (type: "module" in package.json)
- No `any` types permitted
- Declare function return types explicitly (not just parameters)
- Use `typeof` for narrow type predicates instead of `instanceof` when possible

## Import Organization

**Order:**
1. Node.js built-in modules: `import fs from "node:fs"`
2. Third-party packages: `import { spinner } from "@clack/prompts"`
3. Internal imports: `import { theme } from "../terminal/theme.js"`

**Path Aliases:**
- `openclaw/plugin-sdk` resolves to `src/plugin-sdk/index.ts` (configured in vitest.config.ts and tsconfig.json)
- Always use relative paths from context (prefer `../` over absolute imports)

**Style:**
- Always include `.js` extension on relative imports: `./auth-profiles.js`
- Group related imports together
- One import per line for destructured imports; multi-line imports acceptable for readability
- Type imports use `import type`: `import type { OpenClawConfig } from "./config/config.js"`

## Error Handling

**Patterns:**
- Use `throw new Error()` for synchronous errors with descriptive messages
- Include context in error messages: `throw new Error("invalid pairing channel")`
- For errors with cause: `throw new Error(message, { cause: err })`
- Use type guards for narrowing error types: `function isErrno(err: unknown): err is NodeJS.ErrnoException`
- Catch blocks should check error type before accessing properties
- Return `null` for optional/failed lookups (don't throw): `export function parseSshTarget(raw: string): SshParsedTarget | null`
- Use Error subclasses only when semantic distinction is important; otherwise standard Error

**Common patterns:**
- Guard against leaked state in cleanup (e.g., `vi.useRealTimers()` in afterEach)
- Ensure idempotent operations succeed silently on retry: `process.env.OPENCLAW_AGENT_DIR = dir` (no error if already set)
- Validate early and fail fast with clear messages

## Logging

**Framework:** tslog (4.10.2) for application logging

**Patterns:**
- Use logger instance from `@mariozechner/pi-tui` or similar where available
- Console-based logging in tests (via helper imports)
- Log at appropriate levels: `info`, `warn`, `error`
- Include context in log messages (not just strings)

## Comments

**When to Comment:**
- Tricky or non-obvious logic (e.g., security checks, algorithm details)
- Explanations for disabled rules: `// @noformat` or eslint-disable comments with reason
- Cross-references to issues/PRs: PR #368 format
- Warnings about side effects or stateful behavior

**JSDoc/TSDoc:**
- Used sparingly; only for public API functions with complex signatures
- Format: Block comments above function/type
- Include `@param`, `@returns` for complex signatures
- Reference example: `src/config/paths.ts` has JSDoc for `resolveIsNixMode()` explaining Nix mode behavior
- Keep JSDoc concise; code should be self-documenting

**Code Comments Pattern:**
```typescript
// Guard against leaked fake timers across test files/workers.
vi.useRealTimers();
```

## Function Design

**Size:** Aim for under ~500 LOC per file (guideline, not hard limit); extract helpers when complexity or testability improves

**Parameters:**
- Prefer explicit parameters over destructuring for 1-2 args
- Use destructured options object for 3+ parameters: `ProgressOptions` type example
- Default parameters allowed: `function withLock<T>(fn: () => Promise<T>): Promise<T>`
- Pass environment/dependencies explicitly: `resolveStateDir(env: NodeJS.ProcessEnv = process.env, ...)`

**Return Values:**
- Explicit return types required on all exported functions
- Use `Promise<T>` for async functions
- Return `null`/`undefined` for optional results (not throwing)
- Return plain objects (not classes) for simple data: `{ user: string; host: string; port: number }`
- Factory functions return initialized objects with all properties set

**Higher-order functions:**
- Prefix with `with*`: `withProgress()`, `withProgressTotals()`, `withLock()`
- Accept async callback: `async (progress: ProgressReporter) => Promise<T>`
- Always handle cleanup in finally block or decorator pattern

## Module Design

**Exports:**
- Barrel re-exports common: `src/agents/auth-profiles.ts` re-exports submodule functions
- Separate public API from internal helpers using exports
- Export types with `export type` for tree-shaking

**Barrel Files:**
- Used for grouping related functions and types
- Pattern: `src/agents/auth-profiles/` submodules re-exported in `src/agents/auth-profiles.ts`
- Export both functions and types from barrel

**File Organization:**
- Related functionality grouped by feature directory
- Utilities in shared `src/utils.ts` for cross-cutting helpers
- Configuration types in `src/config/` directory
- Channel implementations in `src/*` (one per channel: `src/discord/`, `src/slack/`, etc.)

## Async/Await

**Patterns:**
- Prefer `async`/`await` over `.then()` chains
- Wrap async operations in try/finally for cleanup
- Use `Promise.all()` for parallel operations when possible
- Common pattern: `await withProgress(options, async (progress) => { ... })`
- Private async functions: prefix with `async function` in module scope

---

*Convention analysis: 2026-02-04*
