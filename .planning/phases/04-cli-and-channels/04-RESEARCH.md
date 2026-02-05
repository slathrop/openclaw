# Phase 4: CLI and Channels - Research

**Researched:** 2026-02-05
**Domain:** TypeScript-to-JavaScript conversion of CLI infrastructure, command implementations, and all channel implementations
**Confidence:** HIGH

## Summary

Phase 4 converts 890 TypeScript files (621 source + 269 tests) totaling ~151,500 lines across 12 directories: `src/cli/`, `src/commands/`, `src/telegram/`, `src/discord/`, `src/whatsapp/`, `src/slack/`, `src/signal/`, `src/imessage/`, `src/feishu/`, `src/line/`, `src/web/`, and `src/channels/`. This is the largest conversion phase overall, roughly 10% bigger than Phase 3 (760 files / ~138K lines). The conversion follows established patterns from Phases 2 and 3 -- no new tooling or libraries are needed beyond what is already installed.

The codebase in Phase 4 scope has no TypeScript enums, no abstract classes, and no decorators. The primary TypeScript patterns are: `as` assertions (heavily concentrated in telegram at 514 and commands at 462), `import type` statements (529 files), `export type` declarations (225 files), `satisfies` assertions (38 occurrences), `interface` declarations (34 total, with LINE having 29), classes with `private` keywords (45 occurrences across discord/22, imessage/15, feishu/5), and numerous class declarations extending external library classes (13 classes in discord extending `@buape/carbon` classes). The `src/channels/plugins/` subdirectory contains 4 type-heavy files (types.ts, types.core.ts, types.adapters.ts, types.plugin.ts) totaling ~790 lines that are almost entirely type definitions needing conversion to JSDoc @typedef modules.

Key dependencies are well-managed: Phases 1-3 modules are already converted to .js (config, infra, gateway, agents, providers, logging, memory, sessions, terminal, plugins, utils, routing). Cross-imports to Phase 5+ modules (auto-reply, pairing, wizard, cron, hooks, markdown, process, browser, tui) use `.js` extensions and resolve to `.ts` files during transition -- this is the established mixed-state pattern that has worked throughout Phases 2 and 3.

**Primary recommendation:** Use esbuild `transformSync` for bulk type stripping (already installed as devDependency), followed by eslint --fix and manual post-processing. Convert CLI and commands first (04-01) since they are the largest single plan. Then convert the four large channels (04-02: telegram, discord, whatsapp, slack) and remaining channels + shared modules (04-03: signal, imessage, feishu, line, web, channels). The shared `src/test-utils/` directory (2 files) should be converted alongside 04-03 since it imports from channels and is used by commands tests.

## Standard Stack

No new libraries are needed. The conversion uses only the tooling established in Phases 1-3.

### Core (already installed)
| Library | Version | Purpose | Role in Phase 4 |
|---------|---------|---------|-----------------|
| `esbuild` | ^0.27.2 | TS type stripping | Bulk conversion of large directories via `transformSync` |
| `eslint` | ^9.39.2 | Linter/formatter | Validates and auto-formats converted .js files |
| `vitest` | ^4.0.18 | Test runner | Runs converted tests; handles mixed .ts/.js imports |
| `rolldown` | 1.0.0-rc.2 | Bundler | Resolves .js imports to .ts when needed during transition |
| `lodash-es` | ^4.17.23 | Utility library | QUAL-03: replace verbose built-in patterns where appropriate |

### Libraries Used by Phase 4 Code (NOT new -- already dependencies)
| Library | Version | Used In | Notes for Conversion |
|---------|---------|---------|---------------------|
| `commander` | ^14.0.3 | src/cli/ | CLI framework; type annotations on Command objects need stripping |
| `@buape/carbon` | 0.14.0 | src/discord/ | Discord framework; 13 classes extend Carbon base classes |
| `@line/bot-sdk` | (in deps) | src/line/ | LINE SDK; `import type` from SDK needs removal |
| `grammy` | (in deps) | src/telegram/ | Telegram framework; type imports from Grammy need removal |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild for bulk stripping | Manual conversion | Manual only viable for <10 files. Phase 4 has 890 files. |
| lodash-es for QUAL-03 | Native Array/Object methods | lodash-es is already a dependency; QUAL-03 requires it for readability |

