# Roadmap: OpenClaw JavaScript Simplification

## Overview

This roadmap converts the OpenClaw codebase from TypeScript to JavaScript in six phases. It starts with build tooling, then converts source code layer-by-layer from shared infrastructure up through CLI/channels/UI, applying code quality improvements during each conversion phase rather than as a separate pass. The final phase verifies full feature parity and test coverage across the entire converted codebase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Build Tooling** - Replace TypeScript toolchain with JavaScript-native build, lint, and test infrastructure
- [x] **Phase 2: Foundation Layer** - Convert shared infrastructure, config, routing, and entry points to JavaScript
- [x] **Phase 3: Core Services** - Convert gateway, agents, providers, and support modules to JavaScript
- [x] **Phase 4: CLI and Channels** - Convert CLI infrastructure, commands, and all channel implementations to JavaScript
- [x] **Phase 5: UI and Extensions** - Convert web UI and extension packages to JavaScript
- [x] **Phase 6: Verification and Parity** - Validate all tests pass, coverage holds, and every feature works identically

## Phase Details

### Phase 1: Build Tooling
**Goal**: The project builds, lints, and runs tests using a JavaScript-only toolchain
**Depends on**: Nothing (first phase)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06
**Plans:** 3 plans
**Success Criteria** (what must be TRUE):
  1. Running `pnpm build` succeeds without invoking the TypeScript compiler (no tsc, no tsdown TS compilation)
  2. Running `pnpm check` applies Google Standard JavaScript Style with no trailing commas in multiline and reports violations
  3. Running `pnpm test` executes Vitest against JavaScript source files
  4. Lodash is available as a project dependency and importable via ESM
  5. All package.json scripts reference JavaScript files and tools only (no TS-specific scripts remain)

Plans:
- [x] 01-01-PLAN.md -- Remove TypeScript toolchain and create rolldown bundler config
- [x] 01-02-PLAN.md -- Install and configure ESLint with Google Style, JSDoc, and ESM enforcement
- [x] 01-03-PLAN.md -- Update package.json scripts, rename vitest configs, add lodash-es

### Phase 2: Foundation Layer
**Goal**: The shared modules that every other layer depends on are converted to idiomatic JavaScript with established quality patterns
**Depends on**: Phase 1
**Requirements**: CORE-08, CORE-10, CORE-04, TEST-02, QUAL-04, QUAL-05, QUAL-06
**Plans:** 10 plans
**Success Criteria** (what must be TRUE):
  1. All files in `src/infra/`, `src/utils/`, `src/shared/`, `src/types/`, `src/config/`, `src/routing/` are JavaScript (.js) with no remaining .ts files
  2. Entry points (`src/index.js`, `src/entry.js`, `src/runtime.js`) load and bootstrap the CLI successfully
  3. Every converted module has a top-level comment explaining its purpose, and non-obvious functions have JSDoc annotations
  4. Security-sensitive code (auth tokens, credential handling, TLS) has explicit comments explaining the security concern
  5. Vitest configuration resolves and runs tests against .js source files

Plans:
- [x] 02-01-PLAN.md -- Delete src/types/ declarations, convert src/shared/ and src/utils/ to JS
- [x] 02-02-PLAN.md -- Convert infra device/auth/security and heartbeat/diagnostics modules
- [x] 02-03-PLAN.md -- Convert infra update system, state migrations, and network discovery
- [x] 02-04-PLAN.md -- Convert infra provider-usage, shell/env, and session cost modules
- [x] 02-05-PLAN.md -- Convert infra misc utilities (retry, ports, platform, file I/O)
- [x] 02-06-PLAN.md -- Convert infra net/, outbound/, and tls/ subdirectories (security-critical)
- [x] 02-07-PLAN.md -- Convert config type definitions and Zod validation schemas
- [x] 02-08-PLAN.md -- Convert config core modules and legacy migration system
- [x] 02-09-PLAN.md -- Convert remaining config modules, sessions, and all config tests
- [x] 02-10-PLAN.md -- Convert routing, entry points, and update Vitest configuration

### Phase 3: Core Services
**Goal**: The gateway server, agent runtime, AI providers, and support modules are converted to idiomatic JavaScript
**Depends on**: Phase 2
**Requirements**: CORE-03, CORE-05, CORE-06, CORE-09, QUAL-01, QUAL-02
**Plans:** 8 plans
**Success Criteria** (what must be TRUE):
  1. All files in `src/gateway/`, `src/agents/`, `src/providers/` are JavaScript with no remaining .ts files
  2. All files in `src/logging/`, `src/memory/`, `src/sessions/`, `src/terminal/`, `src/plugins/` are JavaScript with no remaining .ts files
  3. Nested conditionals and callback pyramids are flattened to early returns and set-and-return patterns throughout converted code
  4. Functions use arrow syntax and functional patterns (map, filter, reduce) instead of imperative loops where appropriate
  5. Gateway server starts and accepts WebSocket connections when run from the converted source

