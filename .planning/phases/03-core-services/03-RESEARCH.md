# Phase 3: Core Services - Research

**Researched:** 2026-02-04
**Domain:** TypeScript-to-JavaScript conversion of gateway, agents, providers, and support modules
**Confidence:** HIGH

## Summary

Phase 3 converts approximately 758 TypeScript files (443 source + 316 tests) totaling ~137,700 lines across eight directories: `src/gateway/`, `src/agents/`, `src/providers/`, `src/logging/`, `src/memory/`, `src/sessions/`, `src/terminal/`, and `src/plugins/`. This is the largest conversion phase, roughly 2.5x the size of Phase 2 (354 files / ~54K lines). The conversion follows established patterns from Phase 2 -- no new tooling or libraries are needed.

The codebase has no TypeScript enums, no abstract classes, and no decorators in Phase 3 scope. The primary TypeScript patterns are: type annotations (~137K lines of source contain them throughout), `as` assertions (896 total across all dirs), `import type` statements (754 total), `export type` declarations (548 total), `satisfies` assertions (103 total), `interface` declarations (13 total), `implements` clauses (3, all in memory/), generic functions (38 total), and classes with TS `private` keywords (183 occurrences, heavily concentrated in memory/ at 156). These are all patterns with established conversion recipes from Phase 2.

The biggest complexity factor is scale: `src/agents/` alone has 450 files / ~78K lines, and `src/gateway/` has 191 files / ~39K lines. The esbuild `transformSync` bulk conversion approach established in 02-06 is essential for directories of this size, but esbuild is NOT currently installed in the project. It must be temporarily added as a devDependency.

**Primary recommendation:** Use esbuild `transformSync` for bulk type stripping (install as devDependency), followed by eslint --fix and manual post-processing for SECURITY comments, JSDoc, QUAL-01/02 improvements. Convert support modules (logging, sessions, terminal) first since they have fewer cross-dependencies, then gateway and agents in parallel.

## Standard Stack

No new libraries are needed. The conversion uses only the tooling established in Phases 1 and 2.

### Core (already installed)
| Library | Version | Purpose | Role in Phase 3 |
|---------|---------|---------|-----------------|
| `eslint` | ^9.39.2 | Linter/formatter | Validates and auto-formats converted .js files |
| `vitest` | ^4.0.18 | Test runner | Runs converted tests; handles mixed .ts/.js imports |
| `rolldown` | 1.0.0-rc.2 | Bundler | Resolves .js imports to .ts when needed during transition |

### Required Addition
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `esbuild` | ^0.25.x | TS type stripping | Bulk conversion of 10+ file directories via `transformSync` |

**Installation (temporary devDependency):**
```bash
pnpm add -D esbuild
```

Note: esbuild was used in Phase 2 (02-06) for bulk conversion but is not currently installed. It must be re-added. It can be removed after Phase 5 when all conversions are complete.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild for bulk stripping | Manual conversion | Manual is only viable for small directories (<10 files). Phase 2 proved regex-based approaches fail on complex TS patterns. esbuild's AST-based approach is reliable. |
| esbuild for bulk stripping | Node 22 `--experimental-strip-types` | Node's strip-types is a runtime flag, not a file transformation API. Cannot use for converting files. |

## Architecture Patterns

### Conversion Order (Dependency-Driven Waves)

The 8 directories have a natural dependency order. Support modules should convert first because they are leaf-like (few cross-Phase-3 imports) and are imported by gateway/agents.

```
Wave 1 (Support -- low cross-deps):
  1. src/logging/      (9 source + 5 tests = 14 files, 1.9K lines)
     + src/logging.ts  (barrel file, 67 lines -- convert alongside)
  2. src/sessions/     (6 source + 1 test = 7 files, 388 lines)
  3. src/terminal/     (10 source + 2 tests = 12 files, 917 lines)

Wave 2 (Support -- moderate cross-deps):
  4. src/memory/       (26 source + 13 tests = 39 files, 8.9K lines)
  5. src/plugins/      (29 source + 8 tests = 37 files, 7.3K lines)
  6. src/providers/    (4 source + 4 tests = 8 files, 1.2K lines)

Wave 3 (Core -- heavy cross-deps):
  7. src/gateway/      (128 source + 63 tests = 191 files, 39K lines)
  8. src/agents/       (231 source + 220 tests = 451 files, 78K lines)
```