## Architecture Patterns

### Plan-to-Directory Mapping

```
Plan 04-01: CLI infrastructure and command implementations (397 files, ~67K lines)
  src/cli/           138 source + 32 test = 170 files, ~27K lines
  src/commands/      170 source + 57 test = 227 files, ~40K lines

Plan 04-02: Large channel implementations (220 files, ~43K lines)
  src/telegram/       40 source + 47 test =  87 files, ~20K lines
  src/discord/        44 source + 22 test =  66 files, ~13K lines
  src/whatsapp/        1 source +  1 test =   2 files,  ~152 lines
  src/slack/          43 source + 22 test =  65 files,  ~9K lines

Plan 04-03: Remaining channels + shared modules (273 files, ~42K lines)
  src/signal/         14 source + 10 test =  24 files,  ~4K lines
  src/imessage/       12 source +  5 test =  17 files,  ~3K lines
  src/feishu/         16 source +  1 test =  17 files,  ~3K lines
  src/line/           21 source + 13 test =  34 files,  ~9K lines
  src/web/            43 source + 35 test =  78 files, ~13K lines
  src/channels/       79 source + 24 test = 103 files, ~11K lines
  src/test-utils/      2 files              =   2 files (shared test utilities)
```

### CLI Directory Structure (subdirectories to convert as units)
```
src/cli/
  program/                   # 18 files - command registry, help, preaction
  program/message/           # 10 files - message subcommand registrations
  gateway-cli/               #  7 files - gateway command group
  daemon-cli/                #  8 files - daemon command group
  nodes-cli/                 # 12 files - nodes command group
  cron-cli/                  #  5 files - cron command group
  browser-cli-actions-input/ #  6 files - browser actions
  node-cli/                  #  2 files - node command
  (root level)               # ~70 files - individual CLI modules
```

### Commands Directory Structure (flat with some subdirectories)
```
src/commands/
  agent/                     #  5 files - agent command submodules
  channels/                  #  8 files - channel management commands
  models/                    # 14 files - model management commands
  onboarding/                #  5 files - onboarding submodules (includes __tests__/)
  onboard-non-interactive/   #  8 files - non-interactive onboarding
  status-all/                #  7 files - status aggregation
  gateway-status/            #  2 files - gateway status helpers
  (root level)               # ~120 files - individual command modules
```

### Pattern 1: esbuild Bulk Conversion (Established in 02-06)
**What:** Use esbuild `transformSync` to strip all TypeScript annotations from a directory, then post-process
**When to use:** Every directory in Phase 4 scope (all have 10+ files except whatsapp/2 and test-utils/2)
**Example:**
```javascript
// convert-dir.mjs -- reusable bulk conversion script (established in Phase 2/3)
import { transformSync } from 'esbuild'
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, extname } from 'node:path'

const convertDir = (dir) => {
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (extname(entry.name) !== '.ts') continue
      if (entry.name.endsWith('.d.ts')) continue

      const source = readFileSync(full, 'utf-8')
      const result = transformSync(source, {
        loader: 'ts',
        format: 'esm',
        target: 'node22'
      })
      const jsPath = full.replace(/\.ts$/, '.js')
      writeFileSync(jsPath, result.code)
      unlinkSync(full)
    }
  }
  walk(dir)
}

convertDir(process.argv[2])
```

### Pattern 2: Class Extending External Library (Discord/Carbon)
**What:** Convert classes that extend `@buape/carbon` base classes (Button, Command, MessageCreateListener, etc.)
**When to use:** 13 classes in src/discord/ that extend Carbon classes
**Example:**
```javascript
// BEFORE (TypeScript):
class DiscordCommandArgButton extends Button {
  label: string;
  customId: string;
  style = ButtonStyle.Secondary;
  private cfg: ReturnType<typeof loadConfig>;
  private discordConfig: DiscordConfig;

  constructor(params: { label: string; customId: string; cfg: ...; discordConfig: ... }) {
    super();
    this.label = params.label;
    // ...
  }

  async run(interaction: ButtonInteraction, data: ComponentData) { ... }
}

// AFTER (JavaScript):
class DiscordCommandArgButton extends Button {
  label;
  customId;
  style = ButtonStyle.Secondary;
  _cfg;
  _discordConfig;

  constructor(params) {
    super();
    this.label = params.label;
    this.customId = params.customId;
    this._cfg = params.cfg;
    this._discordConfig = params.discordConfig;
  }

  async run(interaction, data) { ... }
}
```
Note: esbuild strips `private` and type annotations automatically. Post-processing adds `_` prefix to private fields and updates all references within the class.

