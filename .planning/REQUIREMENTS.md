# Requirements: OpenClaw JavaScript Simplification

**Defined:** 2026-02-04
**Core Value:** Human-friendly JavaScript that senior engineers will accept and maintain

## v1 Requirements

Requirements for the complete TypeScript to JavaScript conversion with full feature parity.

### Build Tooling

- [ ] **TOOL-01**: Remove TypeScript compilation toolchain (tsconfig, tsdown, TS dependencies)
- [ ] **TOOL-02**: Set up ESLint with Google Standard JavaScript Style (no trailing commas in multiline)
- [ ] **TOOL-03**: Configure JSDoc validation support in linter/editor tooling
- [ ] **TOOL-04**: Add lodash as a project dependency
- [ ] **TOOL-05**: Ensure all JavaScript uses ESM (import/export, no CommonJS require)
- [ ] **TOOL-06**: Update package.json scripts for JS-only workflow (dev, build, test, lint)

### Core Source Conversion

- [ ] **CORE-01**: Convert CLI infrastructure (`src/cli/`) from TypeScript to JavaScript
- [ ] **CORE-02**: Convert command implementations (`src/commands/`) from TypeScript to JavaScript
- [ ] **CORE-03**: Convert gateway server (`src/gateway/`) from TypeScript to JavaScript
- [ ] **CORE-04**: Convert routing and session logic (`src/routing/`, `src/config/`) from TypeScript to JavaScript
- [ ] **CORE-05**: Convert agent runtime (`src/agents/`) from TypeScript to JavaScript
- [ ] **CORE-06**: Convert AI provider clients (`src/providers/`) from TypeScript to JavaScript
- [ ] **CORE-07**: Convert all channel implementations (`src/telegram/`, `src/discord/`, `src/whatsapp/`, `src/slack/`, `src/signal/`, `src/imessage/`, `src/feishu/`, `src/line/`, `src/web/`) from TypeScript to JavaScript
- [ ] **CORE-08**: Convert shared infrastructure (`src/infra/`, `src/utils/`, `src/shared/`, `src/types/`) from TypeScript to JavaScript
- [ ] **CORE-09**: Convert logging, memory, sessions, terminal, and plugin modules from TypeScript to JavaScript
- [ ] **CORE-10**: Convert entry points (`src/index.ts`, `src/entry.ts`, `src/runtime.ts`) from TypeScript to JavaScript

### Test Conversion

- [ ] **TEST-01**: Convert all colocated test files (`*.test.ts`) to JavaScript
- [ ] **TEST-02**: Update Vitest configuration for JavaScript source files
- [ ] **TEST-03**: Maintain existing coverage thresholds (70% lines/functions/statements)
- [ ] **TEST-04**: All existing tests pass after conversion

### UI Conversion

- [ ] **UI-01**: Convert web UI source (`ui/src/`) from TypeScript to JavaScript
- [ ] **UI-02**: Update Vite configuration for JavaScript
- [ ] **UI-03**: Web UI functions identically after conversion

### Extension Conversion

- [ ] **EXT-01**: Convert all extension packages (`extensions/`) from TypeScript to JavaScript
- [ ] **EXT-02**: Update extension package.json files for JS-only workflow
- [ ] **EXT-03**: All extensions function identically after conversion

### Code Quality

- [ ] **QUAL-01**: Flatten nested function logic throughout codebase (early returns, set-and-return pattern)
- [ ] **QUAL-02**: Favor arrow functions and functional programming style (map, filter, reduce)
- [ ] **QUAL-03**: Introduce lodash where built-in JS methods are verbose
- [ ] **QUAL-04**: Add module-level comments introducing abstractions and concepts at top of each module
- [ ] **QUAL-05**: Add ample comments on security concerns, unusual complexity, and atypical patterns
- [ ] **QUAL-06**: Add JSDoc annotations on non-obvious function signatures and complex return types
- [ ] **QUAL-07**: Preserve abstractions that improve comprehension; flatten those that add complexity without benefit

### Feature Parity

- [ ] **FEAT-01**: CLI commands work identically (gateway, channels, agent, config, status, doctor, etc.)
- [ ] **FEAT-02**: All messaging channels function identically (Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Feishu, LINE)
- [ ] **FEAT-03**: Gateway server starts, accepts WebSocket connections, and routes messages identically
- [ ] **FEAT-04**: Agent runtime processes and responds to messages identically
- [ ] **FEAT-05**: Configuration loading, validation, and routing resolution work identically
- [ ] **FEAT-06**: Plugin/extension system loads and runs extensions identically

## v2 Requirements

Deferred to future effort after code simplification is complete.

### Feature Reduction

- **REDUCE-01**: Identify and remove unnecessary features
- **REDUCE-02**: Identify and remove undesirable features
- **REDUCE-03**: Strip codebase to core essential features

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native app rewrites (Swift/Kotlin) | This project targets the Node.js codebase only |
| UI framework changes | React + Tailwind stays, just converted from TS to JS |
| New features | Purely a code transformation project |
| Feature removal | Separate future effort after simplification |
| Performance optimization | Not a goal; feature parity is the bar |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOL-01 | — | Pending |
| TOOL-02 | — | Pending |
| TOOL-03 | — | Pending |
| TOOL-04 | — | Pending |
| TOOL-05 | — | Pending |
| TOOL-06 | — | Pending |
| CORE-01 | — | Pending |
| CORE-02 | — | Pending |
| CORE-03 | — | Pending |
| CORE-04 | — | Pending |
| CORE-05 | — | Pending |
| CORE-06 | — | Pending |
| CORE-07 | — | Pending |
| CORE-08 | — | Pending |
| CORE-09 | — | Pending |
| CORE-10 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| EXT-01 | — | Pending |
| EXT-02 | — | Pending |
| EXT-03 | — | Pending |
| QUAL-01 | — | Pending |
| QUAL-02 | — | Pending |
| QUAL-03 | — | Pending |
| QUAL-04 | — | Pending |
| QUAL-05 | — | Pending |
| QUAL-06 | — | Pending |
| QUAL-07 | — | Pending |
| FEAT-01 | — | Pending |
| FEAT-02 | — | Pending |
| FEAT-03 | — | Pending |
| FEAT-04 | — | Pending |
| FEAT-05 | — | Pending |
| FEAT-06 | — | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 0
- Unmapped: 39

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04 after initial definition*