Gateway and agents (Wave 3) CAN be converted in parallel -- they have minimal direct cross-imports. Each references the other but via `.js` extension imports that resolve correctly in the mixed .ts/.js state.

### Plan-to-Wave Mapping (Roadmap Alignment)

The roadmap defines 3 plans. Based on the codebase inventory:

- **03-01: Gateway server and protocol** (191 files, ~39K lines)
  - Protocol schema files (16 TypeBox + 1 Zod) are near-pure JS already
  - Gateway server has 128 source files -- needs esbuild bulk conversion
  - Many security-sensitive files (auth, WebSocket, origin-check)
  - 21 e2e tests + 2 live tests + ~40 unit tests

- **03-02: Agent runtime, model selection, AI providers** (459 files, ~79K lines)
  - BY FAR the largest plan -- almost 60% of Phase 3
  - `src/agents/` has deep subdirectories: `pi-embedded-runner/`, `tools/`, `skills/`, `auth-profiles/`, `sandbox/`, `pi-embedded-helpers/`, `pi-extensions/`, `schema/`
  - Heavy `satisfies` usage (99 occurrences) -- all removed without replacement
  - 13 interface declarations -- convert to JSDoc @typedef
  - 78 type-only `@mariozechner` imports -- delete entirely
  - `src/providers/` is tiny (4 source files, 1.2K lines) -- trivial

- **03-03: Logging, memory, sessions, terminal, plugins** (109 files, ~19K lines)
  - Smallest plan; logging/sessions/terminal are very small
  - Memory has 3 classes with `implements MemorySearchManager` -- convert `interface` to JSDoc, remove `implements` from class declarations
  - Plugins has many cross-module imports to Phase 4+ dirs (channels, CLI, commands) -- all via `.js` extension, will resolve to .ts during transition

### Pattern 1: esbuild Bulk Conversion (Established in 02-06)
**What:** Use esbuild `transformSync` to strip all TypeScript annotations from a directory, then post-process
**When to use:** Any directory with 10+ files
**Example:**
```javascript
import { transformSync } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const tsFile = 'src/gateway/auth.ts';
const source = fs.readFileSync(tsFile, 'utf-8');
const result = transformSync(source, {
  loader: 'ts',
  format: 'esm',
  target: 'node22'
});
const jsFile = tsFile.replace(/\.ts$/, '.js');
fs.writeFileSync(jsFile, result.code);
fs.unlinkSync(tsFile);
```

**Post-processing required after esbuild:**
1. `eslint --fix` on each file (applies formatting rules)
2. Fix `== null` / `!= null` -> `=== null || === undefined` (esbuild emits loose equality)
3. Remove unused imports (esbuild strips type-only imports but may leave value imports that were only used for types)
4. Add module-level JSDoc comments (esbuild strips ALL comments)
5. Add SECURITY: annotations on security-sensitive files
6. Apply QUAL-01 (early returns) and QUAL-02 (arrow functions) improvements

### Pattern 2: Class with `implements` Removal (memory/)
**What:** Remove TypeScript `implements Interface` from class declarations
**When to use:** 3 classes in src/memory/ that implement `MemorySearchManager`
**Example:**
```javascript
// BEFORE (TypeScript):
export class MemoryIndexManager implements MemorySearchManager {

// AFTER (JavaScript):
/**
 * @implements {MemorySearchManager}
 */
export class MemoryIndexManager {
```

### Pattern 3: `private` Keyword to Underscore Prefix
**What:** Convert TypeScript `private` class fields to underscore-prefixed fields
**When to use:** 183 occurrences, concentrated in memory/ (156) and gateway/ (25)
**Example:**
```javascript
// BEFORE (TypeScript):
export class MemoryIndexManager {
  private db;
  private config;
  private syncTimer;

// AFTER (JavaScript):
export class MemoryIndexManager {
  _db;
  _config;
  _syncTimer;
```
Note: esbuild strips `private` keyword automatically. The underscore prefix convention was established in 02-08 (IncludeProcessor class). References within the class must also be updated.

