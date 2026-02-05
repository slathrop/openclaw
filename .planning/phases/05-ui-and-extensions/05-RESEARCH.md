# Phase 5: UI and Extensions - Research

**Researched:** 2026-02-05
**Domain:** TypeScript-to-JavaScript conversion of web UI (Lit), extension packages, remaining src/ modules, and all test files
**Confidence:** HIGH

## Summary

Phase 5 is the final source conversion phase, converting 1,078 remaining TypeScript files across three domains: the web UI (113 files, ~21K lines), extension packages (394 files, ~75K lines), and remaining src/ directories plus test files (571 files, ~106K lines). The total scope is approximately 202K lines of TypeScript across 1,078 files. This makes it the largest single phase by file count and line count.

The web UI uses **Lit** (not React) -- a web components library. It has no .tsx files, no JSX. Only 2 files use Lit decorators (`@customElement`, `@state`, `@property`), which must be manually converted to static property declarations and `customElements.define()` calls. The remaining 111 UI files are plain TypeScript with type annotations, `import type` statements, and Lit `html` template literals. A critical difference from src/: UI import paths use `.ts` extensions (350 occurrences), not `.js`. These must all be rewritten to `.js` during conversion. Cross-imports from UI to the main src/ already use `.js` extensions (14 occurrences) and are safe.

Extensions are workspace packages under `extensions/` (31 packages). Each has a `package.json` with `openclaw.extensions: ["./index.ts"]` that must be updated to `./index.js`. Extension import paths already use `.js` extensions, following the main codebase convention. The 6 largest extensions (matrix/67, msteams/58, voice-call/41, twitch/31, nostr/23, bluebubbles/23) account for 243 of 394 files. Extensions have 22 interface declarations, 7 classes with inheritance, 25 files with `private` keyword, and zero enums or decorators.

The remaining src/ directories (auto-reply/209, browser/81, tui/38, media-understanding/37, cron/34, hooks/33, daemon/30, plus 8 smaller directories) follow established conversion patterns. All 216 test files in src/, 77 in extensions/, 20 in ui/, and 6 in test/ must also be converted. Vitest configs (`vitest.config.js`, `ui/vitest.config.ts`, and 5 additional vitest configs) need their include patterns and setupFiles updated to reference `.js` files.

**Primary recommendation:** Use the established esbuild `transformSync` bulk conversion pattern for all three domains. Convert UI files with manual post-processing for the 2 decorator files and `.ts` -> `.js` import path rewriting. Convert extensions in batches grouped by size. Convert remaining src/ directories with the same esbuild pipeline. Update all vitest configs and extension package.json files last.

## Standard Stack

No new libraries needed. The conversion uses only tooling established in Phases 1-4.

### Core (already installed)
| Library | Version | Purpose | Role in Phase 5 |
|---------|---------|---------|-----------------|
| `esbuild` | ^0.27.2 | TS type stripping | Bulk conversion via `transformSync` for all 1,078 files |
| `eslint` | ^9.39.2 | Linter/formatter | Validates and auto-formats converted .js files |
| `vitest` | ^4.0.18 | Test runner | Runs converted tests; config updates needed |
| `vite` | 7.3.1 | UI bundler | Serves .js files natively; no plugins to remove |
| `lit` | ^3.3.2 | Web components | UI framework; decorator-to-static-properties conversion |

### Libraries Used by Phase 5 Code (NOT new -- already dependencies)
| Library | Domain | Notes for Conversion |
|---------|--------|---------------------|
| `lit` + `lit/decorators.js` | UI | 2 files use decorators; convert to static properties |
| `@noble/ed25519` | UI | Used in device-identity.ts; pure JS-compatible |
| `dompurify`, `marked` | UI | Used in markdown.ts; no type issues |
| `@matrix-org/matrix-sdk-crypto-nodejs` | extensions/matrix | Native addon; no TS-specific concerns |
| `@twurple/*` | extensions/twitch | Twitch SDK; type imports need stripping |
| `@microsoft/agents-*` | extensions/msteams | MS Teams SDK; type imports need stripping |
| `nostr-tools` | extensions/nostr | Nostr SDK; type imports need stripping |

## Architecture Patterns