### Pattern 3: Constructor Parameter `private` (Discord Listeners)
**What:** TypeScript constructor parameter shorthand `private handler: Foo` creates and assigns a private field in one step
**When to use:** Discord listener classes with `private` constructor parameters
**Example:**
```javascript
// BEFORE (TypeScript):
export class DiscordMessageListener extends MessageCreateListener {
  constructor(
    private handler: DiscordMessageHandler,
    private logger?: Logger,
  ) {
    super();
  }
  // Uses this.handler and this.logger
}

// AFTER (JavaScript):
export class DiscordMessageListener extends MessageCreateListener {
  _handler;
  _logger;

  constructor(handler, logger) {
    super();
    this._handler = handler;
    this._logger = logger;
  }
  // Update all references: this.handler -> this._handler, this.logger -> this._logger
}
```
**Critical:** esbuild strips the `private` keyword but does NOT expand constructor parameter shorthand into field declarations + assignments. This must be handled in post-processing.

### Pattern 4: Interface to JSDoc @typedef (LINE types)
**What:** Convert TypeScript `interface` declarations to JSDoc @typedef
**When to use:** 34 interface declarations total (29 in LINE, 4 in telegram, 1 in cli)
**Example:**
```javascript
// BEFORE (TypeScript):
export interface LineConfig {
  enabled?: boolean;
  channelAccessToken?: string;
  channelSecret?: string;
  tokenFile?: string;
  name?: string;
  allowFrom?: Array<string | number>;
}

// AFTER (JavaScript):
/**
 * @typedef {object} LineConfig
 * @property {boolean} [enabled]
 * @property {string} [channelAccessToken]
 * @property {string} [channelSecret]
 * @property {string} [tokenFile]
 * @property {string} [name]
 * @property {Array<string|number>} [allowFrom]
 */
```

### Pattern 5: Type-Only Files to JSDoc Modules
**What:** Files containing only type exports become JSDoc @typedef modules with no runtime exports
**When to use:** 15+ type files across channels, commands, CLI
**Key files:**
- `src/channels/plugins/types.core.ts` (331 lines, all types)
- `src/channels/plugins/types.adapters.ts` (312 lines, all types)
- `src/channels/plugins/types.plugin.ts` (84 lines, all types)
- `src/channels/plugins/types.ts` (63 lines, barrel re-exports)
- `src/line/types.ts` (154 lines, interfaces + types)
- `src/commands/agent/types.ts` (77 lines, all types)
- `src/commands/onboard-types.ts` (90+ lines, all types)
- `src/commands/status.types.ts` (50+ lines, all types)
- `src/commands/models/list.types.ts` (25+ lines, all types)
- `src/cli/daemon-cli/types.ts` (27 lines, all types)
- `src/cli/nodes-cli/types.ts` (96 lines, all types)

**Special case:** `src/channels/plugins/types.ts` is a barrel that re-exports from types.core.ts, types.adapters.ts, and types.plugin.ts. After conversion, it should re-export runtime values (like `CHANNEL_MESSAGE_ACTION_NAMES`) and provide JSDoc typedefs for the rest. The `export type { ... } from "..."` statements become JSDoc `@typedef` with `@see` references.

**Special case:** `src/commands/onboarding/types.ts` is a one-line re-export barrel: `export * from "../../channels/plugins/onboarding-types.js"`. After stripping the `type` from import/export, this remains a valid runtime re-export.

### Pattern 6: `satisfies` Removal
**What:** Remove `satisfies Type` assertions without replacement
**When to use:** 38 occurrences across cli/commands/channels
**Note:** esbuild handles this automatically