### Pattern 4: Interface to JSDoc @typedef
**What:** Convert TypeScript `interface` declarations to JSDoc
**When to use:** 13 interface declarations across gateway, agents, memory
**Example:**
```javascript
// BEFORE (TypeScript):
export interface ProcessSession {
  pid: number;
  command: string;
  cwd: string;
  startedAt: number;
}

// AFTER (JavaScript):
/**
 * @typedef {object} ProcessSession
 * @property {number} pid - Process ID.
 * @property {string} command - Shell command.
 * @property {string} cwd - Working directory.
 * @property {number} startedAt - Start timestamp.
 */
```

### Pattern 5: TypeBox/Zod Schema Files (Near-Pure JS)
**What:** Protocol schema files using TypeBox or Zod are already runtime JavaScript
**When to use:** 16 TypeBox files in `src/gateway/protocol/schema/`, 1 Zod file
**Example:**
```javascript
// These files need only:
// 1. Rename .ts to .js
// 2. Remove any import type lines
// 3. Remove the types.ts file's Static<> type references
// 4. Add module-level comment
// The z.object(), Type.Object() calls are already pure JavaScript.
```

### Pattern 6: `satisfies` Removal (Established in 02-04)
**What:** Remove `satisfies Type` assertions without replacement
**When to use:** 103 occurrences (99 in agents, 4 in gateway)
**Example:**
```javascript
// BEFORE:
const defaults = { model: 'gpt-4' } satisfies AgentDefaults;
// AFTER:
const defaults = { model: 'gpt-4' };
```
Note: esbuild handles this automatically.

### Anti-Patterns to Avoid
- **Converting all 450+ agents files manually:** Use esbuild bulk conversion. Manual conversion at this scale would take days and introduce errors.
- **Skipping `== null` fixup after esbuild:** esbuild output contains loose equality that fails the eqeqeq lint rule. Always post-process.
- **Forgetting to restore comments:** esbuild strips ALL comments. Module-level, security, and inline explanatory comments must be manually re-added.
- **Converting test helpers as tests:** Files like `test-helpers.ts`, `test-helpers.mocks.ts`, `test-helpers.server.ts` in gateway/ are shared test utilities, not test files. They need conversion alongside source files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk type stripping | Regex-based converter script | esbuild `transformSync` | Proven in Phase 2 (02-06). Regex fails on inline object types, generics, multi-line annotations. esbuild parses the AST correctly. |
| `private` to underscore | Manual find-replace | esbuild strips `private` automatically; add `_` prefix in post-processing pass | Consistent with Phase 2 pattern (02-08) |
| `import type` removal | Manual deletion | esbuild removes type-only imports automatically | No manual work needed for this pattern |
| `satisfies` removal | Manual deletion | esbuild removes `satisfies` automatically | No manual work needed |
| Formatting after conversion | Manual formatting | `eslint --fix` | Applies all Google Style rules in one pass |

**Key insight:** The esbuild + eslint --fix pipeline handles ~80% of mechanical conversion work. The remaining 20% is manual: restoring comments, SECURITY annotations, QUAL-01/02 improvements, and fixing edge cases (loose null checks, unused imports).

## Common Pitfalls

### Pitfall 1: esbuild Not Installed
**What goes wrong:** Phase 2 used esbuild but it is NOT currently in the project's dependencies. Attempting to import it fails.
**Why it happens:** esbuild was likely installed ad-hoc during Phase 2 execution and not persisted, or was removed during dependency cleanup.
**How to avoid:** First task in Phase 3 must install esbuild: `pnpm add -D esbuild`
**Warning signs:** `Cannot find module 'esbuild'` errors

### Pitfall 2: Gateway and Agents are Massive
**What goes wrong:** A single plan tries to convert all 450 agents files in one task, causing timeouts or incomplete conversions.
**Why it happens:** `src/agents/` alone is 78K lines -- larger than ALL of Phase 2 combined (54K lines).
**How to avoid:** Break large directories into sub-waves by subdirectory:
  - agents/tools/ (54 source files)
  - agents/pi-embedded-runner/ (~28 source files)
  - agents/pi-embedded-helpers/ (9 source files)
  - agents/skills/ (13 source files)
  - agents/auth-profiles/ (14 source files)
  - agents/sandbox/ (16 source files)
  - agents/ root-level (~97 source files)
  - agents tests (~220 test files -- bulk-convert last)