### Plan-to-Directory Mapping

```
Plan 05-01: Web UI source and Vite configuration (115 files, ~21K lines)
  ui/src/ui/           93 source + 20 test = 113 files
  ui/vite.config.ts    1 file (rename + strip types)
  ui/vitest.config.ts  1 file (rename + update patterns)

Plan 05-02: Extension packages (394 files, ~75K lines)
  Large (10+ files):
    matrix/            67 files (~12K lines)
    msteams/           58 files (~11K lines)
    voice-call/        41 files (~7K lines)
    twitch/            31 files (~5K lines)
    nostr/             23 files (~4K lines)
    bluebubbles/       23 files (~4K lines)
    tlon/              20 files (~3K lines)
    zalo/              17 files (~3K lines)
    mattermost/        17 files (~3K lines)
    nextcloud-talk/    16 files (~3K lines)
    zalouser/          15 files (~3K lines)
    googlechat/        15 files (~3K lines)
  Medium (4-9 files):
    line/               6 files
    feishu/             4 files
  Small (1-3 files):   18 extensions, 1-3 files each
  31 package.json files need openclaw.extensions updated

Plan 05-03: Remaining src/ directories + ALL test files (~571 + 319 files, ~106K lines)
  Remaining src/ source files:
    auto-reply/        121 source + 88 test = 209 files (~42K lines)
    browser/            52 source + 29 test =  81 files (~17K lines)
    media-understanding/ 25 source + 12 test = 37 files (~5K lines)
    tui/                24 source + 14 test =  38 files (~6K lines)
    hooks/              22 source + 11 test =  33 files (~6K lines)
    cron/               22 source + 12 test =  34 files (~5K lines)
    daemon/             19 source + 11 test =  30 files (~5K lines)
    media/              11 source +  8 test =  19 files (~3K lines)
    acp/                10 source +  3 test =  13 files (~1K lines)
    wizard/              7 source +  3 test =  10 files (~2K lines)
    security/            7 source +  3 test =  10 files (~5K lines)
    markdown/            6 source +  2 test =   8 files (~2K lines)
    link-understanding/  6 source +  1 test =   7 files (<1K lines)
    process/             5 source +  4 test =   9 files (<1K lines)
    pairing/             3 source +  2 test =   5 files (<1K lines)
    macos/               3 source +  1 test =   4 files (<1K lines)
    node-host/           2 source +  1 test =   3 files (~1K lines)
    canvas-host/         2 source +  1 test =   3 files (~1K lines)
  Root-level src/ files:
    polls.ts, logger.ts, extensionAPI.ts, channel-web.ts  (4 source)
    index.test.ts, docker-setup.test.ts, globals.test.ts,
    channel-web.barrel.test.ts, polls.test.ts, logger.test.ts  (6 test)
  test/ directory:
    setup.ts, test-env.ts, global-setup.ts (3 support files)
    inbound-contract.providers.test.ts, auto-reply.retry.test.ts (2 test)
    provider-timeout.e2e.test.ts, gateway.multi.e2e.test.ts,
    media-understanding.auto.e2e.test.ts (3 e2e test)
  Vitest config updates:
    vitest.config.js (include + setupFiles)
    vitest.e2e.config.js (include + setupFiles)
    vitest.extensions.config.js (include)
    vitest.gateway.config.js (include)
    vitest.live.config.js (include + setupFiles)
    vitest.unit.config.js (include)
```

### Pattern 1: Lit Decorator to Static Properties (Manual Conversion)
**What:** Convert Lit `@customElement`, `@state`, `@property` decorators to plain JS equivalents
**When to use:** 2 files: `ui/src/ui/app.ts` and `ui/src/ui/components/resizable-divider.ts`
**Example:**
```javascript
// BEFORE (TypeScript with decorators):
import { LitElement } from "lit";
import { customElement, state, property } from "lit/decorators.js";

@customElement("openclaw-app")
export class OpenClawApp extends LitElement {
  @state() connected = false;
  @state() theme = "system";
  @property({ type: Number }) splitRatio = 0.6;
  private _internal = false;
}

// AFTER (JavaScript without decorators):
import { LitElement } from "lit";

export class OpenClawApp extends LitElement {
  static properties = {
    connected: { state: true },
    theme: { state: true },
    splitRatio: { type: Number },
  };

  constructor() {
    super();
    this.connected = false;
    this.theme = "system";
    this.splitRatio = 0.6;
    this._internal = false;
  }
}
customElements.define("openclaw-app", OpenClawApp);
```
**Source:** https://lit.dev/docs/components/properties/, https://lit.dev/docs/components/defining/

