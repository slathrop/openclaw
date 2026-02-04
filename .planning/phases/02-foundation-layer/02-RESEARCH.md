# Phase 2: Foundation Layer - Research

**Researched:** 2026-02-04
**Domain:** TypeScript-to-JavaScript conversion of shared infrastructure, config, routing, and entry points
**Confidence:** HIGH

## Summary

Phase 2 converts approximately 350 TypeScript files (source + tests) across `src/infra/`, `src/utils/`, `src/shared/`, `src/types/`, `src/config/`, `src/routing/`, and three entry points (`src/index.ts`, `src/entry.ts`, `src/runtime.ts`) plus related root-level files (`src/utils.ts`, `src/globals.ts`, `src/version.ts`). This is a mechanical conversion -- the existing code uses no TypeScript enums, no complex generics patterns, and no decorators. The primary work is: (1) strip type annotations from function parameters/returns, (2) remove `import type` statements and `type` keyword from inline imports, (3) convert `export type` definitions to JSDoc `@typedef` annotations, (4) remove `as` type assertions, (5) add module-level and security-focused comments per QUAL-04/05/06, and (6) rename files from `.ts` to `.js`.

The key challenge is that these modules import from modules NOT being converted in this phase (agents, channels, logging, sessions, plugins, etc.). Those external `.ts` files will still exist, but import paths already use `.js` extensions (standard TypeScript ESM convention), so renaming `.ts` to `.js` in this phase will not break external references. However, the converted `.js` files still import from unconverted `.ts` modules via `.js` extension paths. Vitest and rolldown both handle `.ts` files natively (rolldown strips types), so this mixed state works during the transition.

**Primary recommendation:** Convert files mechanically by stripping TypeScript syntax, converting type exports to JSDoc, and adding quality comments. Process directories in dependency order: types first, then utils/shared, then infra, then config, then routing, then entry points. Tests convert alongside their source modules.

## Standard Stack

No new libraries are needed for this phase. The conversion uses only the tooling established in Phase 1.

### Core (already installed)
| Library | Version | Purpose | Role in Phase 2 |
|---------|---------|---------|-----------------|
| `rolldown` | 1.0.0-rc.2 | Bundler | Strips types from .ts files natively; handles mixed .ts/.js imports |
| `eslint` | ^9.39.2 | Linter/formatter | Validates converted .js files; `eslint --fix` applies formatting |
| `vitest` | ^4.0.18 | Test runner | Runs .test.ts files that import from .js source (and vice versa) |
| `eslint-plugin-jsdoc` | ^62.0.0 | JSDoc validation | Validates JSDoc annotations added during conversion |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `eslint --fix` | Auto-format converted files | Run on each converted file to ensure Google Style compliance |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual type stripping | ts-to-js tool / sed scripts | Manual conversion is more reliable for this codebase: no enums, no complex generics, simple type annotations. Automated tools may mangle JSDoc or miss edge cases |
| JSDoc @typedef for types | Separate types.d.ts files | JSDoc keeps documentation inline with code; .d.ts files are a TypeScript artifact. Use JSDoc for consistency with QUAL-06 |
| Convert all tests now | Defer tests to Phase 5 | Roadmap says "tests convert alongside source modules." Converting tests with their source ensures they keep passing |

## Architecture Patterns

### Conversion Order (Dependency-Driven)
The directories have a natural dependency order. Convert leaves first:

```
1. src/types/          (9 .d.ts files -- DELETE, these are TS-only ambient declarations)
2. src/shared/         (2 source + 1 test -- leaf module, no cross-deps)
3. src/utils/          (14 source + 4 tests in dir; plus src/utils.ts + src/utils.test.ts)
4. src/infra/          (117 source + 67 tests -- imports from utils, shared)
5. src/config/         (89 source + 44 tests -- imports from infra, utils)
6. src/routing/        (3 source + 1 test -- imports from config)
7. Entry points        (src/index.ts, src/entry.ts, src/runtime.ts, src/globals.ts, src/version.ts)
8. Vitest config       (update glob patterns from .ts to .js for converted directories)
```