**Warning signs:** Task execution exceeding 30 minutes without commits

### Pitfall 3: Cross-Module Imports to Phase 4+ Directories
**What goes wrong:** Converted .js files import from unconverted Phase 4+ modules (channels, CLI, commands, auto-reply, browser, cron, hooks, media, wizard, etc.) that are still .ts.
**Why it happens:** Gateway and agents (especially plugins/) have extensive imports from directories not in Phase 3 scope. Over 140 unique import paths reference Phase 4+ modules.
**How to avoid:** This is NOT a problem. Import paths use `.js` extensions, and vitest/rolldown resolve `.js` imports to `.ts` files when the `.js` file doesn't exist. The mixed state works during transition. Do NOT change any import paths.
**Warning signs:** Module resolution errors at test time -- check that target file exists as either .ts or .js.

### Pitfall 4: esbuild Strips ALL Comments
**What goes wrong:** After esbuild bulk conversion, all source files lose their comments -- including existing documentation, TODO markers, and eslint-disable directives.
**Why it happens:** esbuild's `transformSync` removes all comments by default.
**How to avoid:** Two strategies:
  1. For small directories (logging, sessions, terminal): convert manually instead of using esbuild, preserving existing comments.
  2. For large directories (gateway, agents): use esbuild for bulk stripping, then re-add module-level comments, SECURITY annotations, and critical inline comments. Accept that minor inline comments may be lost.
**Warning signs:** eslint-disable comments gone, causing new lint errors in converted files.

### Pitfall 5: `private` Keyword Concentration in memory/
**What goes wrong:** MemoryIndexManager has 156 `private` field references. Simply stripping `private` keyword makes fields public without naming convention.
**Why it happens:** The memory classes are heavily encapsulated with private state.
**How to avoid:** Follow the 02-08 pattern: prefix all private fields with `_` and update all references within the class. esbuild strips the keyword; post-processing adds the prefix.
**Warning signs:** Tests accessing what were private fields -- check that no test bypasses the underscore-prefix convention.

### Pitfall 6: `implements` Keyword in memory/ Classes
**What goes wrong:** JavaScript classes cannot use `implements` -- it's TypeScript-only syntax.
**Why it happens:** 3 memory classes implement `MemorySearchManager` interface.
**How to avoid:** esbuild removes `implements` automatically. Add JSDoc `@implements {MemorySearchManager}` annotation for documentation. Convert the `interface MemorySearchManager` declaration in `src/memory/types.ts` to a JSDoc @typedef.
**Warning signs:** Syntax error on `class Foo implements Bar` in .js file

### Pitfall 7: Root-Level src/logging.ts Must Convert with src/logging/
**What goes wrong:** Converting `src/logging/` directory but leaving `src/logging.ts` (barrel) unconverted creates an inconsistent state.
**Why it happens:** `src/logging.ts` is a barrel that re-exports from `src/logging/*.js`. Many Phase 3 modules import from `src/logging.js` (the barrel). If the barrel remains .ts while its dependencies are .js, imports work but the barrel itself isn't converted.
**How to avoid:** Convert `src/logging.ts` to `src/logging.js` in the same task as `src/logging/` directory. The barrel is only 67 lines (just re-exports + `export type` statements).
**Warning signs:** `src/logging.ts` still exists after logging directory conversion.

### Pitfall 8: Gateway Protocol types.ts is Type-Only
**What goes wrong:** `src/gateway/protocol/schema/types.ts` (226 lines) is entirely `import type` + `export type` + `Static<>` type utilities. After conversion it becomes a JSDoc-only file with no runtime exports.
**Why it happens:** The file derives types from TypeBox schemas using `Static<typeof Schema>`. In JavaScript, these types don't exist at runtime.
**How to avoid:** Convert to a JSDoc typedef file (as done with config types in Phase 2). The `export type Foo = Static<typeof FooSchema>` lines become `/** @typedef {import('./foo.js').Static<typeof FooSchema>} Foo */` or simply reference the schema directly since JS consumers don't need the extracted type.
**Warning signs:** Empty file after stripping all types.