**Critical:** In JavaScript Lit components, reactive properties MUST be initialized in the `constructor()` (after `super()`), NOT as class fields. Class field initialization runs after the constructor and overwrites Lit's property setup. The `static properties` declaration tells Lit which fields are reactive; the constructor sets initial values.

### Pattern 2: UI Import Path Rewriting (.ts to .js)
**What:** Rewrite all internal import paths from `.ts` to `.js` in UI files
**When to use:** 350 import occurrences across 92 UI files
**Example:**
```javascript
// BEFORE:
import type { EventLogEntry } from "./app-events.ts";
import { renderApp } from "./app-render.ts";

// AFTER:
import { renderApp } from "./app-render.js";
// (import type is removed entirely by esbuild)
```
**Note:** Cross-imports from UI to `src/` already use `.js` extensions and do NOT need changing.

### Pattern 3: Extension package.json Update
**What:** Update `openclaw.extensions` array entries from `./index.ts` to `./index.js`
**When to use:** All 31 extension package.json files
**Example:**
```json
// BEFORE:
"openclaw": {
  "extensions": ["./index.ts"]
}

// AFTER:
"openclaw": {
  "extensions": ["./index.js"]
}
```

### Pattern 4: declare global Removal
**What:** Remove `declare global { ... }` blocks which are TypeScript-only ambient declarations
**When to use:** 3 UI files: `app.ts` (Window augmentation), `resizable-divider.ts` (HTMLElementTagNameMap), `assistant-identity.ts` (Window augmentation)
**Note:** esbuild does NOT strip `declare global` blocks -- they cause syntax errors in .js files. Must be removed manually or via post-processing regex.

### Pattern 5: __screenshots__ Directory Renaming
**What:** The UI has screenshot output directories named with `.test.ts` suffixes that are actually directories (not files)
**Where:** `ui/src/ui/__screenshots__/navigation.browser.test.ts/` and `ui/src/ui/__screenshots__/config-form.browser.test.ts/`
**Action:** These directories must be renamed to `.test.js` to match the renamed test files they correspond to, or the screenshot paths in the test runner config must be updated.

### Pattern 6: Vitest Config Updates
**What:** Update vitest include patterns and setupFiles references from .ts to .js
**When to use:** 7 config files need updates
**Details:**
- `vitest.config.js`: Add `extensions/**/*.test.js` to include; change `test/format-error.test.ts` to `.js`; update setupFiles from `test/setup.ts` to `test/setup.js`
- `ui/vitest.config.ts`: Rename to `.js`; change include from `src/**/*.test.ts` to `src/**/*.test.js`
- `vitest.e2e.config.js`: Update setupFiles; patterns already include `.js`
- `vitest.extensions.config.js`: Patterns already include `.js`
- `vitest.live.config.js`: Update setupFiles
- `vitest.unit.config.js`: Update `.ts` patterns to `.js`

### Anti-Patterns to Avoid
- **Using esbuild for Lit decorator files:** esbuild generates ~60 lines of TC39 decorator lowering boilerplate per file. Manually convert the 2 decorator files to static properties instead.
- **Forgetting UI import path rewriting:** Unlike src/ which already uses `.js` imports, UI uses `.ts` imports. If not rewritten, all module resolution will break.
- **Leaving `declare global` blocks:** esbuild does not remove them; they produce syntax errors in .js files.
- **Initializing Lit reactive properties as class fields:** Must use constructor initialization per Lit documentation for JavaScript.
- **Converting vendor/ files:** The `vendor/a2ui/renderers/lit/src/0.8/model.test.ts` file is in vendor/ which is not tracked in git and not in scope.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk type stripping (1,078 files) | Regex-based converter | esbuild `transformSync` | Proven in Phases 2-4 |
| UI import path .ts -> .js | Manual find-replace | Regex `s/\.ts"/\.js"/g` post esbuild | 350 occurrences across 92 files; mechanical |
| Lit decorator conversion | esbuild TC39 lowering | Manual static properties pattern | Only 2 files; esbuild generates excessive boilerplate |
| Extension package.json updates | Manual editing 31 files | Script: `find extensions/*/package.json` + sed/node | Mechanical, automatable |
| Vitest config pattern updates | Manual editing | Coordinated update of 7 config files | Must be done atomically to avoid broken test runs |
| `declare global` removal | - | Regex `s/declare global \{[\s\S]*?\n\}//g` | 3 occurrences; esbuild doesn't strip them |

