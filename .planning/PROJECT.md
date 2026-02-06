# OpenClaw JavaScript Simplification

## What This Is

The OpenClaw multi-channel messaging gateway, converted from TypeScript to JavaScript. The codebase is 100% JavaScript, follows Google Standard Style, includes comprehensive JSDoc annotations, and stays synchronized with upstream TypeScript development.

## Current Milestone: v2 Upstream Sync

**Goal:** Port all upstream TypeScript commits to this JavaScript codebase, maintaining 1:1 commit parity with full test verification.

**Scope:**
- 103 commits from upstream (a13ff55..ee1ec3f, INCLUSIVE)
- Security fixes, bug fixes, features, docs, tests
- Each upstream commit becomes one commit here
- Full test suite run after each ported commit

## Core Value

The code is human-friendly to senior JavaScript engineers. Every decision — style, structure, abstractions, comments — serves readability and maintainability for a team that will evaluate this code. Comments (especially JSDoc comments) generally do NOT end in a period because they are typically not complete sentences.

## Current State

**v1 JavaScript Simplification shipped 2026-02-05**

- 2,000+ TypeScript files converted to JavaScript
- 484,951 lines of JavaScript code
- 5,149 src tests + 891 extension tests passing
- 41 CLI commands, 13 channel modules, 27/29 extensions working
- Rolldown bundler, ESLint with @stylistic, Vitest test runner

## Requirements

### Validated

- ✓ Multi-channel messaging gateway (Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Feishu, LINE) — v1
- ✓ CLI interface with Commander.js for command dispatch — v1
- ✓ Plugin-based channel architecture — v1
- ✓ Config-driven message routing with agent bindings — v1
- ✓ Embedded AI agent runtime (Pi) — v1
- ✓ WebSocket-based gateway server — v1
- ✓ Web UI (React + Tailwind) — v1
- ✓ Extension/plugin system (workspace packages) — v1
- ✓ Session memory and persistence — v1
- ✓ macOS, iOS, Android native apps — existing (not touched)
- ✓ All TypeScript source converted to JavaScript (ESM) — v1
- ✓ Google Standard JavaScript Style (no trailing commas) — v1
- ✓ JSDoc annotations where they aid comprehension — v1
- ✓ Module-level comments introducing abstractions — v1
- ✓ Security comments on sensitive code — v1
- ✓ Flattened nested function logic — v1
- ✓ Arrow functions and functional patterns — v1
- ✓ Lodash where built-in methods are verbose — v1
- ✓ Full feature parity maintained — v1
- ✓ Build tooling updated for JavaScript — v1
- ✓ Tests converted and passing — v1

### Active

- [ ] Port 102 upstream commits (a13ff55..ee1ec3f) — v2
- [ ] Security fixes: sandboxed media, owner-only tools, command auth, skill scanner, credential redaction, canvas auth — v2
- [ ] Bug fixes: telegram threading, discord allowlists, cron scheduling, CLI extensions, exec approvals, session locks — v2
- [ ] Features: Claude Opus 4.6, xAI Grok provider, Feishu multi-account, QR code skill (reverted) — v2
- [ ] Docs: onboarding, install, DM security, model config — v2
- [ ] Tests: windows-acl, telegram threading, CLI extension install — v2
- [ ] 1:1 commit parity with upstream — v2
- [ ] Full test suite passing after each commit — v2

### Out of Scope

- Feature removal or reduction — separate future effort
- Native app rewrites (Swift/Kotlin) — this project targets Node.js codebase only
- UI framework changes — React + Tailwind stays as-is
- Commits outside the defined range — only a13ff55..ee1ec3f
- Cherry-picking or reordering commits — strict chronological order

## Context

**v1 shipped 2026-02-05:** 484,951 lines of JavaScript, 6 phases, 30 plans

**v2 upstream sync:** 103 commits from upstream TypeScript repo need porting
- Commit range (INCLUSIVE): a13ff55bd..ee1ec3fab
- 48 bug fixes, 13 chores, 13 docs, 6 tests, 5 features, 5 security
- Major areas: agents, feishu, commands, telegram, cron, security

**Tech stack:** Node.js 22+, Rolldown bundler, ESLint with @stylistic, Vitest, pnpm/Bun, React + Tailwind (web UI)

**Known issues (from v1):**
- Coverage at 50% vs 70% target (pre-existing intentional exclusions)
- 2 extensions fail to load (matrix, memory-lancedb) due to native module issues
- scripts/run-node.mjs has pre-existing == vs === lint errors

## Constraints

- **Feature parity**: Every existing feature works identically after conversion
- **Style**: Google Standard JavaScript Style with no trailing commas
- **Comments**: Senior-engineer level on security, complexity, and atypical patterns
- **Code patterns**: Flat function logic, arrow functions, functional programming, lodash
- **Testing**: All tests converted and passing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript → JavaScript | Team acceptance requires JS; TS adds cognitive overhead for this audience | ✓ Good |
| Google Standard Style (no trailing commas) | Matches team's existing conventions | ✓ Good |
| JSDoc over no types | Preserves type documentation where helpful without TS toolchain | ✓ Good |
| Lodash for verbose operations | Team preference; improves readability for functional patterns | ✓ Good |
| Feature parity first, then reduce | Separates concerns; proves the code works before removing features | ✓ Good |
| Rolldown bundler | Natively processes .ts, no tsc needed, fast builds | ✓ Good |
| esbuild for bulk conversion | transformSync strips types reliably; regex insufficient for complex TS | ✓ Good |
| Multi-agent parallel execution | Faster phase completion with wave-based parallelization | ✓ Good |
| Private field underscore convention | Matches esbuild output, consistent across codebase | ✓ Good |

---
*Last updated: 2026-02-05 after v2 milestone started*