### Pitfall 9: Test Files with Long Descriptive Names
**What goes wrong:** agents/ has ~50 test files with extremely long names (e.g., `pi-embedded-subscribe.subscribe-embedded-pi-session.does-not-call-onblockreplyflush-callback-is-not.test.ts`). Bulk rename operations may hit filesystem path limits or be unwieldy.
**Why it happens:** The test naming convention embeds the full describe/it path in the filename.
**How to avoid:** Use a programmatic rename script rather than manual file-by-file operations. The long names are not a conversion problem, just an operational annoyance.
**Warning signs:** None -- just be aware during planning.

## Code Examples

### esbuild Bulk Conversion Script (for large directories)
```javascript
// convert-dir.mjs -- reusable bulk conversion script
import { transformSync } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';

const convertDir = (dir) => {
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (extname(entry.name) !== '.ts') continue;
      if (entry.name.endsWith('.d.ts')) continue;

      const source = readFileSync(full, 'utf-8');
      const result = transformSync(source, {
        loader: 'ts',
        format: 'esm',
        target: 'node22'
      });
      const jsPath = full.replace(/\.ts$/, '.js');
      writeFileSync(jsPath, result.code);
      unlinkSync(full);
    }
  };
  walk(dir);
};

convertDir(process.argv[2]);
```

Usage: `node convert-dir.mjs src/logging/`

### Post-esbuild Fixup: Loose Null Checks
```javascript
// Fix esbuild's == null / != null output for eqeqeq compliance
// BEFORE (esbuild output):
if (value == null) { return; }
if (result != null) { process(result); }

// AFTER (eslint eqeqeq compliant):
if (value === null || value === undefined) { return; }
if (result !== null && result !== undefined) { process(result); }
```

### QUAL-01: Early Returns (Applied During Conversion)
```javascript
// BEFORE (nested conditional):
const processMessage = (msg) => {
  if (msg) {
    if (msg.type === 'text') {
      if (msg.content.length > 0) {
        return handleText(msg.content);
      }
    }
  }
  return null;
};

// AFTER (early returns):
const processMessage = (msg) => {
  if (!msg) return null;
  if (msg.type !== 'text') return null;
  if (msg.content.length === 0) return null;
  return handleText(msg.content);
};
```

### QUAL-02: Arrow Functions and Functional Patterns
```javascript
// BEFORE (imperative loop):
function getActiveChannels(channels) {
  const result = [];
  for (let i = 0; i < channels.length; i++) {
    if (channels[i].active) {
      result.push(channels[i].name);
    }
  }
  return result;
}

// AFTER (functional):
const getActiveChannels = (channels) =>
  channels.filter(ch => ch.active).map(ch => ch.name);
```

### Security Comment Example (Gateway Auth)
```javascript
/**
 * Gateway authentication and session validation.
 *
 * Validates WebSocket connection credentials before allowing
 * access to gateway methods. Supports device-auth tokens and
 * session keys.
 *
 * SECURITY: Authentication tokens are validated on every WebSocket
 * message, not just on connection. Token rotation and revocation
 * take effect immediately without requiring reconnection.
 *
 * SECURITY: Session keys are scoped to a specific agent+device pair.
 * Cross-device session access is blocked at the authentication layer.
 */
```

### Memory Class Conversion Example
```javascript
// BEFORE (TypeScript):
export class MemoryIndexManager implements MemorySearchManager {
  private db: Database;
  private config: MemoryConfig;

  constructor(db: Database, config: MemoryConfig) {
    this.db = db;
    this.config = config;
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    // ...
  }
}

// AFTER (JavaScript):
/**
 * Manages memory index for vector search.
 * @implements {MemorySearchManager}
 */
export class MemoryIndexManager {
  /** @type {*} */
  _db;
  /** @type {*} */
  _config;

  /**
   * @param {*} db - SQLite database instance.
   * @param {*} config - Memory configuration.
   */
  constructor(db, config) {
    this._db = db;
    this._config = config;
  }

  /**
   * Search memory index.
   * @param {string} query - Search query.
   * @param {number} limit - Max results.
   * @returns {Promise<Array>} Search results.
   */
  async search(query, limit) {
    // ...
  }
}
```