**Key insight:** Phase 5 follows the exact same esbuild + eslint --fix pipeline as Phases 2-4. The only new patterns are Lit decorator conversion (2 files), UI import path rewriting (.ts to .js), and extension package.json updates. Everything else is established workflow.

## Common Pitfalls

### Pitfall 1: UI Import Paths Use .ts, Not .js
**What goes wrong:** After renaming UI files from .ts to .js, all internal imports fail because they reference `.ts` extensions
**Why it happens:** The UI codebase convention uses `.ts` in import paths (350 occurrences), unlike src/ which uses `.js`
**How to avoid:** After esbuild conversion, run a global replace on all UI files: change `.ts"` to `.js"` and `.ts'` to `.js'` in import/export statements. Also update the `main.ts` entry in `index.html` to `main.js`.
**Warning signs:** "Module not found" errors when running `vite dev` or `vite build`

### Pitfall 2: Lit Reactive Properties Initialized as Class Fields
**What goes wrong:** Converting `@state() count = 0` to a plain class field `count = 0` with `static properties` loses reactivity
**Why it happens:** JavaScript class fields run AFTER the constructor. Lit's property system sets up accessors during `super()`. If a class field then overwrites the accessor, reactivity breaks.
**How to avoid:** Initialize ALL reactive properties in the constructor after `super()`, not as class fields
**Warning signs:** UI elements don't re-render when state changes

### Pitfall 3: `declare global` Blocks Not Removed by esbuild
**What goes wrong:** esbuild's `transformSync` does NOT strip `declare global { ... }` blocks, causing syntax errors in .js output
**Why it happens:** esbuild treats `declare` as potentially having runtime effects in some edge cases and leaves it in
**How to avoid:** Post-process to remove `declare global { ... }` blocks. There are exactly 3 in the UI: `app.ts` (Window.__OPENCLAW_CONTROL_UI_BASE_PATH__), `resizable-divider.ts` (HTMLElementTagNameMap), `assistant-identity.ts` (Window augmentation)
**Warning signs:** SyntaxError on `declare` keyword when loading .js file

### Pitfall 4: Extension openclaw.extensions Entry Not Updated
**What goes wrong:** After converting extension files to .js, the plugin loader still looks for `./index.ts` because `package.json` wasn't updated
**Why it happens:** Each of the 31 extension package.json files has `"openclaw": { "extensions": ["./index.ts"] }`
**How to avoid:** Script to update all 31 package.json files: change `./index.ts` to `./index.js` in the `openclaw.extensions` array
**Warning signs:** Plugin loading errors: "Cannot find module ./index.ts"

### Pitfall 5: msteams Has openclaw in Both dependencies AND devDependencies
**What goes wrong:** The `workspace:*` in dependencies will break when published to npm
**Why it happens:** This appears to be a pre-existing issue. CLAUDE.md states "Avoid `workspace:*` in `dependencies`"
**How to avoid:** During conversion, move `openclaw` from `dependencies` to `devDependencies` only (or `peerDependencies`). Same for nostr, zalo, and zalouser which also have this pattern.
**Warning signs:** `npm install` fails in published extension packages

### Pitfall 6: __screenshots__ Directories Named .test.ts
**What goes wrong:** The `ui/src/ui/__screenshots__/` contains directories named `navigation.browser.test.ts` and `config-form.browser.test.ts` (these are DIRECTORIES, not files). After renaming test files, screenshot paths may break.
**Why it happens:** Playwright/vitest stores screenshots in directories named after the test file
**How to avoid:** After renaming test files, also rename these screenshot directories to match (.test.js). Or verify that the test runner auto-creates new directories.
**Warning signs:** Screenshot comparison tests fail because baseline images can't be found