### Pattern 7: QUAL-03 Lodash Introduction
**What:** Replace verbose built-in patterns with lodash-es equivalents during post-processing
**When to use:** During manual review of converted files, where lodash improves readability
**Example:**
```javascript
// BEFORE:
const grouped = items.reduce((acc, item) => {
  const key = item.type;
  if (!acc[key]) acc[key] = [];
  acc[key].push(item);
  return acc;
}, {});

// AFTER (with lodash-es):
import { groupBy } from 'lodash-es';
const grouped = groupBy(items, 'type');
```
**Note:** lodash-es is already a dependency but has ZERO usage in the codebase currently. Phase 4 is the right place to introduce it. Focus on `groupBy`, `keyBy`, `pick`, `omit`, `debounce`, `throttle`, `uniqBy`, `sortBy` where they meaningfully improve readability. Do NOT force lodash where native methods are already clear.

### Anti-Patterns to Avoid
- **Converting channel types files to empty files:** Type-only files must become JSDoc @typedef modules, not empty files. They are imported by many other modules.
- **Ignoring constructor parameter `private` in Discord classes:** esbuild strips the keyword but does not expand parameter-to-field assignment. Must manually add field declarations and constructor assignments.
- **Converting `src/test-utils/` separately:** It imports from `src/channels/` and `src/imessage/` -- must convert alongside or after channels.
- **Forcing lodash everywhere:** QUAL-03 says "where it improves readability." Native `.filter().map()` chains are already clear; lodash is for `groupBy`, `keyBy`, `pick`, `omit`, `debounce`, and similar patterns that are verbose with built-ins.
- **Batch-converting 400 files in a single operation without commits:** Break into subdirectory waves and commit after each wave for safety.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk type stripping | Regex-based converter | esbuild `transformSync` | Proven in Phases 2-3. Regex fails on inline object types, generics, multi-line annotations |
| `private` to underscore | Manual find-replace | esbuild strips keyword + post-processing adds `_` prefix | Consistent with Phase 2-3 pattern |
| `import type` removal | Manual deletion | esbuild removes type-only imports automatically | No manual work needed |
| `satisfies` removal | Manual deletion | esbuild removes `satisfies` automatically | No manual work needed |
| Formatting after conversion | Manual formatting | `eslint --fix` | Applies all Google Style rules in one pass |
| Grouping/keying collections | Verbose reduce | `lodash-es` groupBy/keyBy | QUAL-03 requirement |

**Key insight:** The esbuild + eslint --fix pipeline handles ~80% of mechanical conversion work. The remaining 20% is manual: restoring comments, SECURITY annotations, JSDoc for type files, `private` -> underscore fixups, QUAL-01/02/03 improvements, and fixing edge cases (loose null checks, unused imports).

## Common Pitfalls

### Pitfall 1: Discord Classes with Constructor Parameter `private`
**What goes wrong:** esbuild strips `private` keyword from constructor parameters but does NOT create corresponding class field declarations or constructor assignments
**Why it happens:** TypeScript's `private handler: Foo` in a constructor is syntactic sugar that creates a field AND assigns it. In JavaScript, these must be explicit.
**How to avoid:** For each class with `private` constructor parameters, post-processing must:
1. Add class field declarations (with `_` prefix): `_handler;`
2. Add constructor assignments: `this._handler = handler;`
3. Update all references in the class body: `this.handler` -> `this._handler`
**Warning signs:** Runtime errors like "Cannot read property of undefined" on class instances
**Affected files:** `src/discord/monitor/listeners.ts` (4 classes), `src/discord/monitor/exec-approvals.ts` (2 classes), `src/discord/monitor/native-command.ts` (2 classes)

### Pitfall 2: Type-Heavy Channel Plugin Files
**What goes wrong:** `src/channels/plugins/types.*.ts` files (4 files, ~790 lines total) become empty or malformed after esbuild stripping
**Why it happens:** These files are almost entirely `export type` declarations with no runtime code
**How to avoid:** Convert these files manually (not with esbuild) to JSDoc @typedef modules. The barrel file `types.ts` has one runtime re-export (`CHANNEL_MESSAGE_ACTION_NAMES`) that must be preserved.
**Warning signs:** "Cannot find module" errors or "is not defined" errors when importing channel types

### Pitfall 3: LINE's 29 Interface Declarations
**What goes wrong:** LINE has the highest concentration of interfaces in Phase 4. esbuild strips them completely, leaving no documentation of the expected shapes.
**Why it happens:** LINE uses TypeScript interfaces extensively for config types, webhook contexts, send results, etc.
**How to avoid:** After esbuild strips interfaces, add JSDoc @typedef blocks for all exported interfaces. Prioritize `types.ts` (10 interfaces) and `bot.ts` (2 interfaces) as they are the most imported.
**Warning signs:** No JSDoc @typedef in converted LINE files

