# OpenClaw JavaScript Simplification

## What This Is

A comprehensive refactor of the OpenClaw multi-channel messaging gateway from TypeScript to JavaScript. The goal is to produce a codebase that senior JavaScript engineers will find immediately readable, maintainable, and acceptable for adoption — while preserving every existing feature.

## Core Value

The code must be human-friendly to senior JavaScript engineers above all else. Every decision — style, structure, abstractions, comments — serves readability and maintainability for a team that will evaluate this code.

## Requirements

### Validated

- ✓ Multi-channel messaging gateway (Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Feishu, LINE) — existing
- ✓ CLI interface with Commander.js for command dispatch — existing
- ✓ Plugin-based channel architecture — existing
- ✓ Config-driven message routing with agent bindings — existing
- ✓ Embedded AI agent runtime (Pi) — existing
- ✓ WebSocket-based gateway server — existing
- ✓ Web UI (React + Tailwind) — existing
- ✓ Extension/plugin system (workspace packages) — existing
- ✓ Session memory and persistence — existing
- ✓ macOS, iOS, Android native apps — existing

### Active

- [ ] Convert all TypeScript source to JavaScript (ESM)
- [ ] Apply Google Standard JavaScript Style (no trailing commas in multiline)
- [ ] Add JSDoc annotations where they aid comprehension (non-obvious signatures, complex returns)
- [ ] Add module-level comments introducing abstractions and concepts
- [ ] Add ample comments on security concerns, unusual complexity, and atypical patterns
- [ ] Flatten nested function logic (early returns, set-and-return pattern)
- [ ] Favor arrow functions, functional programming, built-in JS methods
- [ ] Introduce lodash where built-in methods are verbose
- [ ] Preserve or improve abstractions that earn their place; flatten those that don't
- [ ] Maintain full feature parity — all existing functionality works identically
- [ ] Update build tooling for JavaScript (remove TypeScript compilation step)
- [ ] Convert tests from TypeScript to JavaScript, maintain coverage

### Out of Scope

- Feature removal or reduction — separate future effort after code simplification
- Native app rewrites (Swift/Kotlin) — this project targets the Node.js codebase only
- UI framework changes — React + Tailwind stays as-is, just converted from TS to JS
- New features — this is purely a code transformation project

## Context

**Team acceptance**: This refactor exists to make the codebase acceptable to a specific team of senior JavaScript engineers. They use Google Standard Style, prefer functional programming, and use lodash. The code needs to pass their review.

**Existing codebase**: ~700+ TypeScript files across `src/`, `ui/`, `extensions/`, `scripts/`, and `test/`. The architecture is modular with clear separation of concerns: CLI layer, command layer, routing layer, gateway layer, channel plugins, agent runtime, and provider clients.

**Codebase map**: Full analysis available in `.planning/codebase/` (ARCHITECTURE.md, STACK.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, INTEGRATIONS.md, CONCERNS.md).

**Current tooling**: TypeScript 5.9.3, tsdown bundler, Vitest test runner, pnpm/Bun package management, Node.js 22+. Build pipeline will need reworking to remove TS compilation.

## Constraints

- **Feature parity**: Every existing feature must work identically after conversion. No regressions.
- **Style**: Google Standard JavaScript Style with no trailing commas in multiline scenarios. Non-negotiable — this is the team's standard.
- **Comments**: Senior-engineer level. Ample on security, complexity, and atypical patterns. Minimal elsewhere.
- **Code patterns**: Flat function logic, arrow functions, functional programming, lodash where appropriate. Small helper functions encouraged.
- **Testing**: All tests must be converted and passing. Coverage thresholds maintained.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript → JavaScript | Team acceptance requires JS; TS adds cognitive overhead for this audience | — Pending |
| Google Standard Style (no trailing commas) | Matches team's existing conventions | — Pending |
| JSDoc over no types | Preserves type documentation where helpful without TS toolchain | — Pending |
| Lodash for verbose operations | Team preference; improves readability for functional patterns | — Pending |
| Feature parity first, then reduce | Separates concerns; proves the code works before removing features | — Pending |

---
*Last updated: 2026-02-04 after initialization*