Plans:
- [x] 03-01-PLAN.md -- Install esbuild, convert logging, sessions, terminal, and providers
- [x] 03-02-PLAN.md -- Convert memory subsystem and plugin system
- [x] 03-03-PLAN.md -- Convert gateway protocol layer (TypeBox/Zod schemas)
- [x] 03-04-PLAN.md -- Convert gateway source files (root, server, server-methods)
- [x] 03-05-PLAN.md -- Convert agents root-level source files
- [x] 03-06-PLAN.md -- Convert agents subdirectories (tools, auth-profiles, pi-embedded, sandbox, skills)
- [x] 03-07-PLAN.md -- Convert gateway test files and verify full gateway test suite
- [x] 03-08-PLAN.md -- Convert agents root-level test files and verify root-level test suite

### Phase 4: CLI and Channels
**Goal**: The CLI layer, all commands, and all nine messaging channel implementations are converted to idiomatic JavaScript
**Depends on**: Phase 3
**Requirements**: CORE-01, CORE-02, CORE-07, QUAL-03, QUAL-07
**Plans:** 3 plans
**Success Criteria** (what must be TRUE):
  1. All files in `src/cli/` and `src/commands/` are JavaScript with no remaining .ts files
  2. All nine channel directories (`src/telegram/`, `src/discord/`, `src/whatsapp/`, `src/slack/`, `src/signal/`, `src/imessage/`, `src/feishu/`, `src/line/`, `src/web/`, `src/channels/`) are JavaScript with no remaining .ts files
  3. Lodash is used in place of verbose built-in methods where it improves readability (e.g., groupBy, keyBy, pick, omit, debounce)
  4. Abstractions that add indirection without aiding comprehension are flattened; abstractions that clarify complex logic are preserved with explanatory comments
  5. Running `openclaw --help` from the converted source displays all commands correctly

Plans:
- [x] 04-01-PLAN.md -- Convert CLI infrastructure (170 files) and command implementations (227 files)
- [x] 04-02-PLAN.md -- Convert Telegram, Discord, WhatsApp, and Slack channel implementations (220 files)
- [x] 04-03-PLAN.md -- Convert Signal, iMessage, Feishu, LINE, Web, shared channels, and test-utils (275 files)

### Phase 5: UI and Extensions
**Goal**: The web UI and all extension packages are converted to JavaScript, completing source conversion
**Depends on**: Phase 3 (UI depends on gateway client; extensions depend on plugin system)
**Requirements**: UI-01, UI-02, EXT-01, EXT-02, TEST-01
**Success Criteria** (what must be TRUE):
  1. All files in `ui/src/` are JavaScript with no remaining .ts/.tsx files
  2. Vite configuration builds the web UI from JavaScript source without TypeScript plugins
  3. All extension packages in `extensions/` are JavaScript with updated package.json files for JS-only workflow
  4. All colocated test files (`*.test.ts`) across the entire codebase have been converted to JavaScript (`*.test.js`)
  5. Zero `.ts` files remain in `src/`, `ui/src/`, or `extensions/` (excluding declaration files if any are deliberately retained)
**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md -- Convert web UI source (113 Lit files) and Vite/Vitest configuration
- [x] 05-02-PLAN.md -- Convert all 31 extension packages (394 files) and update package.json configs
- [x] 05-03-PLAN.md -- Convert remaining src/ directories (571 files), test/ (15 files), update vitest configs, verify zero .ts

### Phase 6: Verification and Parity
**Goal**: Every feature works identically to the TypeScript version, all tests pass, and coverage thresholds are maintained
**Depends on**: Phase 5
**Requirements**: UI-03, EXT-03, TEST-03, TEST-04, FEAT-01, FEAT-02, FEAT-03, FEAT-04, FEAT-05, FEAT-06
**Success Criteria** (what must be TRUE):
  1. All existing tests pass (`pnpm test` exits 0 with no failures)
  2. Code coverage meets or exceeds 70% thresholds for lines, functions, and statements
  3. All CLI commands execute correctly (`openclaw gateway run`, `openclaw channels status`, `openclaw agent --message`, `openclaw config`, `openclaw status`, `openclaw doctor`)
  4. All messaging channels connect and relay messages (Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Feishu, LINE)
  5. Web UI loads in browser, connects to gateway via WebSocket, and renders chat interface
**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md -- Fix systematic test failures (CommandLane circular import, minified variable artifacts), verify coverage
- [x] 06-02-PLAN.md -- Verify CLI commands, gateway server startup, and configuration
- [x] 06-03-PLAN.md -- Verify channels, web UI, and extensions function correctly

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Build Tooling | 3/3 | Complete | 2026-02-04 |
| 2. Foundation Layer | 10/10 | Complete | 2026-02-04 |
| 3. Core Services | 8/8 | Complete | 2026-02-05 |
| 4. CLI and Channels | 3/3 | Complete | 2026-02-05 |
| 5. UI and Extensions | 3/3 | Complete | 2026-02-05 |
| 6. Verification and Parity | 3/3 | Complete | 2026-02-05 |