### Pitfall 4: Cross-Module Imports to Phase 5+ Directories
**What goes wrong:** Converted .js files import from unconverted Phase 5+ modules (auto-reply, pairing, wizard, cron, hooks, markdown, process, browser, tui) that are still .ts
**Why it happens:** Phase 4 modules have extensive imports from Phase 5+ directories. Channels import heavily from `src/auto-reply/` (the reply processing engine). CLI imports from `src/tui/`, `src/hooks/`, etc.
**How to avoid:** This is NOT a problem. Import paths use `.js` extensions, and vitest/rolldown resolve `.js` imports to `.ts` files when the `.js` file doesn't exist. The mixed state works during transition. Do NOT change any import paths.
**Warning signs:** Module resolution errors at test time -- check that target file exists as either .ts or .js

### Pitfall 5: esbuild Strips ALL Comments
**What goes wrong:** After esbuild bulk conversion, all source files lose their comments -- including existing documentation, TODO markers, and eslint-disable directives
**Why it happens:** esbuild's `transformSync` removes all comments by default
**How to avoid:** Two strategies:
1. For small directories (whatsapp/2 files, test-utils/2 files): convert manually, preserving comments
2. For large directories: use esbuild for bulk stripping, then re-add module-level comments, SECURITY annotations, and critical inline comments
**Warning signs:** eslint-disable comments gone, causing new lint errors in converted files

### Pitfall 6: Commands Directory Size (~170 source files)
**What goes wrong:** Trying to convert all 170 command source files in a single task causes timeouts or incomplete conversions
**Why it happens:** `src/commands/` is the single largest directory in Phase 4 (~40K lines). Many files have complex type annotations.
**How to avoid:** Break into subdirectory waves:
- `commands/agent/` (5 files)
- `commands/channels/` (8 files)
- `commands/models/` (14 files)
- `commands/onboarding/` (5 files)
- `commands/onboard-non-interactive/` (8 files)
- `commands/status-all/` (7 files)
- `commands/gateway-status/` (2 files)
- `commands/` root-level (~120 files, may need further splitting)
- `commands/` tests (57 files)
**Warning signs:** Task execution exceeding 30 minutes without commits

### Pitfall 7: `src/channels/plugins/types.ts` Barrel Re-export
**What goes wrong:** The barrel file `types.ts` has both `export type { ... } from "..."` (type re-exports) and `export { CHANNEL_MESSAGE_ACTION_NAMES } from "..."` (runtime re-export). After type stripping, the type re-exports disappear.
**Why it happens:** In TypeScript, `export type { Foo }` is erased at compile time. But downstream JS modules that `import { Foo }` from this barrel will fail if Foo is not re-exported at all.
**How to avoid:** After type stripping, the barrel should retain the runtime re-export and add JSDoc @typedef references for the types. Since JS consumers typically don't import types at runtime, verify that all imports from this barrel are either `import type` (which are already stripped in the importing file) or runtime value imports.
**Warning signs:** Import errors referencing `types.js`

### Pitfall 8: `as const` in Command Option Arrays
**What goes wrong:** CLI and commands use `as const` on option arrays/objects for type narrowing. esbuild strips `as const` but some code may depend on the narrowed types for type checking.
**Why it happens:** `as const` makes arrays readonly and narrows string literals. In JavaScript, neither matters.
**How to avoid:** esbuild strips `as const` automatically. This is a non-issue in JavaScript since there's no type system. Just verify that no runtime behavior depends on the array being frozen (it doesn't -- `as const` is purely a type annotation).
**Warning signs:** None -- this is a clean removal

### Pitfall 9: Inline `type` Declarations in import Statements
**What goes wrong:** Some files use mixed imports like `import { Button, type ButtonInteraction, type ComponentData }`. esbuild handles these correctly, but manual conversion might miss the inline `type` keyword.
**Why it happens:** TypeScript allows inline `type` imports mixed with value imports in a single import statement.
**How to avoid:** Use esbuild (it handles this correctly). If doing manual conversion, remove only the `type`-annotated specifiers, keeping the value imports.
**Warning signs:** "is not exported" errors for type-only imports