### Pattern 1: Type Annotation Removal
**What:** Strip TypeScript type annotations from parameters, return types, and variable declarations
**When to use:** Every function signature, variable with explicit type
**Example:**
```javascript
// BEFORE (TypeScript):
function resolveDeviceAuthPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), 'identity', DEVICE_AUTH_FILE);
}

// AFTER (JavaScript with JSDoc):
/**
 * Resolves the filesystem path to the device auth store.
 * @param {object} [env=process.env] - Process environment object.
 * @returns {string} Absolute path to device-auth.json.
 */
function resolveDeviceAuthPath(env = process.env) {
  return path.join(resolveStateDir(env), 'identity', DEVICE_AUTH_FILE);
}
```

### Pattern 2: Type Export to JSDoc Typedef
**What:** Convert `export type Foo = { ... }` to JSDoc `@typedef`
**When to use:** Every exported type alias in source files
**Example:**
```javascript
// BEFORE (TypeScript):
export type DeviceAuthEntry = {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
};

// AFTER (JavaScript with JSDoc):
/**
 * A stored device authentication entry.
 * @typedef {object} DeviceAuthEntry
 * @property {string} token - Auth token.
 * @property {string} role - Role identifier.
 * @property {string[]} scopes - Granted scopes.
 * @property {number} updatedAtMs - Last update timestamp in ms.
 */
```

### Pattern 3: Import Type Removal
**What:** Remove `import type` statements entirely; strip `type` keyword from mixed imports
**When to use:** Every `import type` line and inline `type` in import destructuring
**Example:**
```javascript
// BEFORE (TypeScript):
import type { OpenClawConfig } from '../config/config.js';
import { resolveDefaultAgentId, type AgentEntry } from '../agents/agent-scope.js';

// AFTER (JavaScript):
// (import type line deleted entirely -- no runtime value)
import { resolveDefaultAgentId } from '../agents/agent-scope.js';
```

### Pattern 4: Type Assertion Removal
**What:** Remove `as Type` assertions and `as unknown as Type` casts
**When to use:** Every `as` expression
**Example:**
```javascript
// BEFORE (TypeScript):
const parsed = JSON.parse(raw) as DeviceAuthStore;
const code = (err as { code?: unknown }).code;

// AFTER (JavaScript):
const parsed = JSON.parse(raw);
const code = err?.code;
// OR (when the assertion was for property access):
const code = (err && typeof err === 'object') ? err.code : undefined;
```

### Pattern 5: Generic Type Parameter Removal
**What:** Remove `<T>` type parameters from function declarations
**When to use:** Generic functions like `retryAsync<T>`
**Example:**
```javascript
// BEFORE (TypeScript):
export async function retryAsync<T>(
  fn: () => Promise<T>,
  attemptsOrOptions: number | RetryOptions = 3,
  initialDelayMs = 300,
): Promise<T> {

// AFTER (JavaScript with JSDoc):
/**
 * Retry an async function with exponential backoff.
 * @param {() => Promise<*>} fn - Async function to retry.
 * @param {number|RetryOptions} [attemptsOrOptions=3] - Number of attempts or options.
 * @param {number} [initialDelayMs=300] - Initial delay in milliseconds.
 * @returns {Promise<*>} Result of the function.
 */
export async function retryAsync(fn, attemptsOrOptions = 3, initialDelayMs = 300) {
```

### Pattern 6: Security Comment Annotations (QUAL-05)
**What:** Add explicit comments on security-sensitive code
**When to use:** Auth tokens, credential handling, TLS, SSRF protection, file permissions
**Example:**
```javascript
// SECURITY: File permissions set to 0o600 (owner read/write only)
// to prevent other users on shared systems from reading auth tokens.
fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
```

### Pattern 7: Module-Level Comments (QUAL-04)
**What:** Add a top-of-file comment block explaining the module's purpose
**When to use:** Every converted module
**Example:**
```javascript
/**
 * Device authentication token store.
 *
 * Manages per-device auth tokens stored as JSON on disk. Tokens are
 * scoped by device ID and role, with file permissions restricting
 * access to the owning user.
 *
 * SECURITY: Token files use 0o600 permissions. The store validates
 * device identity before returning tokens to prevent cross-device leakage.
 */
```