### Pitfall 7: Vitest Config setupFiles Still References .ts
**What goes wrong:** Test runs fail because `test/setup.ts` no longer exists after conversion
**Why it happens:** Multiple vitest configs reference `setupFiles: ['test/setup.ts']`
**How to avoid:** Convert `test/setup.ts`, `test/test-env.ts`, `test/global-setup.ts` alongside or before updating vitest configs. Update setupFiles references in vitest.config.js, vitest.e2e.config.js, and vitest.live.config.js.
**Warning signs:** "Cannot find module 'test/setup.ts'" at test startup

### Pitfall 8: esbuild keepNames Boilerplate in Remaining src/ Files
**What goes wrong:** esbuild generates `__defProp`/`__name` wrappers that break vitest `vi.mock` hoisting
**Why it happens:** Established issue from Phase 4; esbuild's `keepNames` option (or default behavior) adds boilerplate
**How to avoid:** Strip `__name` boilerplate from all converted files post-esbuild, as done in Phase 4
**Warning signs:** "vi.mock must be called at the top level" errors in test files

### Pitfall 9: Phase 5 Scope Includes ALL Remaining src/ Source Files
**What goes wrong:** Plan 05-03 is assumed to be "just test files" but it actually includes 355 unconverted source files in src/
**Why it happens:** Success criterion #5: "Zero .ts files remain in src/". Phases 2-4 converted specific directories (infra, config, gateway, agents, providers, cli, commands, channels) but 18 directories remain.
**How to avoid:** Plan 05-03 must explicitly list ALL remaining src/ directories: auto-reply (121 source), browser (52), media-understanding (25), tui (24), hooks (22), cron (22), daemon (19), media (11), acp (10), wizard (7), security (7), markdown (6), link-understanding (6), process (5), pairing (3), macos (3), node-host (2), canvas-host (2), plus 10 root-level files. Total: 355 source + 216 test files in src/ alone.
**Warning signs:** "Zero .ts files" verification fails because entire directories were overlooked

### Pitfall 10: auto-reply Is the Largest Single Directory (209 files, ~42K lines)
**What goes wrong:** Attempting to convert all of auto-reply in a single task causes timeouts
**Why it happens:** auto-reply has 121 source files and 88 test files totaling ~42K lines
**How to avoid:** Break auto-reply conversion into subdirectory waves, similar to Phase 4's commands/ handling
**Warning signs:** Conversion task runs >30 minutes without progress

## Code Examples

### Lit Static Properties Conversion (app.ts)
```javascript
// Source: https://lit.dev/docs/components/properties/
// BEFORE (ui/src/ui/app.ts):
import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";

@customElement("openclaw-app")
export class OpenClawApp extends LitElement {
  @state() settings = loadSettings();
  @state() password = "";
  @state() tab = "chat";
  @state() connected = false;
  private eventLogBuffer = [];
}

// AFTER (ui/src/ui/app.js):
import { LitElement } from "lit";

export class OpenClawApp extends LitElement {
  static properties = {
    settings: { state: true },
    password: { state: true },
    tab: { state: true },
    connected: { state: true },
    // ... all @state() fields listed here
  };

  constructor() {
    super();
    this.settings = loadSettings();
    this.password = "";
    this.tab = "chat";
    this.connected = false;
    this.eventLogBuffer = [];  // non-reactive, just a plain field
  }
}
customElements.define("openclaw-app", OpenClawApp);
```

### Lit ResizableDivider Conversion (resizable-divider.ts)
```javascript
// BEFORE:
import { LitElement, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("resizable-divider")
export class ResizableDivider extends LitElement {
  @property({ type: Number }) splitRatio = 0.6;
  @property({ type: Number }) minRatio = 0.4;
  @property({ type: Number }) maxRatio = 0.7;
  private isDragging = false;
  // ...
}

declare global {
  interface HTMLElementTagNameMap {
    "resizable-divider": ResizableDivider;
  }
}

// AFTER:
import { LitElement, css, nothing } from "lit";

export class ResizableDivider extends LitElement {
  static properties = {
    splitRatio: { type: Number },
    minRatio: { type: Number },
    maxRatio: { type: Number },
  };

  constructor() {
    super();
    this.splitRatio = 0.6;
    this.minRatio = 0.4;
    this.maxRatio = 0.7;
    this._isDragging = false;
  }

  // ... rest of methods with type annotations stripped
}
customElements.define("resizable-divider", ResizableDivider);
// (declare global block removed entirely)
```