### Pitfall 10: `src/test-utils/` Shared Test Utilities
**What goes wrong:** `src/test-utils/channel-plugins.ts` imports from `src/channels/plugins/types.js` and `src/imessage/targets.js`. If converted before channels and imessage, imports may break.
**Why it happens:** test-utils has dependencies on Phase 4 modules (channels, imessage).
**How to avoid:** Convert test-utils after or alongside the channels modules in plan 04-03. The 2 files are small enough for manual conversion.
**Warning signs:** Commands tests failing due to broken test-utils imports

## Code Examples

### Post-esbuild Fixup: Loose Null Checks
```javascript
// Fix esbuild's == null / != null output for eqeqeq compliance
// BEFORE (esbuild output):
if (value == null) { return }
if (result != null) { process(result) }

// AFTER (eslint eqeqeq compliant):
if (value === null || value === undefined) { return }
if (result !== null && result !== undefined) { process(result) }
```

### CLI Command Registration (Already JavaScript-Like)
```javascript
// Source: src/cli/program/build-program.ts
// This pattern is nearly pure JavaScript already -- just strip type annotations
import { Command } from 'commander'
import { registerProgramCommands } from './command-registry.js'
import { createProgramContext } from './context.js'

export function buildProgram() {
  const program = new Command()
  const ctx = createProgramContext()
  const argv = process.argv

  configureProgramHelp(program, ctx)
  registerPreActionHooks(program, ctx.programVersion)
  registerProgramCommands(program, ctx, argv)

  return program
}
```

### Channel Plugin Type File Conversion (Manual)
```javascript
// BEFORE (src/channels/plugins/types.core.ts - abbreviated):
import type { MsgContext } from "../../auto-reply/templating.js";
import type { OpenClawConfig } from "../../config/config.js";
export type ChannelId = ChatChannelId | (string & {});
export type ChannelSetupInput = {
  name?: string;
  token?: string;
  tokenFile?: string;
};

// AFTER (JavaScript JSDoc):
/**
 * Core channel plugin type definitions
 *
 * @typedef {string} ChannelId
 *
 * @typedef {object} ChannelSetupInput
 * @property {string} [name]
 * @property {string} [token]
 * @property {string} [tokenFile]
 */
```

### Discord Listener Class Conversion
```javascript
// BEFORE (TypeScript):
export class DiscordMessageListener extends MessageCreateListener {
  constructor(
    private handler: DiscordMessageHandler,
    private logger?: Logger,
  ) {
    super();
  }

  async handle(data: DiscordMessageEvent, client: Client) {
    const startedAt = Date.now();
    const task = Promise.resolve(this.handler(data, client));
    // ...
  }
}

// AFTER (JavaScript):
export class DiscordMessageListener extends MessageCreateListener {
  _handler;
  _logger;

  constructor(handler, logger) {
    super();
    this._handler = handler;
    this._logger = logger;
  }

  async handle(data, client) {
    const startedAt = Date.now();
    const task = Promise.resolve(this._handler(data, client));
    // ...
  }
}
```

### IMessage RPC Client Class Conversion
```javascript
// BEFORE (TypeScript - abbreviated):
export class IMessageRpcClient {
  private readonly cliPath: string;
  private readonly dbPath?: string;
  private readonly pending = new Map<string, PendingRequest>();
  private closedResolve: (() => void) | null = null;
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;

  constructor(opts: IMessageRpcClientOptions = {}) {
    this.cliPath = opts.cliPath?.trim() || "imsg";
    this.dbPath = opts.dbPath?.trim() ? resolveUserPath(opts.dbPath) : undefined;
  }
}

// AFTER (JavaScript):
export class IMessageRpcClient {
  _cliPath;
  _dbPath;
  _pending = new Map();
  _closedResolve = null;
  _child = null;
  _nextId = 1;

  constructor(opts = {}) {
    this._cliPath = opts.cliPath?.trim() || 'imsg';
    this._dbPath = opts.dbPath?.trim() ? resolveUserPath(opts.dbPath) : undefined;
  }
}
```

### QUAL-03: Lodash Introduction Example
```javascript
// BEFORE (verbose built-in):
const channelsByType = {};
for (const channel of channels) {
  const type = channel.meta.chatType;
  if (!channelsByType[type]) channelsByType[type] = [];
  channelsByType[type].push(channel);
}

// AFTER (lodash-es):
import { groupBy } from 'lodash-es'
const channelsByType = groupBy(channels, (ch) => ch.meta.chatType)
```