## File Count Summary

| Directory | Source | Tests | Total Files | Lines | Plan |
|-----------|--------|-------|-------------|-------|------|
| `src/gateway/` | 128 | 63 | 191 | 39,044 | 03-01 |
| `src/agents/` | 231 | 220 | 451 | 78,107 | 03-02 |
| `src/providers/` | 4 | 4 | 8 | 1,174 | 03-02 |
| `src/logging/` | 9 | 5 | 14 | 1,898 | 03-03 |
| `src/memory/` | 26 | 13 | 39 | 8,932 | 03-03 |
| `src/sessions/` | 6 | 1 | 7 | 388 | 03-03 |
| `src/terminal/` | 10 | 2 | 12 | 917 | 03-03 |
| `src/plugins/` | 29 | 8 | 37 | 7,259 | 03-03 |
| `src/logging.ts` (barrel) | 1 | 0 | 1 | 67 | 03-03 |
| **Total** | **444** | **316** | **760** | **137,786** | |

### TypeScript Pattern Counts

| Pattern | gateway | agents | providers | logging | memory | sessions | terminal | plugins | Total |
|---------|---------|--------|-----------|---------|--------|----------|----------|---------|-------|
| `as` assertions | 237 | 549 | 20 | 18 | 41 | 4 | 5 | 22 | 896 |
| `import type` | 228 | 419 | 5 | 6 | 28 | 6 | 0 | 62 | 754 |
| `export type` | 200 | 185 | 1 | 11 | 35 | 4 | 4 | 108 | 548 |
| `satisfies` | 4 | 99 | 0 | 0 | 0 | 0 | 0 | 0 | 103 |
| `interface` | 3 | 9 | 0 | 0 | 1 | 0 | 0 | 0 | 13 |
| `implements` | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 3 |
| `private` keyword | 25 | 2 | 0 | 0 | 156 | 0 | 0 | 0 | 183 |
| Generic functions | 4 | 27 | 1 | 0 | 2 | 0 | 0 | 4 | 38 |
| Classes | 6 | 2 | 0 | 0 | 3 | 0 | 0 | 0 | 11 |

### Cross-Module Import Analysis

Phase 3 modules import extensively from other Phase 3 modules AND from Phase 4+ modules:

**Within Phase 3 (will be converted together):**
- Gateway imports from: agents, logging, memory, sessions, plugins, providers (all Phase 3)
- Agents imports from: gateway (protocol), logging, memory, sessions, terminal, plugins
- Memory imports from: agents, logging, sessions, config (already JS)
- Plugins imports from: agents, logging, channels (Phase 4), many Phase 4+ dirs

**From Phase 4+ (remain as .ts -- mixed state):**
- Gateway references: channels, CLI, commands, auto-reply, browser, cron, hooks, wizard, media, slack, web
- Agents references: auto-reply, channels, CLI, commands, media, process, markdown
- Plugins references: channels (9 dirs), discord, telegram, slack, signal, web, imessage, line, media, pairing, process, auto-reply, CLI, commands, wizard, hooks

These cross-phase imports are NOT a problem. All imports use `.js` extensions, and vitest/rolldown resolve `.js` to `.ts` when needed.

### Security-Sensitive Files Requiring SECURITY: Annotations

**Gateway (auth/access control):**
- `auth.ts` -- Connection authentication, token validation
- `device-auth.ts` -- Device authentication token management
- `origin-check.ts` -- WebSocket origin validation (CSRF protection)
- `server-http.ts` -- HTTP server with TLS and origin checking
- `server/ws-connection.ts` -- WebSocket connection lifecycle, auth enforcement
- `server/ws-connection/message-handler.ts` -- Per-message auth validation
- `session-utils.ts` -- Session key validation and scoping
- `server-session-key.ts` -- Session key generation and rotation

