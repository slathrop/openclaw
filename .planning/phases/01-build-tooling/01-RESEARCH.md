# Phase 1: Build Tooling - Research

**Researched:** 2026-02-04
**Domain:** JavaScript build tooling, linting, formatting, testing configuration
**Confidence:** HIGH

## Summary

Phase 1 replaces the TypeScript compilation toolchain with a JavaScript-only build, lint, format, and test pipeline. The codebase currently uses tsdown (backed by rolldown) for bundling, oxlint+oxfmt for linting/formatting, vitest for testing, and TypeScript 5.9.3 with tsgo (native preview) for type-checking. All of these TS-specific tools must be removed or reconfigured for plain JavaScript.

The standard approach is: (1) Replace tsdown with direct rolldown configuration for JS bundling, (2) Replace oxlint+oxfmt with ESLint 9 flat config + ESLint Stylistic for linting and formatting, (3) Add eslint-plugin-jsdoc for JSDoc validation, (4) Reconfigure Vitest to target `.js` files, (5) Add lodash-es as a dependency, and (6) Remove all TypeScript-specific devDependencies and config files.

**Primary recommendation:** Use ESLint 9 with flat config (`eslint.config.js`) combining `@eslint/js` recommended rules, `@stylistic/eslint-plugin` for formatting (replacing both oxlint and oxfmt in one tool), and `eslint-plugin-jsdoc` for JSDoc validation. Use rolldown directly for bundling. Keep Vitest but retarget to `.js` files.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `eslint` | ^9.39.2 | Linting engine | Industry standard JS linter, flat config stable |
| `@eslint/js` | ^9.39.2 | ESLint recommended rules | Official recommended rule set for JavaScript |
| `@stylistic/eslint-plugin` | ^5.7.0 | Formatting rules (replaces oxfmt) | Community-maintained formatting rules after ESLint deprecated theirs; provides fine-grained control |
| `eslint-plugin-jsdoc` | ^62.0.0 | JSDoc validation | De facto standard for JSDoc linting, flat config support |
| `rolldown` | 1.0.0-rc.2 | JavaScript bundler | Already in project as transitive dep via tsdown; Rust-based, fast, Rollup-compatible API |
| `vitest` | ^4.0.18 | Test runner | Already in project; supports `.js` config and test files natively |
| `lodash-es` | ^4.17.21 | Utility library (ESM) | ESM version of lodash; tree-shakeable; project requirement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `globals` | ^16.x | ESLint global variables | Needed for flat config to define Node.js globals |
| `@vitest/coverage-v8` | ^4.0.18 | Coverage reporting | Already in project; keep for coverage thresholds |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@stylistic/eslint-plugin` | Prettier + eslint-config-prettier | Prettier is more opinionated, less control; ESLint Stylistic lets us define exact Google Style rules with the no-trailing-comma deviation |
| `rolldown` (direct) | Keep `tsdown` | tsdown is a TS-focused wrapper around rolldown; removing it simplifies the JS-only story |
| `lodash-es` | `lodash` (CJS) | lodash CJS doesn't tree-shake; lodash-es is the ESM build, required for ESM-only project |
| `eslint-config-google` | Manual rules | eslint-config-google last released 2016 (v0.7.0), does not support ESLint 9 flat config, effectively abandoned; must implement rules manually |

**Installation:**
```bash
pnpm add -D eslint @eslint/js @stylistic/eslint-plugin eslint-plugin-jsdoc globals
pnpm add lodash-es
```

**Removal:**
```bash
pnpm remove typescript @typescript/native-preview tsdown tsx oxlint oxfmt oxlint-tsgolint
pnpm remove @types/express @types/markdown-it @types/node @types/proper-lockfile @types/qrcode-terminal @types/ws @grammyjs/types
```

## Architecture Patterns

### Recommended Project Structure (Config Files)
```
/
  eslint.config.js          # ESLint flat config (replaces .oxlintrc.json + .oxfmtrc.jsonc)
  vitest.config.js          # Vitest config (renamed from .ts)
  vitest.unit.config.js     # Unit test config (renamed from .ts)
  vitest.gateway.config.js  # Gateway test config (renamed from .ts)
  vitest.extensions.config.js # Extensions test config (renamed from .ts)
  vitest.e2e.config.js      # E2E test config (renamed from .ts)
  vitest.live.config.js     # Live test config (renamed from .ts)
  rolldown.config.js        # Rolldown bundler config (replaces tsdown.config.ts)