## File Count Summary

| Directory | Source | Tests | Total Files | Lines | Plan |
|-----------|--------|-------|-------------|-------|------|
| `src/cli/` | 138 | 32 | 170 | 26,736 | 04-01 |
| `src/commands/` | 170 | 57 | 227 | 39,942 | 04-01 |
| `src/telegram/` | 40 | 47 | 87 | 19,786 | 04-02 |
| `src/discord/` | 44 | 22 | 66 | 13,129 | 04-02 |
| `src/whatsapp/` | 1 | 1 | 2 | 152 | 04-02 |
| `src/slack/` | 43 | 22 | 65 | 9,468 | 04-02 |
| `src/signal/` | 14 | 10 | 24 | 3,830 | 04-03 |
| `src/imessage/` | 12 | 5 | 17 | 2,594 | 04-03 |
| `src/feishu/` | 16 | 1 | 17 | 2,677 | 04-03 |
| `src/line/` | 21 | 13 | 34 | 8,614 | 04-03 |
| `src/web/` | 43 | 35 | 78 | 13,385 | 04-03 |
| `src/channels/` | 79 | 24 | 103 | 11,150 | 04-03 |
| `src/test-utils/` | 2 | 0 | 2 | ~100 | 04-03 |
| **Total** | **623** | **269** | **892** | **~151,563** | |

### TypeScript Pattern Counts

| Pattern | cli | commands | telegram | discord | whatsapp | slack | signal | imessage | feishu | line | web | channels | Total |
|---------|-----|----------|----------|---------|----------|-------|--------|----------|--------|------|-----|----------|-------|
| `as` assertions | 341 | 462 | 514 | 178 | 1 | 150 | 32 | 19 | 29 | 244 | 182 | 118 | 2,270 |
| `import type` files | 146 | 311 | 71 | 89 | 0 | 95 | 20 | 12 | 16 | 43 | 62 | 124 | 989 |
| `export type` files | 50 | 85 | 33 | 68 | 0 | 40 | 27 | 16 | 23 | 18 | 18 | 109 | 487 |
| `satisfies` | 1 | 15 | 3 | 7 | 0 | 5 | 0 | 0 | 0 | 0 | 6 | 1 | 38 |
| `interface` | 1 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 29 | 0 | 0 | 34 |
| `private` keyword | 0 | 0 | 1 | 22 | 0 | 0 | 0 | 15 | 5 | 0 | 0 | 0 | 43 |
| Classes | 0 | 0 | 0 | 13 | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 16 |

### Cross-Module Dependency Map

**Phase 4 imports from Phase 1-3 (already .js -- safe):**
- config, infra, gateway, agents, providers, logging, memory, sessions, terminal, plugins, utils, routing

**Phase 4 imports from Phase 5+ (still .ts -- mixed state):**
- `auto-reply/` -- heavily used by telegram, web, channels
- `routing/` -- already .js (converted in earlier phase)
- `pairing/` -- used by telegram, channels
- `wizard/` -- used by commands (import type only)
- `hooks/` -- used by cli (webhooks-cli)
- `markdown/` -- used by imessage, web
- `process/` -- used by imessage, media
- `tui/` -- used by cli (tui-cli)
- `browser/` -- used by cli (browser-cli)

**Within Phase 4 (convert together or in order):**
- cli/ imports from channels/ (via deps.ts, pairing-cli.ts, channel-auth.ts)
- commands/ imports from channels/ (extensively), cli/ (command-format.js)
- channels/ imports from telegram/, discord/, slack/, signal/, imessage/, web/ (via dock.ts)
- Individual channels are largely independent of each other

**Conversion order should be:** channels -> individual channels -> cli/commands (or: convert in plan order since cross-imports use .js extensions and resolve to .ts during transition)

### Security-Sensitive Files Requiring SECURITY: Annotations

**Commands (auth/credential management):**
- `auth-choice*.ts` files (16 files) -- Auth provider selection and credential application
- `auth-token.ts` -- Token management
- `configure.gateway-auth.ts` -- Gateway authentication configuration
- `doctor-auth.ts` -- Auth diagnostics
- `doctor-security.ts` -- Security diagnostics
- `oauth-flow.ts` / `oauth-env.ts` -- OAuth token flows
- `chutes-oauth.ts` -- Chutes OAuth flow
- `onboard-auth*.ts` files (7 files) -- Onboarding credential setup

