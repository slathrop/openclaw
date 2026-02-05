---
phase: 04-cli-and-channels
plan: 03
subsystem: channels
tags: [esbuild, jsdoc, typedef, channel-plugins, signal, imessage, feishu, line, whatsapp, security]

# Dependency graph
requires:
  - phase: 04-02
    provides: "Discord and Slack channel conversions; established esbuild bulk conversion pattern without keepNames"
  - phase: 03-core-services
    provides: "Core services JS that channels import (agents, auto-reply, config, routing)"
provides:
  - "275 channel files converted to JavaScript (signal, imessage, feishu, line, web, channels, test-utils)"
  - "Channel plugin type system as JSDoc @typedef modules (~790 lines manual conversion)"
  - "SECURITY annotations on 5 auth/access-control files"
  - "34 LINE JSDoc @typedef blocks from 29+ interface declarations"
  - "Private field handling for iMessage, Feishu classes"
affects: [05-remaining-modules, 06-final-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-only .ts barrel with runtime re-export -> JSDoc @typedef + preserved export"
    - "Named function declarations for constructor mocks (formatter converts arrow back)"
    - "esbuild arrow function conversion breaks `new` calls; use named function declarations"

key-files:
  created:
    - "src/channels/plugins/types.core.js (34 JSDoc @typedef blocks)"
    - "src/channels/plugins/types.adapters.js (24 JSDoc @typedef blocks)"
    - "src/channels/plugins/types.plugin.js (3 JSDoc @typedef blocks)"
    - "src/channels/plugins/types.js (barrel with runtime re-export)"
    - "src/channels/plugins/onboarding-types.js (8 JSDoc @typedef blocks)"
    - "src/line/types.js (12 JSDoc @typedef blocks)"
    - "src/web/auto-reply/types.js (2 JSDoc @typedef blocks)"
    - "src/web/inbound/types.js (2 JSDoc @typedef blocks)"
    - "convert-channels-batch2.mjs (Task 1 conversion script)"
    - "convert-channels-batch3.mjs (Task 2 conversion script)"
  modified:
    - "src/imessage/client.js (12 private fields + 2 methods underscore-prefixed)"
    - "src/imessage/monitor/monitor-provider.js (3 private members underscore-prefixed)"
    - "src/feishu/streaming-card.js (5 private fields underscore-prefixed)"
    - "src/web/auth-store.js (SECURITY annotation)"
    - "src/channels/plugins/pairing.js (SECURITY annotation)"
    - "src/channels/command-gating.js (SECURITY annotation)"
    - "src/channels/allowlist-match.js (SECURITY annotation)"
    - "src/channels/mention-gating.js (SECURITY annotation)"

key-decisions:
  - "Named function declarations for vi.fn constructor mocks (oxfmt converts anonymous function expressions to arrows, breaking `new`)"
  - "onboarding-types.js converted to full JSDoc @typedef (8 types) alongside the 4 planned plugin type files"
  - "web/auto-reply/types.js and web/inbound/types.js also needed manual JSDoc conversion (empty from esbuild)"
  - "CHANNEL_MESSAGE_ACTION_NAMES runtime re-export preserved in types.js barrel"
  - "qr-image.test.js hardcoded .ts path updated to .js"

patterns-established:
  - "Constructor mock pattern: Use named function declarations (not anonymous function expressions) to survive oxfmt formatting"
  - "Type barrel with runtime re-export: JSDoc @typedef for type re-exports + export { X } from for runtime values"

# Metrics
duration: 26min
completed: 2026-02-05
---

# Phase 4 Plan 3: Channel Layer Conversion Summary

**275 channel files (signal, imessage, feishu, line, web, channels, test-utils) converted to JavaScript with 69+ JSDoc @typedef blocks, private field handling, and SECURITY annotations on 5 auth files**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-02-05T17:07:51Z
- **Completed:** 2026-02-05T17:33:33Z
- **Tasks:** 2
- **Files modified:** 518 (177 Task 1 + 341 Task 2)

## Accomplishments

- Converted 275 TypeScript files across 7 directories to JavaScript
- Manually created 69+ JSDoc @typedef blocks for type-only files (plugin types, LINE types, onboarding types, web types)
- Handled private fields in 3 classes: IMessageRpcClient (12 fields + 2 methods), SentMessageCache (3 members), FeishuStreamingSession (5 fields)
- Added SECURITY annotations to 5 auth/access-control files
- Preserved CHANNEL_MESSAGE_ACTION_NAMES runtime re-export in types.js barrel
- All 88 test files pass with 522 tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert signal, imessage, feishu, line, and test-utils** - `ee3a0daa` (feat)
2. **Fix: Named function for constructor mock** - `45210a79` (fix)
3. **Task 2: Convert web and channels** - `f0171930` (feat)

## Files Created/Modified

### Type-Heavy Manual Conversions (69+ @typedef blocks)
- `src/channels/plugins/types.core.js` - 34 JSDoc @typedef (ChannelId, ChannelMeta, ChannelCapabilities, ChannelAccountSnapshot, etc.)
- `src/channels/plugins/types.adapters.js` - 24 JSDoc @typedef (ChannelConfigAdapter, ChannelOutboundAdapter, ChannelGatewayAdapter, etc.)
- `src/channels/plugins/types.plugin.js` - 3 JSDoc @typedef (ChannelPlugin, ChannelConfigUiHint, ChannelConfigSchema)
- `src/channels/plugins/types.js` - Barrel with runtime `export { CHANNEL_MESSAGE_ACTION_NAMES }`
- `src/channels/plugins/onboarding-types.js` - 8 JSDoc @typedef (SetupChannelsOptions, ChannelOnboardingAdapter, etc.)
- `src/line/types.js` - 12 JSDoc @typedef (LineConfig, ResolvedLineAccount, LineWebhookContext, etc.)
- `src/web/auto-reply/types.js` - 2 JSDoc @typedef (WebChannelStatus, WebMonitorTuning)
- `src/web/inbound/types.js` - 2 JSDoc @typedef (WebListenerCloseReason, WebInboundMessage)

### Private Field Conversions
- `src/imessage/client.js` - IMessageRpcClient: 12 fields (cliPath, dbPath, runtime, onNotification, pending, closed, closedResolve, child, reader, nextId) + 2 methods (handleLine, failAll)
- `src/imessage/monitor/monitor-provider.js` - SentMessageCache: cache, ttlMs, cleanup
- `src/feishu/streaming-card.js` - FeishuStreamingSession: client, credentials, state, updateQueue, closed

### LINE JSDoc @typedef (34 total across files)
- `src/line/types.js` (12), `src/line/rich-menu.js` (4), `src/line/markdown-to-line.js` (4), `src/line/bot.js` (2), `src/line/bot-handlers.js` (2), `src/line/flex-templates.js` (2), `src/line/webhook.js` (2), `src/line/monitor.js` (2), `src/line/bot-message-context.js` (2), `src/line/download.js` (1), `src/line/send.js` (1)

### Security Annotations
- `src/web/auth-store.js` - WhatsApp Web credential storage
- `src/channels/plugins/pairing.js` - Channel pairing approval
- `src/channels/command-gating.js` - Command authorization
- `src/channels/allowlist-match.js` - Allowlist enforcement
- `src/channels/mention-gating.js` - Mention gating

### Conversion Scripts
- `convert-channels-batch2.mjs` - Task 1 bulk conversion (signal, imessage, feishu, line)
- `convert-channels-batch3.mjs` - Task 2 bulk conversion (web, channels, excluding 4 manual files)

## Decisions Made

1. **Named function declarations for constructor mocks**: The formatter (oxfmt) converts anonymous `function()` expressions to arrow functions, which breaks `new` invocations. Using named `function MockClient()` declarations survives formatting. Discovered in probe.test.js.

2. **onboarding-types.js manual conversion**: Not in original plan but discovered as an empty esbuild output from a type-only file. Required manual JSDoc conversion (8 @typedef blocks). [Rule 2 - Missing Critical]

3. **web/auto-reply/types.js and web/inbound/types.js**: Also empty from esbuild, required manual JSDoc conversion. [Rule 2 - Missing Critical]

4. **qr-image.test.js path fix**: Test had hardcoded `src/web/qr-image.ts` path in a `readFile` call. Updated to `.js`. [Rule 1 - Bug]

5. **CHANNEL_MESSAGE_ACTION_NAMES from message-action-names.js**: Verified this is a runtime value (not in types.core.ts). The barrel types.js correctly re-exports it from message-action-names.js.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Arrow function constructor mock in probe.test.js**
- **Found during:** Task 1
- **Issue:** esbuild converted `vi.fn(function() {...})` to `vi.fn(() => {...})`. Arrow functions cannot be used with `new`.
- **Fix:** Used named function declaration `function MockClient() {...}` which survives oxfmt reformatting.
- **Files modified:** src/line/probe.test.js
- **Verification:** Test passes (2/2)
- **Committed in:** 45210a79

**2. [Rule 2 - Missing Critical] onboarding-types.js JSDoc conversion**
- **Found during:** Task 2
- **Issue:** esbuild produced empty file from type-only onboarding-types.ts (8 type definitions)
- **Fix:** Manually created JSDoc @typedef module with all 8 types
- **Files modified:** src/channels/plugins/onboarding-types.js
- **Verification:** ESLint passes, imports resolve
- **Committed in:** f0171930 (part of Task 2)

**3. [Rule 2 - Missing Critical] web type files JSDoc conversion**
- **Found during:** Task 2
- **Issue:** web/auto-reply/types.js and web/inbound/types.js were empty from esbuild
- **Fix:** Manually created JSDoc @typedef modules
- **Files modified:** src/web/auto-reply/types.js, src/web/inbound/types.js
- **Verification:** ESLint passes
- **Committed in:** f0171930 (part of Task 2)

**4. [Rule 1 - Bug] qr-image.test.js hardcoded .ts path**
- **Found during:** Task 2
- **Issue:** Test had `resolve(process.cwd(), 'src/web/qr-image.ts')` reading the source file
- **Fix:** Updated to `'src/web/qr-image.js'`
- **Files modified:** src/web/qr-image.test.js
- **Verification:** Test passes (2/2)
- **Committed in:** f0171930 (part of Task 2)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. Plan specified QUAL-03 lodash scan but no opportunities found in channels code.

## Issues Encountered

- oxfmt reformats anonymous function expressions to arrow functions, which breaks constructor mock patterns. Resolved by using named function declarations that the formatter preserves.
- Pre-commit hook ran eslint --fix on entire project during commits, which could reformat manually placed code. All manual edits survived.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 (CLI and Channels) is now complete: all 3 plans executed
- All 7 target directories fully converted to JavaScript
- Ready for Phase 5 (Remaining Modules) or Phase verification
- No blockers or concerns

---
*Phase: 04-cli-and-channels*
*Completed: 2026-02-05*