### UI Import Path Rewriting Script
```javascript
// post-convert-ui-imports.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

function rewriteImports(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { rewriteImports(full); continue; }
    if (extname(entry.name) !== '.js') continue;

    let content = readFileSync(full, 'utf-8');
    // Rewrite .ts imports to .js (both single and double quotes)
    content = content.replace(/(from\s+['"])([^'"]+)\.ts(['"])/g, '$1$2.js$3');
    writeFileSync(full, content);
  }
}

rewriteImports(process.argv[2]);
```

### Extension package.json Batch Update Script
```javascript
// update-extension-entrypoints.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const extDir = 'extensions';
for (const name of readdirSync(extDir)) {
  const pkgPath = join(extDir, name, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (pkg.openclaw?.extensions) {
      pkg.openclaw.extensions = pkg.openclaw.extensions.map(
        e => e.replace(/\.ts$/, '.js')
      );
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  } catch { /* skip dirs without package.json */ }
}
```

### declare global Removal Post-Processing
```javascript
// Remove declare global blocks from converted .js files
// These are TypeScript-only ambient declarations that esbuild doesn't strip
const DECLARE_GLOBAL_RE = /\ndeclare global \{[\s\S]*?\n\}\n?/g;
content = content.replace(DECLARE_GLOBAL_RE, '\n');
```

### Vitest Config Update (ui/vitest.config.ts -> vitest.config.js)
```javascript
// BEFORE (ui/vitest.config.ts):
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    browser: { enabled: true, provider: playwright(), ... },
  },
});

// AFTER (ui/vitest.config.js):
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.js"],
    browser: { enabled: true, provider: playwright(), ... },
  },
});
```

## File Count Summary

| Domain | Source Files | Test Files | Config/Other | Total Files | Lines |
|--------|------------|------------|-------------|-------------|-------|
| UI (`ui/src/`) | 93 | 20 | 2 (vite+vitest configs) | 115 | ~21K |
| Extensions (`extensions/`) | 317 | 77 | 31 (package.json) | 425 | ~75K |
| Remaining `src/` | 355 | 216 | - | 571 | ~106K |
| `test/` directory | - | 5 | 3 (setup files) | 8 | ~1K |
| Vitest configs | - | - | 6 | 6 | <1K |
| **Total** | **765** | **318** | **42** | **1,125** | **~203K** |

### TypeScript Pattern Counts

| Pattern | UI | Extensions | Remaining src/ |
|---------|-----|------------|----------------|
| Decorators | 2 files | 0 | 0 |
| `declare global` | 3 blocks | 0 | unknown |
| Classes (with extends) | 2 files | 7 files | 13 files |
| `private` keyword | 38 uses | 25 files | 18 files |
| `interface` declarations | 2 | 22 files | 3 files |
| `import type` | 137 uses | 359 uses | varies |
| `export type` | 146 uses | 303 uses | varies |
| `as` assertions | 479 uses | 894 uses | varies |
| Import paths use `.ts` | YES (350) | NO (use .js) | NO (use .js) |
| Enums | 0 | 0 | 0 |

### Extensions by Size

| Size Tier | Extensions | Total Files |
|-----------|-----------|-------------|
| Large (10+) | matrix(67), msteams(58), voice-call(41), twitch(31), nostr(23), bluebubbles(23), tlon(20), zalo(17), mattermost(17), nextcloud-talk(16), zalouser(15), googlechat(15) | 343 |
| Medium (4-9) | line(6), feishu(4) | 10 |
| Small (1-3) | 17 extensions | 41 |
| **Total** | **31 extensions** | **394** |

## State of the Art