### Anti-Patterns to Avoid
- **Leaving `as` assertions as-is:** JavaScript has no `as` keyword in this context. Every assertion must be converted to runtime checks or simply removed.
- **Converting `import type` to `import`:** Type-only imports must be deleted, not converted to value imports. The imported types have no runtime representation.
- **Creating .d.ts files to replace types:** The goal is JavaScript with JSDoc, not JavaScript with TypeScript declarations.
- **Changing import paths from .js to .ts:** The codebase already uses `.js` extensions in imports (standard TS ESM convention). Keep them as-is.
- **Converting test files without converting their source:** Tests and source must convert together to avoid import mismatches.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type stripping | Regex-based type remover | Manual per-file conversion | TypeScript syntax has edge cases (generics in arrow functions, conditional types) that regexes miss |
| JSDoc generation | Auto-generate JSDoc from TS types | Write JSDoc manually during conversion | Auto-generated JSDoc is often verbose/wrong; manual JSDoc includes meaningful descriptions per QUAL-06 |
| Import path updates | Script to rewrite .ts to .js in imports | Leave import paths unchanged | Imports already use .js extensions. No change needed. |
| Type-only file conversion | Generate .d.ts from types | Delete src/types/*.d.ts entirely | These are TypeScript ambient declarations for untyped npm packages. JavaScript doesn't need them. |

**Key insight:** The conversion is mechanical enough to be done file-by-file but complex enough that automated tools would create more problems than they solve. The codebase has no enums, no decorators, no complex generics beyond `<T>` in a few places -- just type annotations, type exports, and type imports that need removal.

## Common Pitfalls

### Pitfall 1: Mixed .ts/.js State Breaks Imports
**What goes wrong:** Converting a module to .js while its dependents still import it via `.js` extension from `.ts` files
**Why it happens:** TypeScript ESM convention uses `.js` extensions in imports even when source is `.ts`. After renaming to `.js`, the file actually IS `.js` now -- this is seamless.
**How to avoid:** This is actually not a problem. Import paths already point to `.js` extensions. Renaming `.ts` to `.js` makes the import paths truthful. Vitest and rolldown handle both.
**Warning signs:** None expected. This is a non-issue but worth documenting to prevent unnecessary worry.

### Pitfall 2: Cross-Module Imports to Unconverted Code
**What goes wrong:** Converted `.js` files import from `../agents/agent-scope.js` etc., where the source is still `.ts`
**Why it happens:** `src/infra/`, `src/config/`, and `src/routing/` import from modules in `src/agents/`, `src/channels/`, `src/logging/`, `src/sessions/`, `src/plugins/`, etc. that convert in later phases.
**How to avoid:** Vitest and rolldown both resolve `.js` imports to `.ts` files when the `.js` file doesn't exist. The mixed state is explicitly supported. The import paths stay as `.js` throughout.
**Warning signs:** Import resolution errors at test time. If seen, check that the target file exists as either `.ts` or `.js`.

### Pitfall 3: `import type` Becoming Dead Code
**What goes wrong:** Removing `import type { Foo }` but leaving references to `Foo` in JSDoc `@type {Foo}` annotations
**Why it happens:** JSDoc type references don't need imports, but it's confusing if the type name isn't defined anywhere in the file
**How to avoid:** When converting `export type Foo = {...}` to `@typedef`, keep the typedef in the same file or use JSDoc import syntax: `@type {import('./types.js').Foo}`. For types imported from other modules, either use `@type {import(...)}` or simply use `{object}` / `{*}` for complex types where full typing isn't worth the JSDoc verbosity.
**Warning signs:** ESLint or JSDoc validation errors about unknown types

### Pitfall 4: NodeJS.ProcessEnv and NodeJS.Timeout References
**What goes wrong:** JSDoc `@type {NodeJS.ProcessEnv}` doesn't resolve without TypeScript
**Why it happens:** `NodeJS.ProcessEnv` and `NodeJS.Timeout` are TypeScript global types. They appear in ~40+ function signatures.
**How to avoid:** Replace with `{object}` (for ProcessEnv, since it's just a string-keyed object) or `{*}` for Timeout (it's `setTimeout`'s return type). In JSDoc: `@param {object} env - Process environment variables.` is sufficient and honest.
**Warning signs:** JSDoc validation errors about unknown types

### Pitfall 5: Type-Only Export Files Becoming Empty
**What goes wrong:** Files like `src/config/types.auth.ts` that contain ONLY `export type` declarations become empty after conversion
**Why it happens:** ~30 files in `src/config/types.*.ts` are type-only. After stripping types, they'd contain only JSDoc typedefs with no runtime exports.
**How to avoid:** Convert these to JSDoc typedef files. They still serve as documentation even without runtime exports. The barrel `src/config/types.ts` re-exports from all of them -- in JavaScript, this becomes `export * from './types.auth.js'` which is valid even if the target exports nothing at runtime (it exports JSDoc documentation). Alternatively, consolidate typedef-only files into a single `types.js` if the barrel pattern becomes unwieldy.
**Warning signs:** ESLint no-empty-file warnings; barrel exports that resolve to empty modules

### Pitfall 6: `as` Assertions Used for Property Access
**What goes wrong:** Simply removing `as Type` leaves invalid JavaScript when the assertion was used to access properties
**Why it happens:** TypeScript uses `(err as { code?: unknown }).code` to safely access `.code` on `unknown` types
**How to avoid:** Convert to optional chaining (`err?.code`) or explicit runtime checks (`typeof err === 'object' && err !== null ? err.code : undefined`). Each instance needs case-by-case handling.
**Warning signs:** Runtime errors accessing properties on undefined/null after removing assertions

### Pitfall 7: `declare const` in version.ts
**What goes wrong:** `declare const __OPENCLAW_VERSION__: string | undefined;` is TypeScript-only syntax
**Why it happens:** This is a build-time constant injected by rolldown's `define` option
**How to avoid:** Remove the `declare const` line. In JavaScript, the variable is replaced by rolldown at build time. At dev/test time, the fallback chain (`process.env.OPENCLAW_BUNDLED_VERSION || readVersionFromPackageJson()`) handles it. Add a JSDoc comment explaining the build-time injection.
**Warning signs:** ReferenceError for `__OPENCLAW_VERSION__` -- but won't happen because the code already has `typeof __OPENCLAW_VERSION__ === "string"` guard

### Pitfall 8: src/types/ Directory (.d.ts Files)
**What goes wrong:** Trying to convert `.d.ts` files to `.js` files
**Why it happens:** The success criteria says "all files in src/types/ are JavaScript (.js) with no remaining .ts files"
**How to avoid:** These 9 `.d.ts` files are TypeScript ambient module declarations for untyped npm packages (node-llama-cpp, proper-lockfile, osc-progress, etc.). They have no runtime purpose. DELETE them entirely. JavaScript doesn't need ambient declarations -- the packages work at runtime without them. The success criteria should be interpreted as "no remaining TypeScript artifacts."
**Warning signs:** Trying to create `.js` files from `.d.ts` files that have no runtime code

### Pitfall 9: Zod Schema Files Have No Type Annotations to Strip
**What goes wrong:** Spending time on Zod schema files expecting significant TypeScript removal
**Why it happens:** Zod schemas are runtime code that generates types. Files like `zod-schema.ts`, `zod-schema.agents.ts`, etc. are almost pure JavaScript already.
**How to avoid:** Scan Zod files first. They likely need only: (1) rename to .js, (2) remove any `import type` lines, (3) add module-level comments. The `z.object()`, `z.string()`, etc. calls are already JavaScript.
**Warning signs:** None -- this is a productivity tip, not a bug risk

## Code Examples

### Complete Module Conversion Example

Before (`src/infra/errors.ts`):
```typescript
export function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    return code;
  }
  if (typeof code === "number") {
    return String(code);
  }
  return undefined;
}

export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || "Error";
  }
  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    return String(err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return Object.prototype.toString.call(err);
  }
}
```

After (`src/infra/errors.js`):
```javascript
/**
 * Error formatting and code extraction utilities.
 *
 * Provides safe error-to-string conversion for logging and user-facing
 * messages, handling all JavaScript value types (Error, string, number,
 * objects) without throwing.
 */

