# Phase 7 Plan 02: Telegram Bot-Message Cleanup and Voice Allowlist Fix

Port Telegram bot-message @ts-nocheck removal and anonymous voice caller allowlist regression test.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | SYNC-004: Remove @ts-nocheck from bot-message.ts | 2e57ea828 | src/telegram/bot-message.js, src/telegram/bot-message-context.js |
| 2 | SYNC-005: Cover anonymous voice allowlist callers | b9317b50b | extensions/voice-call/src/manager.test.js |

## Changes Made

### Task 1: Telegram bot-message type cleanup (SYNC-004)

Upstream commit `90b4e5435` removed `@ts-nocheck` from `bot-message.ts` by:
- Exporting `TelegramMediaRef` and `BuildTelegramMessageContextParams` types from `bot-message-context.ts`
- Creating `TelegramMessageProcessorDeps` type using `Omit<BuildTelegramMessageContextParams, ...>` pattern
- Adding type annotations to function parameters

JavaScript equivalent:
- Added JSDoc `@typedef` blocks for `TelegramMediaRef` and `BuildTelegramMessageContextParams` in `bot-message-context.js`
- Added JSDoc `@typedef` for `TelegramMessageProcessorDeps` using `Omit` pattern in `bot-message.js`
- Added `@param` annotation on `createTelegramMessageProcessor`

### Task 2: Anonymous voice caller allowlist test (SYNC-005)

Upstream commit `0cd47d830` added a regression test ensuring anonymous inbound callers
(caller ID = "anonymous") are rejected when allowlist policy is enabled. The test verifies
that `normalizePhoneNumber("anonymous")` strips all non-digit characters to produce an
empty string, which `_shouldAcceptInbound` treats as missing caller ID.

Added matching test to `extensions/voice-call/src/manager.test.js` (6 tests total, all passing).

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

- Pre-existing changes to bot-message.js and bot-message-context.js were verified correct and committed as-is (they matched the upstream intent exactly).

## Verification

- `npx vitest run extensions/voice-call/src/manager.test.js` -- 6 tests passing
- `npx oxlint src/telegram/bot-message.js src/telegram/bot-message-context.js` -- 0 warnings, 0 errors
- Both commits created with correct upstream-matching messages

## Metrics

- Duration: ~5 minutes
- Completed: 2026-02-05
- Commits: 2/2