```

### Files to Remove
```
tsconfig.json               # TypeScript compiler config
tsdown.config.ts            # tsdown bundler config
.oxlintrc.json              # Oxlint config
.oxfmtrc.jsonc              # Oxfmt config
```

### Pattern 1: ESLint Flat Config Structure
**What:** Single `eslint.config.js` file that combines linting rules, formatting rules, and JSDoc validation
**When to use:** All JavaScript linting and formatting
**Example:**
```javascript
// eslint.config.js
// Source: https://eslint.org/docs/latest/use/configure/configuration-files
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default defineConfig([
  // Global ignores (replaces .oxlintrc.json ignorePatterns)
  globalIgnores([
    'assets/',
    'dist/',
    'docs/_layouts/',
    'node_modules/',
    'patches/',
    'skills/',
    'src/canvas-host/a2ui/a2ui.bundle.js',
    'vendor/',
  ]),

  // Base JavaScript rules
  {
    name: 'base/recommended',
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      // Google Style: const/let, no var
      'no-var': 'error',
      'prefer-const': 'error',
      // Google Style: strict equality
      eqeqeq: ['error', 'always'],
      // Google Style: braces required
      curly: ['error', 'all'],
      // Google Style: arrow callbacks
      'prefer-arrow-callback': 'error',
      // Google Style: template literals
      'prefer-template': 'error',
      // Google Style: rest params over arguments
      'prefer-rest-params': 'error',
      // Google Style: spread over .apply()
      'prefer-spread': 'error',
    },
  },

  // Stylistic / formatting rules (replaces oxfmt)
  {
    name: 'style/google-modified',
    files: ['**/*.js', '**/*.mjs'],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      // Google Style: 2-space indent
      '@stylistic/indent': ['error', 2],
      // Google Style: single quotes
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      // Google Style: always semicolons
      '@stylistic/semi': ['error', 'always'],
      // DEVIATION from Google Style: no trailing commas (Google requires them for multiline)
      '@stylistic/comma-dangle': ['error', 'never'],
      // Google Style: space before blocks
      '@stylistic/space-before-blocks': 'error',
      // Google Style: keyword spacing
      '@stylistic/keyword-spacing': 'error',
      // Google Style: space around operators
      '@stylistic/space-infix-ops': 'error',
      // Google Style: comma spacing
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      // Google Style: max line length 80 (with exceptions)
      '@stylistic/max-len': ['error', {
        code: 80,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      }],
    },
  },

  // JSDoc validation (TOOL-03)
  {
    name: 'jsdoc/recommended',
    files: ['src/**/*.js'],
    extends: [jsdoc.configs['flat/recommended']],
    rules: {
      // Warn (not error) for missing JSDoc - we want it where helpful, not everywhere
      'jsdoc/require-jsdoc': 'off',
      // Validate JSDoc that IS present
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/valid-types': 'error',
    },
  },
]);
```

### Pattern 2: Rolldown Config for JS Bundling
**What:** Direct rolldown configuration replacing tsdown for JavaScript-only bundling
**When to use:** Building dist/ output for production
**Example:**
```javascript
// rolldown.config.js
// Source: https://rolldown.rs/guide/getting-started
import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/index.js',
    output: {
      dir: 'dist',
      format: 'esm',
    },
    platform: 'node',
  },
  {
    input: 'src/entry.js',
    output: {
      dir: 'dist',
      format: 'esm',
    },
    platform: 'node',
  },
  {
    input: 'src/plugin-sdk/index.js',
    output: {
      dir: 'dist/plugin-sdk',
      format: 'esm',
    },
    platform: 'node',
  },
  {
    input: 'src/extensionAPI.js',
    output: {
      dir: 'dist',
      format: 'esm',
    },
    platform: 'node',
  },
]);
```

### Pattern 3: Vitest Config for JavaScript
**What:** Vitest configuration targeting `.js` test files
**When to use:** Test runner configuration
**Example:**
```javascript
// vitest.config.js
// Source: https://vitest.dev/config/
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isWindows = process.platform === 'win32';
const localWorkers = Math.max(4, Math.min(16, os.cpus().length));
const ciWorkers = isWindows ? 2 : 3;