/**
 * Extracts a string error code from an error-like object.
 * @param {*} err - The caught error value.
 * @returns {string|undefined} The error code, or undefined if none found.
 */
export function extractErrorCode(err) {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const code = err.code;
  if (typeof code === 'string') {
    return code;
  }
  if (typeof code === 'number') {
    return String(code);
  }
  return undefined;
}

/**
 * Formats any thrown value into a human-readable string.
 * @param {*} err - The caught error value.
 * @returns {string} A formatted error message.
 */
export function formatErrorMessage(err) {
  if (err instanceof Error) {
    return err.message || err.name || 'Error';
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return Object.prototype.toString.call(err);
  }
}
```

### Security-Sensitive Conversion Example (SSRF)

```javascript
/**
 * SSRF (Server-Side Request Forgery) protection.
 *
 * Prevents outbound HTTP requests to private/internal networks by
 * validating hostnames and resolved IP addresses before allowing
 * connections. Uses DNS pinning to prevent TOCTOU attacks where
 * a hostname resolves to a public IP during validation but a
 * private IP during the actual connection.
 *
 * SECURITY: This module is critical for preventing SSRF attacks.
 * All outbound fetch requests from user-controlled URLs must go
 * through resolvePinnedHostnameWithPolicy() or the fetch-guard.
 */