| Old Approach (Phases 2-4) | Current Approach (Phase 5) | Impact |
|--------------------------|---------------------------|--------|
| Import paths already use .js | UI imports use .ts; need rewriting | New post-processing step for UI only |
| No decorator handling needed | 2 files use Lit decorators | Manual conversion to static properties |
| No declare global in scope | 3 declare global blocks in UI | Manual removal needed |
| No package.json updates needed | 31 extension package.json files | Batch script to update openclaw.extensions |
| ui/vitest.config.ts deferred | Must convert to .js now | Config rename + pattern update |
| Vitest configs partially updated | All 7 configs need .ts -> .js patterns | Coordinated update |
| index.html references main.ts | Must reference main.js | Single-line change in ui/index.html |

## Open Questions

1. **app.ts Has ~70 @state() Declarations**
   - What we know: The `OpenClawApp` class in `app.ts` has approximately 70 `@state()` decorated properties. Converting all to `static properties` + constructor initialization is mechanical but verbose.
   - What's unclear: Whether some of the `@state()` properties that have complex initializers (e.g., `@state() settings = loadSettings()`) need special handling.
   - Recommendation: Convert mechanically. `loadSettings()` runs in constructor, same as it would in the class field initializer. The only difference is timing (constructor vs field init), which Lit actually requires to be in constructor for JavaScript.

2. **Whether to Fix msteams/nostr/zalo/zalouser openclaw in dependencies**
   - What we know: 4 extensions have `"openclaw": "workspace:*"` in `dependencies` (not just devDependencies). CLAUDE.md says to avoid `workspace:*` in `dependencies`.
   - What's unclear: Whether this is intentional or a pre-existing bug.
   - Recommendation: Move to `devDependencies` or `peerDependencies` during conversion, matching the CLAUDE.md guidance. This is a quality fix, not a scope change.

3. **test/format-error.test.ts Referenced in vitest.unit.config.js**
   - What we know: `vitest.unit.config.js` includes `test/format-error.test.ts` but this file doesn't exist (may have been already removed or renamed).
   - What's unclear: Whether it was converted to .js or removed.
   - Recommendation: Verify during conversion; update the config reference.

4. **vendor/ Directory Has a .test.ts File**
   - What we know: `vendor/a2ui/renderers/lit/src/0.8/model.test.ts` exists but vendor/ is not tracked in git.
   - What's unclear: Whether it affects the success criteria.
   - Recommendation: Exclude from scope. The success criteria say "Zero .ts files remain in src/, ui/src/, or extensions/" -- vendor/ is not listed.

## Sources

### Primary (HIGH confidence)
- Direct filesystem analysis of all 1,078 .ts files in Phase 5 scope
- Phase 4 research (04-RESEARCH.md) -- established conversion patterns, validated approaches
- Project MEMORY.md -- all established conversion patterns and learnings
- Vitest config files -- direct analysis of include patterns and setupFiles

### Secondary (MEDIUM confidence)
- Lit official documentation (https://lit.dev/docs/components/properties/) -- static properties pattern for JavaScript
- Lit official documentation (https://lit.dev/docs/components/defining/) -- customElements.define() without decorators
- esbuild decorator handling -- tested via transformSync in this research session (produces ~60 lines boilerplate)

### Tertiary (LOW confidence)
- __screenshots__ directory renaming behavior -- needs validation that vitest auto-creates new screenshot dirs

## Metadata

**Confidence breakdown:**
- File inventory: HIGH -- Directly enumerated from filesystem with exact counts per directory
- UI Lit patterns: HIGH -- Read actual source files, verified decorator usage (only 2 files), confirmed no .tsx
- Extension structure: HIGH -- Read package.json files, verified import patterns use .js
- Remaining src/ scope: HIGH -- Exhaustively listed all 18 remaining directories with file/line counts
- Lit static properties pattern: MEDIUM -- Verified against official Lit documentation
- declare global handling: HIGH -- Verified esbuild does NOT strip these via existing Phase 4 knowledge + doc check
- Import path conventions: HIGH -- grep-verified: UI uses .ts (350), extensions use .js (31), src/ uses .js
- Vitest config updates: HIGH -- Read all 7 config files, identified specific lines needing changes

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- conversion patterns are stable)