**Agents (credential management):**
- `auth-profiles/store.ts` -- Auth credential storage (API keys, OAuth tokens)
- `auth-profiles/oauth.ts` -- OAuth token refresh and exchange
- `auth-profiles/profiles.ts` -- Profile credential access
- `auth-profiles/types.ts` -- Credential type definitions
- `cli-credentials.ts` -- CLI credential management
- `model-auth.ts` -- Model API key resolution

**Providers:**
- `github-copilot-auth.ts` -- GitHub Copilot OAuth flow
- `github-copilot-token.ts` -- Token exchange and caching
- `qwen-portal-oauth.ts` -- Qwen OAuth flow

**Memory:**
- `manager.ts` -- Memory data persistence and search
- `sqlite.ts` -- Database access layer

### Test Type Distribution

| Test Type | Count | Notes |
|-----------|-------|-------|
| Unit tests (.test.ts) | 281 | Standard vitest; bulk-convertible |
| E2E tests (.e2e.test.ts) | 21 | Gateway server integration tests |
| Live tests (.live.test.ts) | 8 | Require real API keys; skip in CI |
| Test helpers (test-helpers*.ts) | 5 | Gateway shared test utilities |

## State of the Art

| Old Approach (Phase 2) | Current Approach (Phase 3) | Impact |
|-------------------------|---------------------------|--------|
| Manual conversion for small dirs | esbuild bulk + manual post-process | Scale requires automated stripping |
| Regex-based conversion attempted | esbuild only (regex proven unreliable) | Regex approach is banned |
| Each file converted individually | Batch by subdirectory, then eslint --fix | More efficient for 760 files |

## Open Questions

1. **Plan 03-02 size (459 files)**
   - What we know: The agents directory alone is larger than all of Phase 2. The roadmap assigns it as a single plan.
   - What's unclear: Whether a single plan with multiple tasks can handle this volume, or if it should be split into multiple plans.
   - Recommendation: Structure 03-02 with 6-8 tasks by subdirectory (tools, pi-embedded-runner, skills, auth-profiles, sandbox, root-level, tests). Each task is a self-contained conversion wave. This stays within the 3-plan structure while being manageable.

2. **QUAL-01/QUAL-02 scope in bulk conversion**
   - What we know: The success criteria require "nested conditionals flattened to early returns" and "arrow syntax and functional patterns where appropriate." These are manual improvements that cannot be automated.
   - What's unclear: How much QUAL-01/02 improvement is expected during Phase 3 vs. being a nice-to-have.
   - Recommendation: Apply QUAL-01/02 improvements to new code written during post-processing (module-level structure, obvious nested-if patterns). Do NOT attempt to refactor every function in 78K lines of agents code. Focus on files that are touched for other reasons (security annotations, complex type removal).

3. **Whether to keep esbuild permanently**
   - What we know: Phases 4 and 5 also need bulk conversion. esbuild is a ~5MB devDependency.
   - What's unclear: Whether to add it now and keep it through Phase 5, or add/remove each phase.
   - Recommendation: Add esbuild once now, keep through Phase 5, remove in Phase 6 cleanup.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 760 files in scope (file counts, line counts, pattern grep analysis)
- Phase 2 research and summaries (02-RESEARCH.md, 02-06-SUMMARY.md) -- established conversion patterns
- Phase 2 decisions in STATE.md -- all prior conversion decisions apply

### Secondary (MEDIUM confidence)
- esbuild `transformSync` behavior: validated during Phase 2 execution (02-06-SUMMARY.md confirms it works)
- Mixed .ts/.js import resolution: confirmed working throughout Phase 2

## Metadata

**Confidence breakdown:**
- File inventory: HIGH -- Directly enumerated from filesystem with exact counts
- Conversion patterns: HIGH -- Established and validated in Phase 2 (13 plans completed)
- TypeScript pattern analysis: HIGH -- grep-based pattern counts across all directories
- Cross-module dependency map: HIGH -- Traced actual imports from source files
- QUAL-01/02 scope: MEDIUM -- Success criteria are subjective ("where appropriate")
- esbuild availability: HIGH -- Confirmed NOT currently installed; must be added

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days -- conversion patterns are stable, codebase state captured)