**Channels:**
- `src/slack/monitor/auth.ts` -- Slack authentication
- `src/web/auth-store.ts` -- Web (WhatsApp) auth store
- `src/channels/plugins/pairing.ts` -- Channel pairing (identity verification)
- `src/channels/command-gating.ts` -- Command access control
- `src/channels/allowlist-match.ts` -- Allowlist enforcement
- `src/channels/mention-gating.ts` -- Mention-based access gating

## State of the Art

| Old Approach (Phase 2-3) | Current Approach (Phase 4) | Impact |
|--------------------------|---------------------------|--------|
| esbuild added as devDependency per phase | esbuild already installed (^0.27.2) | Skip installation step |
| lodash-es not yet used | Introduce lodash-es usage (QUAL-03) | New pattern: import { groupBy } from 'lodash-es' |
| Type files converted ad-hoc | Systematic JSDoc @typedef module pattern | Consistent approach for 15+ type-only files |
| Classes rare in Phases 2-3 | 16 classes with inheritance and private fields | More class conversion work, especially Discord |

## Open Questions

1. **Lodash-es introduction scope for QUAL-03**
   - What we know: lodash-es is already a dependency. QUAL-03 says "Introduce lodash where built-in JS methods are verbose." The codebase currently has zero lodash usage.
   - What's unclear: How aggressively to introduce lodash. Should every `reduce` become `groupBy`? Every `Object.keys().filter()` become `pickBy`?
   - Recommendation: Introduce lodash conservatively -- only where it meaningfully reduces complexity (groupBy, keyBy, debounce, throttle, pick, omit). Do not replace clear native patterns (`.filter().map()` chains) with lodash equivalents. Flag specific opportunities during conversion.

2. **`src/test-utils/` ownership**
   - What we know: 2 files in `src/test-utils/` are not in any channel directory but import from channels (Phase 4) and are used by commands tests (Phase 4).
   - What's unclear: Whether to convert them as part of 04-01 (commands plan) or 04-03 (channels plan).
   - Recommendation: Convert in 04-03 alongside channels since they depend on channel types. Commands tests will continue working with .ts test-utils until 04-03 converts them.

3. **Channel plugins type files: JSDoc @typedef vs empty modules**
   - What we know: `src/channels/plugins/types.*.ts` files are almost entirely type definitions. In JavaScript, types don't exist at runtime.
   - What's unclear: Whether downstream code imports these at runtime (not just `import type`).
   - Recommendation: Check all imports of these files. If all are `import type`, the files can be minimized to JSDoc-only modules. If any are runtime imports of type aliases, those must be preserved as runtime values or the import must be updated.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 892 files in Phase 4 scope (file counts, line counts, pattern grep analysis)
- Phase 3 research (03-RESEARCH.md) -- established conversion patterns, validated approaches
- Phase 2-3 summaries (02-06-SUMMARY.md, etc.) -- proven esbuild bulk conversion workflow
- Prior decisions in project MEMORY.md -- all established conversion patterns

### Secondary (MEDIUM confidence)
- esbuild `transformSync` behavior: validated during Phases 2-3 execution
- Mixed .ts/.js import resolution: confirmed working throughout Phases 2-3
- lodash-es availability: confirmed in package.json as ^4.17.23

## Metadata

**Confidence breakdown:**
- File inventory: HIGH -- Directly enumerated from filesystem with exact counts
- Conversion patterns: HIGH -- Established and validated in Phases 2-3 (20+ plans completed)
- TypeScript pattern analysis: HIGH -- grep-based pattern counts across all directories
- Cross-module dependency map: HIGH -- Traced actual imports from source files
- Discord class inheritance: HIGH -- Read actual source files, counted extends patterns
- LINE interface concentration: HIGH -- Enumerated all 29 interface declarations
- QUAL-03 lodash scope: MEDIUM -- requirement is subjective ("where it improves readability")
- Constructor parameter `private` expansion: HIGH -- verified esbuild behavior in prior phases

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- conversion patterns are stable, codebase state captured)