```

### Type-Only File Conversion Example

Before (`src/config/types.auth.ts`):
```typescript
export type AuthProfileConfig = {
  provider: string;
  mode: "api_key" | "oauth" | "token";
  email?: string;
};

export type AuthConfig = {
  profiles?: Record<string, AuthProfileConfig>;
  order?: Record<string, string[]>;
  cooldowns?: {
    billingBackoffHours?: number;
    billingBackoffHoursByProvider?: Record<string, number>;
    billingMaxHours?: number;
    failureWindowHours?: number;
  };
};
```

After (`src/config/types.auth.js`):
```javascript
/**
 * Authentication configuration types.
 *
 * Defines the shape of auth profile and auth configuration objects
 * used throughout the config system. Profiles support three credential
 * modes: static API keys, refreshable OAuth, and bearer tokens.
 *
 * SECURITY: Auth profiles contain provider credentials. Config files
 * storing these values should have restricted file permissions.
 */

/**
 * Configuration for a single auth profile.
 * @typedef {object} AuthProfileConfig
 * @property {string} provider - Provider identifier (e.g. 'openai', 'anthropic').
 * @property {'api_key'|'oauth'|'token'} mode - Credential type.
 * @property {string} [email] - Associated email address.
 */

/**
 * Top-level authentication configuration.
 * @typedef {object} AuthConfig
 * @property {Object<string, AuthProfileConfig>} [profiles] - Named auth profiles.
 * @property {Object<string, string[]>} [order] - Provider priority ordering.
 * @property {object} [cooldowns] - Billing and failure backoff settings.
 * @property {number} [cooldowns.billingBackoffHours] - Default billing backoff in hours.
 * @property {Object<string, number>} [cooldowns.billingBackoffHoursByProvider] - Per-provider backoff.
 * @property {number} [cooldowns.billingMaxHours] - Maximum backoff cap in hours.
 * @property {number} [cooldowns.failureWindowHours] - Failure counter reset window in hours.
 */
```

### Test File Conversion Example

Before (`src/infra/retry.test.ts`):
```typescript
import { describe, expect, it, vi } from "vitest";
import { retryAsync } from "./retry.js";