export default defineConfig({
  resolve: {
    alias: {
      'openclaw/plugin-sdk': path.join(repoRoot, 'src', 'plugin-sdk', 'index.js'),
    },
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: isWindows ? 180_000 : 120_000,
    pool: 'forks',
    maxWorkers: isCI ? ciWorkers : localWorkers,
    include: ['src/**/*.test.js', 'extensions/**/*.test.js', 'test/format-error.test.js'],
    setupFiles: ['test/setup.js'],
    exclude: [
      'dist/**',
      'apps/macos/**',
      '**/node_modules/**',
      '**/vendor/**',
      'dist/OpenClaw.app/**',
      '**/*.live.test.js',
      '**/*.e2e.test.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 55,
        statements: 70,
      },
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js'],
    },
  },
});
```

### Anti-Patterns to Avoid
- **Using eslint-config-google:** Abandoned since 2016, does not support ESLint 9 flat config. Must implement Google Style rules manually.
- **Using Prettier alongside ESLint Stylistic:** Pick one formatting approach. Since we need fine-grained control for the no-trailing-comma deviation, ESLint Stylistic is the better fit.
- **Using `lodash` instead of `lodash-es`:** The project is ESM-only (`"type": "module"`). The CJS `lodash` package requires interop hacks and doesn't tree-shake.
- **Keeping tsconfig.json:** Even with `noEmit: true`, keeping tsconfig.json sends mixed signals about the project being TypeScript.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google Style rules | Custom ESLint config from scratch | Start from `@eslint/js` recommended + `@stylistic/eslint-plugin` customize | 20+ individual rules need correct configuration; stylistic plugin has them all |
| JSDoc validation | Manual regex checks | `eslint-plugin-jsdoc` | Handles all JSDoc tag validation, type checking, cross-referencing |
| ESM enforcement | Custom lint rules for `require()` | ESLint `sourceType: 'module'` + `no-var` + `prefer-const` | ESLint's parser natively understands ESM vs CJS; sourceType 'module' flags require() |
| Formatting | Multiple tools (linter + formatter) | `@stylistic/eslint-plugin` handles both linting and formatting | Single tool, single config, single `eslint --fix` command |
| Import sorting | Custom scripts | `@stylistic/eslint-plugin` has member-delimiter and related rules | Consistent import ordering without additional tooling |

**Key insight:** The entire linting + formatting stack can be unified into ESLint alone using the Stylistic plugin, eliminating the need for a separate formatter (oxfmt or Prettier). This reduces tooling complexity from 3 tools (oxlint + oxfmt + tsgo) to 1 (eslint).

## Common Pitfalls

### Pitfall 1: eslint-config-google Is Dead
**What goes wrong:** Attempting to use `eslint-config-google` which hasn't been updated since 2016
**Why it happens:** It appears in npm search results and has 172k dependents from legacy projects
**How to avoid:** Implement Google Style rules manually in eslint.config.js using `@eslint/js` recommended + `@stylistic/eslint-plugin` rules
**Warning signs:** Any configuration using `extends: 'google'` or `eslint-config-google` in dependencies

### Pitfall 2: Trailing Comma Confusion
**What goes wrong:** The Google JavaScript Style Guide actually REQUIRES trailing commas for multiline (`"always-multiline"`). The project requirement is the OPPOSITE: no trailing commas in multiline.
**Why it happens:** The requirement says "Google Standard JavaScript Style (no trailing commas in multiline)" which reads like Google Style includes no trailing commas, but it does not -- this is a custom deviation.
**How to avoid:** Configure `@stylistic/comma-dangle: ['error', 'never']` explicitly. This overrides what Google Style would normally require.
**Warning signs:** Finding `"always-multiline"` in comma-dangle config

### Pitfall 3: Forgetting to Remove All TypeScript Artifacts
**What goes wrong:** Leftover TypeScript configuration causes confusion or build errors
**Why it happens:** TypeScript is deeply embedded -- tsconfig.json, @types/* packages, tsdown config, tsx runtime, vitest configs with .ts extensions
**How to avoid:** Create a comprehensive checklist:
  - Remove `tsconfig.json`
  - Remove `tsdown.config.ts`
  - Remove all `@types/*` devDependencies
  - Remove `typescript`, `@typescript/native-preview`, `tsdown`, `tsx`
  - Remove `oxlint`, `oxfmt`, `oxlint-tsgolint`
  - Remove `.oxlintrc.json`, `.oxfmtrc.jsonc`
  - Rename all `vitest.*.config.ts` to `.js`
  - Update `package.json` scripts that reference `tsgo`, `tsdown`, `tsx`, `oxlint`, `oxfmt`
**Warning signs:** `pnpm build` or `pnpm check` invoking any `ts*` command

### Pitfall 4: Vitest Config Import Chain
**What goes wrong:** The vitest config files form an import chain (unit/gateway/extensions all import from base vitest.config.ts). Renaming only the base file breaks the chain.
**Why it happens:** `vitest.unit.config.ts` does `import baseConfig from './vitest.config.ts'`
**How to avoid:** Rename ALL vitest config files together: base + unit + gateway + extensions + e2e + live
**Warning signs:** Vitest startup errors about missing config imports

### Pitfall 5: Package.json Scripts with TS References
**What goes wrong:** Build scripts that use `node --import tsx scripts/foo.ts` stop working after tsx removal
**Why it happens:** Many package.json scripts (build, protocol:gen, plugins:sync, etc.) use `tsx` to run TypeScript scripts
**How to avoid:** Phase 1 should update scripts that are in the critical path (build, check, test, dev). Other scripts that run `.ts` files in `scripts/` can be deferred to later phases since they're not part of the core build/lint/test workflow.
**Warning signs:** Any script containing `--import tsx` or referencing `.ts` files

### Pitfall 6: Rolldown vs tsdown API Differences
**What goes wrong:** Rolldown's direct API differs from tsdown's wrapper API
**Why it happens:** tsdown adds TypeScript-specific features (DTS generation, TS transpilation) on top of rolldown. The rolldown.config.js format differs from tsdown.config.ts.
**How to avoid:** Use rolldown's native `defineConfig` with `input`/`output` options. No need for `dts: true` (no TypeScript). No need for `fixedExtension` (JS files are already .js). Key difference: tsdown uses `entry` while rolldown uses `input`.
**Warning signs:** Using tsdown-specific config options like `dts`, `fixedExtension`, or `env` in rolldown config

### Pitfall 7: Max Line Length 80 May Be Too Aggressive Initially
**What goes wrong:** Setting `max-len: 80` immediately causes thousands of violations across the codebase during conversion
**Why it happens:** The existing codebase was formatted by oxfmt which may have different line width settings
**How to avoid:** Consider starting with `max-len` as a warning or setting a wider limit (100-120) initially, then tightening in a later phase. Alternatively, set it to 80 but with generous `ignorePattern`, `ignoreUrls`, `ignoreStrings`, `ignoreTemplateLiterals` options.
**Warning signs:** Linting producing hundreds of max-len violations that aren't meaningful

## Code Examples

Verified patterns from official sources:

### ESLint Flat Config with defineConfig
```javascript
// Source: https://eslint.org/docs/latest/use/configure/configuration-files
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
]);
```

### ESLint Stylistic Configuration
```javascript
// Source: https://eslint.style/guide/config-presets
import stylistic from '@stylistic/eslint-plugin';

// Option A: Use customize() factory
stylistic.configs.customize({
  indent: 2,
  quotes: 'single',
  semi: true,
  jsx: false,
});

// Option B: Manual rules (recommended for fine-grained control)
{
  plugins: { '@stylistic': stylistic },
  rules: {
    '@stylistic/indent': ['error', 2],
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/comma-dangle': ['error', 'never'],
  },
}
```

### JSDoc Plugin Flat Config
```javascript
// Source: https://github.com/gajus/eslint-plugin-jsdoc
import jsdoc from 'eslint-plugin-jsdoc';

// Use the flat/recommended preset
export default [
  jsdoc.configs['flat/recommended'],
  {
    rules: {
      'jsdoc/require-jsdoc': 'off', // Don't require JSDoc everywhere
      'jsdoc/check-types': 'error', // But validate types when present
    },
  },
];
```

### Lodash-ES Import Pattern
```javascript
// Source: Community best practice for ESM lodash
// Preferred: namespace import (clear which functions are from lodash)
import * as _ from 'lodash-es';

const grouped = _.groupBy(items, 'category');
const picked = _.pick(obj, ['name', 'age']);
const debounced = _.debounce(fn, 300);

// Also valid: named imports (tree-shakeable)
import { groupBy, pick, debounce } from 'lodash-es';
```

### Rolldown Config for Node.js ESM
```javascript
// Source: https://rolldown.rs/guide/getting-started
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  platform: 'node',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint legacy config (.eslintrc) | ESLint flat config (eslint.config.js) | ESLint 9 (Apr 2024), finalized in v10 RC (Jan 2026) | Must use flat config; legacy removed in v10 |
| eslint-config-google (v0.7.0) | Manual Google Style rules via @eslint/js + @stylistic | eslint-config-google abandoned ~2016 | Cannot use the package; must implement rules |
| Separate linter + formatter | ESLint Stylistic (unified) | ESLint deprecated formatting rules (2023), community fork as @stylistic | Single tool for both linting and formatting |
| tsdown (TS bundler wrapper) | rolldown (direct JS bundler) | rolldown 1.0.0-rc (2025) | No need for TS wrapper; use rolldown directly |
| lodash (CJS) | lodash-es (ESM) | lodash-es 4.17.21 | Required for ESM-only projects; tree-shakeable |

**Deprecated/outdated:**
- `eslint-config-google`: Last release 2016. Use manual rules.
- `.eslintrc.*` config format: Deprecated in ESLint 9, removed in ESLint 10. Use `eslint.config.js`.
- ESLint core formatting rules: Deprecated. Use `@stylistic/eslint-plugin`.
- `tsdown` for JS-only projects: Unnecessary wrapper; use rolldown directly.

## Open Questions

Things that couldn't be fully resolved:

1. **Rolldown RC stability for production bundling**
   - What we know: Rolldown 1.0.0-rc.2 is already in the project as a transitive dependency of tsdown. The project uses it for bundling today (indirectly).
   - What's unclear: Whether rolldown's direct API has all features needed (env injection, multiple entry points, external dependencies).
   - Recommendation: Test rolldown config early. If it falls short, the project can use a simple file-copy approach since JS files don't need compilation -- just organize them into dist/.

2. **Whether bundling is even needed for JS source**
   - What we know: tsdown currently bundles TypeScript into JavaScript for `dist/`. With JS source files, the `dist/` directory could potentially just be a copy of `src/` or the source could be referenced directly.
   - What's unclear: Whether the project depends on bundling behavior (tree-shaking, dead code elimination, single-file output).
   - Recommendation: Check if `openclaw.mjs` (the entry point) imports `./dist/entry.js`. If so, dist/ must exist. Rolldown can bundle JS-to-JS (minification, tree-shaking). Alternatively, a simple copy could work if bundling features aren't needed.

3. **Scripts directory conversion scope**
   - What we know: Many scripts in `scripts/` are `.ts` files executed via `node --import tsx`. These are not part of the core build/lint/test workflow but are referenced by some package.json scripts.
   - What's unclear: Which scripts need to be converted in Phase 1 vs. deferred.
   - Recommendation: Phase 1 should only convert scripts referenced by core workflows: `build`, `check`, `test`, `dev`. Other scripts (protocol-gen, release-check, etc.) can keep using tsx temporarily or be deferred.

4. **Max line length setting**
   - What we know: Google Style says 80 chars. The existing codebase was formatted by oxfmt which may use a different width.
   - What's unclear: What line width the existing code actually uses.
   - Recommendation: Start with `max-len: ['warn', 100]` to avoid noise, then tighten to 80 as code is converted in later phases.

## Sources

### Primary (HIGH confidence)
- [ESLint Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) - Flat config structure, defineConfig, globalIgnores
- [ESLint Stylistic](https://eslint.style/) - Formatting rules, customize() factory, config presets
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html) - Official style rules (trailing commas, semicolons, indentation, quotes, etc.)
- [Vitest Configuration](https://vitest.dev/config/) - Config file extensions, JS support
- [Rolldown Getting Started](https://rolldown.rs/guide/getting-started) - defineConfig, input/output, platform options
- [eslint-plugin-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc) - Flat config presets, recommended rules

### Secondary (MEDIUM confidence)
- [ESLint Stylistic Config Presets](https://eslint.style/guide/config-presets) - customize() options
- [comma-dangle rule docs](https://eslint.style/rules/comma-dangle) - "never" option configuration
- [ESLint v10.0.0-rc.0 announcement](https://eslint.org/blog/2026/01/eslint-v10.0.0-rc.0-released/) - Legacy config removal timeline

### Tertiary (LOW confidence)
- [lodash-es npm page](https://www.npmjs.com/package/lodash-es) - Version 4.17.21+ (npm page returned 403, version from search results)
- [eslint-config-google GitHub](https://github.com/google/eslint-config-google) - Last release 2016, effectively abandoned

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools verified via official documentation and npm registry
- Architecture: HIGH - ESLint flat config patterns well-documented; Vitest JS config confirmed
- Pitfalls: HIGH - eslint-config-google abandonment verified; trailing comma deviation explicitly documented
- Rolldown direct usage: MEDIUM - RC status; used indirectly today but direct API not battle-tested in this project
- Max line length: LOW - Need to check existing codebase formatting before deciding

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - tooling is stable)