describe("retryAsync", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryAsync(fn, 3, 10);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
```

After (`src/infra/retry.test.js`):
```javascript
import { describe, expect, it, vi } from 'vitest';
import { retryAsync } from './retry.js';

describe('retryAsync', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryAsync(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });
```
Note: Test files have minimal TypeScript -- mostly just quote style changes and removing the occasional type annotation in test helpers.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeScript `type` exports | JSDoc `@typedef` annotations | Always available | JSDoc provides runtime-readable documentation; works with VS Code IntelliSense |
| TypeScript `as` assertions | Optional chaining / runtime checks | Always available | Safer -- runtime checks catch actual bugs that `as` masks |
| `.d.ts` ambient declarations | No declarations (packages work at runtime) | N/A | JavaScript doesn't need ambient type declarations |
| `import type` for types | Delete entirely (or JSDoc `@type {import(...)}`) | N/A | Type-only imports have no runtime effect |

## File Count Summary

Files to convert (source, non-test, non-.d.ts):

| Directory | Source Files | Test Files | Total | Notes |
|-----------|-------------|------------|-------|-------|
| `src/infra/` | 117 | 67 | 184 | Largest directory; includes net/ outbound/ tls/ subdirs |
| `src/config/` | 89 | 44 | 133 | Includes sessions/ subdir; ~30 type-only files |
| `src/utils/` (dir) | 10 | 4 | 14 | Small utility modules |
| `src/routing/` | 3 | 1 | 4 | Small; depends on config, agents, sessions |
| `src/shared/` | 1 | 1 | 2 | reasoning-tags only |
| `src/types/` | 9 (.d.ts) | 0 | 9 | DELETE these; not convert |
| Root-level | 6 | 2 | 8 | index, entry, runtime, globals, version, utils + tests |
| **Total** | **~235** | **~119** | **~354** | |

Estimated total lines: ~54,000 (infra: 31.7k, config: 19.4k, remainder: ~3.2k)

## Open Questions

1. **Type-only barrel exports in src/config/types.ts**
   - What we know: `src/config/types.ts` re-exports from ~30 `types.*.ts` files that are type-only. After conversion, these become JSDoc-typedef-only files with no runtime exports.
   - What's unclear: Whether `export *` from a file with only JSDoc typedefs causes issues with rolldown or ESLint.
   - Recommendation: Test with one file first. If `export *` from a JSDoc-only file works cleanly, proceed. If not, consolidate typedefs into fewer files or keep the barrel for documentation purposes only.

2. **Vitest glob pattern transition timing**
   - What we know: Phase 1 kept `.ts` globs in vitest configs. Phase 2 converts foundation files to `.js`. Tests need to match both `.test.ts` (unconverted) and `.test.js` (converted) during the transition.
   - What's unclear: Whether vitest supports `**/*.test.{ts,js}` glob or needs separate entries.
   - Recommendation: Update vitest include patterns to `['src/**/*.test.ts', 'src/**/*.test.js', ...]` to match both. Final cleanup to .js-only happens in Phase 5.

3. **Whether to convert src/logging.ts and src/logging/ in this phase**
   - What we know: `src/globals.ts` imports from `src/logging/logger.js` and `src/logging.ts`. Several infra files import from `src/logging/subsystem.js`. These are not listed in the phase scope (infra, utils, shared, types, config, routing).
   - What's unclear: Whether `src/globals.ts` conversion requires `src/logging.ts` to also be converted.
   - Recommendation: Do NOT convert `src/logging.ts` or `src/logging/` in this phase. The converted `.js` files can import from `.ts` files via `.js` extension paths (vitest/rolldown resolve both). `src/globals.ts` converts fine on its own; its imports from logging remain as-is.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files in scope (src/infra, src/config, src/routing, src/utils, src/shared, src/types, entry points)
- Phase 1 research and completed build tooling (rolldown.config.js, eslint.config.js, vitest.config.js)
- TypeScript ESM import convention: `.js` extensions in imports are standard and already in use throughout the codebase

### Secondary (MEDIUM confidence)
- JSDoc @typedef syntax: well-documented standard, supported by VS Code and ESLint jsdoc plugin
- Vitest mixed .ts/.js resolution: confirmed by vitest's native TypeScript support documentation
- Rolldown .ts handling: confirmed in Phase 1 research (rolldown strips types natively)

### Tertiary (LOW confidence)
- `export *` from JSDoc-only files: untested behavior; needs validation during execution

## Metadata

**Confidence breakdown:**
- Conversion patterns: HIGH - Directly analyzed every TypeScript pattern in the source files
- Architecture/dependency order: HIGH - Traced all cross-module imports
- Pitfalls: HIGH - Identified from actual code patterns (as assertions, import type, NodeJS globals)
- File counts: HIGH - Enumerated directly from filesystem
- Mixed .ts/.js resolution: MEDIUM - Known to work from Phase 1 but not tested at this scale

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - conversion patterns are stable)
