# Phase 9: Threading + Features - Research

**Researched:** 2026-02-06
**Domain:** Upstream commit syncing (Telegram threading completion, Claude Opus 4.6, Feishu expansion, cron fixes, runtime updates, compaction fixes)
**Confidence:** HIGH

## Summary

Phase 9 ports 21 upstream commits (SYNC-043 to SYNC-063) from the TypeScript repository to this JavaScript codebase. The commits span seven domains: (1) Telegram threading completion (tests + subagent threadId forwarding + parseTelegramTarget auto-threading), (2) Claude Opus 4.6 model catalog update (touching 16+ files), (3) Feishu channel expansion (5 new files: docs, reactions, typing, user + extensive message.ts changes), (4) cron scheduling and delivery inference fixes, (5) compaction bug fixes (orphaned tool_results, multiple retry attempts, billing errors), (6) runtime/CLI updates (Node.js 22.12.0 minimum, NODE_OPTIONS fix), and (7) a large workspace update commit (SYNC-060) that touches 72 files including model allowlist normalization.

The most technically complex work is SYNC-050 (Feishu expansion, 1,517 additions across 17 files including 5 new TypeScript files needing JS conversion) and SYNC-060 (workspace updates, 72 files with new model allowlist infrastructure and OpenAI model defaults). SYNC-056/063 form an add/revert pair for QR code skill that can be applied mechanically. Several commits are docs-only or trivial chore changes.

**Primary recommendation:** Group commits into 5-6 plans by domain similarity. The Telegram threading trio (043-045) is a natural group. The Opus 4.6 commit (049) plus the workspace update (060) should be in the same plan since 060 builds on 049's changes. The Feishu pair (050-051) forms its own plan. The cron/compaction/runtime fixes (052-053, 058-059, 061-062) can be batched. The trivial commits (046, 047, 054-057) can be grouped together. The QR code add+revert (056, 063) should be in the same plan.

## Standard Stack

No new libraries needed. This phase applies changes to existing JavaScript code.

### Core (already in use)
| Library | Version | Purpose | Role in Phase 9 |
|---------|---------|---------|-----------------|
| `vitest` | ^4.0.18 | Test runner | Validates each commit; new test files for threading, compaction, cron, billing |
| `eslint` | ^9.39.2 | Linter | Ensures style compliance |
| `rolldown` | 1.0.0-rc.2 | Bundler | Builds after changes |
| `@mariozechner/pi-*` | 0.51.6 -> 0.52.0 | AI runtime | SYNC-049 bumps to 0.52.0 |

### Relevant Code Areas
| Module | Files | Relevant Commits |
|--------|-------|------------------|
| `src/infra/outbound/` | message-action-runner.js, *.threading.test.js | SYNC-043, SYNC-045 |
| `src/agents/tools/` | sessions-spawn-tool.js, cron-tool.js + tests | SYNC-043, SYNC-044, SYNC-053 |
| `src/agents/` | subagent-announce.format.test.js, compaction.js + test, pi-embedded-helpers/, pi-embedded-runner/run.js | SYNC-043, SYNC-052, SYNC-061, SYNC-062 |
| `src/commands/agent/` | run-context.js | SYNC-044 |
| `src/feishu/` | docs.js (NEW), docs.test.js (NEW), reactions.js (NEW), typing.js (NEW), user.js (NEW), message.js, download.js, send.js, monitor.js, probe.js | SYNC-050, SYNC-051 |
| `src/agents/` | defaults.js, cli-backends.js, live-model-filter.js, model-selection.js + test | SYNC-049, SYNC-060 |
| `src/config/` | defaults.js, model-alias-defaults.test.js | SYNC-049, SYNC-060 |
| `src/commands/` | configure.gateway-auth.js, model-picker.js, onboard-auth.*, model-allowlist.js (NEW), openai-model-default.js (NEW) + tests | SYNC-049, SYNC-060 |
| `src/entry.js` | Entry point respawn logic | SYNC-048 |
| `src/infra/` | runtime-guard.js + test | SYNC-058 |
| `src/daemon/` | runtime-paths.test.js | SYNC-058 |
| `src/auto-reply/reply/` | session.js | SYNC-059 |
| `src/cron/service/` | timer.js | SYNC-053 |
| Root | .gitignore, CONTRIBUTING.md, AGENTS.md, CHANGELOG.md, package.json, pnpm-lock.yaml | SYNC-046, 054, 057, various |
| `docs/` | providers/ollama.md, zh-CN/providers/ollama.md, channels/feishu.md, zh-CN/channels/feishu.md, many others | SYNC-047, SYNC-050, SYNC-060 |
| `skills/` | qr-code/ (NEW then REVERTED) | SYNC-056, SYNC-063 |
| `.github/` | ISSUE_TEMPLATE/config.yml | SYNC-055 |

## Architecture Patterns

### Pattern 1: 1:1 Commit Parity Workflow
**What:** Each upstream commit becomes exactly one commit in this repo
**When to use:** Every commit in this phase
**Example:**
```bash
# For SYNC-043: test: cover telegram topic threadId auto-injection
# 1. Read upstream diff
git diff 6ac5dd2c0^..6ac5dd2c0

# 2. Apply equivalent change in JavaScript
# (convert .ts to .js, strip types, add JSDoc where helpful)

# 3. Run targeted tests then full suite
pnpm vitest run src/infra/outbound/message-action-runner.threading.test.js
pnpm test

# 4. Commit with matching message
scripts/committer "test: cover telegram topic threadId auto-injection" src/...
```

### Pattern 2: Telegram Threading Completion (SYNC-043 to SYNC-045)
**What:** Complete the Telegram auto-threading feature started in Phase 8
**When to use:** First three commits of this phase

**Key flow:**
1. SYNC-043 adds test coverage: new test file `sessions-spawn-threadid.test.js` (renamed from long name), expands `subagent-announce.format.test.js` with threadId tests, extends `message-action-runner.threading.test.js` with Telegram-specific tests, and modifies `message-action-runner.js` to simplify (removes parseTelegramTarget, uses string matching)
2. SYNC-044 passes threadId/to/accountId from parent to subagent gateway call in `sessions-spawn-tool.js` and populates `currentChannelId` from `opts.to` in `run-context.js`
3. SYNC-045 is the PR merge that restores parseTelegramTarget usage, renames test file, adds more test cases (chat mismatch, prefix variations), and refines variable naming

**Important nuance:** SYNC-043 REMOVES parseTelegramTarget usage (uses string matching instead), then SYNC-045 RESTORES it. Apply commits in exact order -- do not skip ahead.

### Pattern 3: New TypeScript File Conversion (SYNC-050 Feishu)
**What:** Convert 5 new TypeScript files to JavaScript for Feishu expansion
**When to use:** SYNC-050 creates docs.ts, docs.test.ts, reactions.ts, typing.ts, user.ts
**Key details:**
- Use esbuild transformSync to strip types (established v1 pattern)
- Fix import paths: `.js` extensions already in upstream `.ts` files (so imports work)
- Convert TypeScript type annotations to JSDoc where they aid comprehension
- New files: `src/feishu/docs.js`, `src/feishu/docs.test.js`, `src/feishu/reactions.js`, `src/feishu/typing.js`, `src/feishu/user.js`
- Existing files modified: `message.js`, `download.js`, `send.js`, `monitor.js`, `probe.js`
- Also updates docs, README (clawtributors), CHANGELOG

### Pattern 4: Large Workspace Update (SYNC-060)
**What:** A squash commit with 72 file changes covering model allowlist normalization, OpenAI model defaults, docs model name updates, and pi-ai bump aftermath
**When to use:** SYNC-060
**Key details:**
- Creates 5 NEW files: `model-allowlist.ts`, `openai-model-default.ts` + test, `auth-choice.default-model.test.ts`, `onboard-non-interactive.openai-api-key.test.ts`
- Modifies 40+ source files (model references, auth choices, image tools, thinking, etc.)
- Updates 20+ docs files (model name references claude-opus-4-5 -> claude-opus-4-6)
- Updates package.json (pi deps bump already done in 049) and pnpm-lock.yaml
- Swift/macOS files need to be copied as-is (not JS conversion)
- Some changes overlap with SYNC-049 (which already updated defaults.ts, model-selection.ts, etc.)
- The planner MUST carefully check which SYNC-049 changes get overwritten/extended by SYNC-060

### Pattern 5: Add-Then-Revert Pair (SYNC-056 + SYNC-063)
**What:** QR code skill is added then immediately reverted
**When to use:** SYNC-056 and SYNC-063
**Key details:**
- SYNC-056 adds `skills/qr-code/` directory with SKILL.md, qr_generate.py, qr_read.py
- SYNC-056 also changes CLAUDE.md symlink (trailing newline fix)
- SYNC-063 reverts exactly those changes
- Both commits must be applied in order for 1:1 parity
- No JS conversion needed (Python scripts + Markdown)

### Pattern 6: Compaction and Runner Fixes (SYNC-052, SYNC-061, SYNC-062)
**What:** Fix compaction to handle orphaned tool_results, allow multiple retries, and show billing errors
**When to use:** SYNC-052, SYNC-061, SYNC-062
**Key details:**
- SYNC-052: imports `repairToolUseResultPairing` from `session-transcript-repair.js` into `compaction.js`, adds 3 test cases
- SYNC-061: changes `overflowCompactionAttempted` boolean to a counter (max 3 attempts), updates tests, adds diagnostic logging
- SYNC-062: adds `BILLING_ERROR_USER_MESSAGE` constant, `isBillingAssistantError` detection, 3 new tests
- All three modify the `pi-embedded-runner/run.js` or related test files
- The billing error mock (`isBillingAssistantError: vi.fn(() => false)`) in SYNC-061's test was added because SYNC-062 adds the function -- but SYNC-061 comes first chronologically. Apply in order.

### Anti-Patterns to Avoid
- **Batching commits:** Each upstream commit must be one local commit. Never squash.
- **Skipping the SYNC-043/045 parseTelegramTarget flip:** 043 removes it, 045 restores it. Both must be applied.
- **Conflating SYNC-049 and SYNC-060:** 060 builds on 049 but touches many more files. Don't merge them.
- **Missing new test files:** SYNC-043 creates a new test file; SYNC-052, 053, 060 add new test files.
- **Ignoring pnpm-lock.yaml in SYNC-049:** The pi-ai bump from 0.51.6 to 0.52.0 changes the lockfile significantly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram chat ID parsing | Custom string manipulation | `parseTelegramTarget()` from `src/telegram/targets.js` | Handles format variations (telegram:group:123:topic:456 vs telegram:123) |
| Tool_result orphan cleanup | Custom orphan detection | `repairToolUseResultPairing()` from `session-transcript-repair.js` | Battle-tested pairing logic already exists |
| Billing error detection | Custom regex | `isBillingErrorMessage()` from `pi-embedded-helpers/errors.js` | Handles multiple billing error patterns |
| Session key parsing | Custom split logic | `parseAgentSessionKey()` from `sessions/session-key-utils.js` | Used by cron delivery inference |
| Model ID normalization | Manual mappings | `normalizeAnthropicModelId()` in `model-selection.js` | Already handles opus-4.5, opus-4.6, etc. |

**Key insight:** Most of the "new" code in this phase is upstream-authored TypeScript that needs mechanical JS conversion. The logic itself is copied from upstream -- the work is in the translation, not the design.

## Common Pitfalls

### Pitfall 1: SYNC-043 and SYNC-045 parseTelegramTarget Oscillation
**What goes wrong:** Applying SYNC-045 diff fails because SYNC-043 already changed the same lines differently
**Why it happens:** SYNC-043 removes `parseTelegramTarget` import and replaces with string matching. SYNC-045 (the PR merge) restores `parseTelegramTarget` with an improved implementation.
**How to avoid:** Apply SYNC-043 exactly as the upstream diff shows (remove parseTelegramTarget, use string matching). Then apply SYNC-045 which restores it. Don't try to skip ahead.
**Warning signs:** Import conflicts, test failures about unresolved imports

### Pitfall 2: SYNC-049 + SYNC-060 Model Reference Overlap
**What goes wrong:** SYNC-060 changes files that SYNC-049 already modified (defaults.ts, model-selection.ts, image-tool.ts/test, model-alias-defaults.test.ts)
**Why it happens:** SYNC-060 is a large workspace update that includes model rename aftermath. Some of SYNC-049's changes are extended or slightly modified.
**How to avoid:** Apply SYNC-049 first (with its pi deps bump), then apply SYNC-060's diff on top. Check for double-application of claude-opus-4-5 -> claude-opus-4-6 renames.
**Warning signs:** Duplicate model entries, tests expecting wrong model IDs

### Pitfall 3: SYNC-050 Feishu File Count
**What goes wrong:** Missing one of the 5 new Feishu files or forgetting to update one of the 12 existing files
**Why it happens:** SYNC-050 touches 17 files total: 5 new TS files, 7 existing TS/MD files, CHANGELOG, README, docs, clawtributors
**How to avoid:** Use the upstream stat to verify all files are accounted for. Convert new .ts files to .js with esbuild.
**Warning signs:** Test failures in new feishu/docs.test.js, missing exports

### Pitfall 4: pnpm-lock.yaml Drift
**What goes wrong:** pnpm-lock.yaml changes from SYNC-049 and SYNC-060 don't match local state
**Why it happens:** The JS repo has different dependency versions than upstream; lock file changes may not apply cleanly
**How to avoid:** After applying package.json changes, run `pnpm install` to regenerate the lockfile rather than trying to patch it. Only commit the resulting lockfile.
**Warning signs:** `pnpm install` errors, dependency resolution failures

### Pitfall 5: SYNC-061 Test Mock Includes isBillingAssistantError
**What goes wrong:** SYNC-061's test diff adds `isBillingAssistantError: vi.fn(() => false)` to the mock, but SYNC-062 (which adds the function) hasn't been applied yet
**Why it happens:** Upstream committed them in this order; the mock was added preemptively
**How to avoid:** Apply exactly as upstream diff shows. The mock will reference a function that doesn't exist yet in the source, but vitest mocks don't validate the real module at mock definition time.
**Warning signs:** None -- this should work fine. Just note it for understanding.

### Pitfall 6: SYNC-060 Creates New TypeScript Files
**What goes wrong:** The 5 new source files in SYNC-060 are .ts and need JS conversion
**Why it happens:** New files: model-allowlist.ts, openai-model-default.ts + test, auth-choice.default-model.test.ts, onboard-non-interactive.openai-api-key.test.ts
**How to avoid:** Convert each new .ts file to .js using esbuild transformSync (v1 pattern). Strip type annotations, add JSDoc where helpful.
**Warning signs:** Build failures, import resolution errors

### Pitfall 7: Cron Timer .unref() Removal
**What goes wrong:** Missing the single-line change in SYNC-053 that removes `.unref()` from the cron timer
**Why it happens:** It's buried in a large commit with 191 additions. The actual production fix is just removing one line from `src/cron/service/timer.js`.
**How to avoid:** Verify the `timer.js` change is applied: remove `state.timer.unref?.();`
**Warning signs:** Cron jobs not firing in some environments

## Commit Analysis

| SYNC | Type | Files | Complexity | Notes |
|------|------|-------|------------|-------|
| 043 | Test+Fix | 4 (1 new test, 2 modified tests, 1 src) | MEDIUM | New test file + message-action-runner changes; removes parseTelegramTarget |
| 044 | Fix | 2 (sessions-spawn-tool, run-context) | LOW | Small additions: 4+9 lines |
| 045 | Fix | 4 (CHANGELOG, rename test, 2 src) | MEDIUM | PR merge: restores parseTelegramTarget, adds test cases |
| 046 | Chore | 1 (CONTRIBUTING.md) | LOW | Add contributor handle |
| 047 | Docs | 2 (ollama docs en+zh-CN) | LOW | Fix typo: fallback -> fallbacks |
| 048 | Fix | 2 (CHANGELOG, src/entry.js) | MEDIUM | Rewrite respawn logic: NODE_OPTIONS -> CLI flag |
| 049 | Feat | 16 (+ pnpm-lock) | HIGH | Claude Opus 4.6: model defaults, aliases, tests, pi bump 0.51.6->0.52.0 |
| 050 | Feat | 17 (5 new TS files) | HIGH | Feishu expansion: docs, reactions, typing, user, message overhaul |
| 051 | Fix | 1 (feishu/message.js) | LOW | One-line change: tighten mention gating |
| 052 | Fix | 3 (compaction.js+test, CHANGELOG) | MEDIUM | Import repairToolUseResultPairing, add 3 test cases |
| 053 | Fix | 4 (cron-tool.js+test, timer.js, CHANGELOG) | HIGH | 97-line delivery inference function + 93 lines of tests + timer.unref removal |
| 054 | Chore | 1 (.gitignore) | LOW | Add agent credential patterns |
| 055 | Docs | 1 (.github/ISSUE_TEMPLATE/config.yml) | LOW | Escape hash symbols |
| 056 | Feat | 4 (skills/qr-code/* NEW, CLAUDE.md) | LOW | Add QR skill (will be reverted by 063) |
| 057 | Chore | 1 (AGENTS.md) | LOW | Add tsgo command |
| 058 | Fix | 3 (runtime-guard.js+test, runtime-paths.test.js) | LOW | Bump MIN_NODE 22.0.0 -> 22.12.0, update tests |
| 059 | Fix | 1 (auto-reply/reply/session.js) | LOW | Clear stale token metrics + add diagnostic logging |
| 060 | Chore | 72 (5 new TS files) | HIGH | Workspace update: model allowlist, OpenAI defaults, docs, deps |
| 061 | Fix | 2 (run.js, run.overflow-compaction.test.js) | MEDIUM | Boolean -> counter (max 3), update tests |
| 062 | Fix | 4 (errors.js, run.js, helpers.js, test) | MEDIUM | Billing error detection + user-facing message |
| 063 | Revert | 4 (revert of 056) | LOW | Mechanical revert |

### Complexity Distribution
- LOW: 10 commits (044, 046, 047, 051, 054, 055, 056, 057, 058, 059, 063)
- MEDIUM: 6 commits (043, 045, 048, 052, 061, 062)
- HIGH: 4 commits (049, 050, 053, 060)

### Suggested Plan Groupings

**Plan 1 (Wave 1): Telegram threading completion (SYNC-043 to SYNC-045)** - 3 commits
- SYNC-043: Test coverage for threadId auto-injection (new test file + expanded tests + message-action-runner change)
- SYNC-044: Pass threadId/to/accountId from parent to subagent (sessions-spawn-tool + run-context)
- SYNC-045: PR merge - restore parseTelegramTarget, rename test, add edge case tests

**Plan 2 (Wave 1): Chores + docs + CLI fix (SYNC-046 to SYNC-048)** - 3 commits
- SYNC-046: Update CONTRIBUTING.md handle (trivial)
- SYNC-047: Fix model.fallback -> model.fallbacks in Ollama docs (docs-only)
- SYNC-048: Avoid NODE_OPTIONS for --disable-warning (entry.js rewrite)

**Plan 3 (Wave 2): Claude Opus 4.6 + Feishu expansion (SYNC-049 to SYNC-051)** - 3 commits
- SYNC-049: Claude Opus 4.6 to model catalog (16 files + pi deps bump)
- SYNC-050: Feishu expand channel support (17 files, 5 new)
- SYNC-051: Feishu tighten mention gating (1-line fix)

**Plan 4 (Wave 2): Compaction + cron + trivial chores (SYNC-052 to SYNC-057)** - 6 commits
- SYNC-052: Remove orphaned tool_results during compaction (compaction.js + tests)
- SYNC-053: Fix cron scheduling and delivery inference (cron-tool + timer)
- SYNC-054: Add agent credentials to .gitignore
- SYNC-055: Escape hash in issue template
- SYNC-056: Add QR code skill (will be reverted later)
- SYNC-057: Add tsgo command to AGENTS.md

**Plan 5 (Wave 3): Runtime + session + workspace updates (SYNC-058 to SYNC-060)** - 3 commits
- SYNC-058: Bump minimum Node.js to 22.12.0 (runtime-guard + tests)
- SYNC-059: Clear stale token metrics on /new and /reset (session.js)
- SYNC-060: Apply local workspace updates (72 files -- model allowlist, OpenAI defaults, docs)

**Plan 6 (Wave 3): Compaction retries + billing + QR revert (SYNC-061 to SYNC-063)** - 3 commits
- SYNC-061: Allow multiple compaction retries (run.js + overflow test)
- SYNC-062: Show clear billing error (errors.js + run.js + test)
- SYNC-063: Revert QR code skill (exact revert of SYNC-056)

## Code Examples

### Telegram Auto-Threading with parseTelegramTarget (SYNC-045 final state)
```javascript
// In src/infra/outbound/message-action-runner.js
import {parseTelegramTarget} from '../../telegram/targets.js'

function resolveTelegramAutoThreadId(params) {
  const {to, toolContext: context} = params
  if (!context?.currentThreadTs || !context.currentChannelId) {
    return undefined
  }
  // Use parseTelegramTarget to extract canonical chatId from both sides
  const parsedTo = parseTelegramTarget(to)
  const parsedChannel = parseTelegramTarget(context.currentChannelId)
  if (parsedTo.chatId.toLowerCase() !== parsedChannel.chatId.toLowerCase()) {
    return undefined
  }
  return context.currentThreadTs
}
```

### Subagent threadId Forwarding (SYNC-044)
```javascript
// In src/agents/tools/sessions-spawn-tool.js -- add to callGateway params:
{
  message: task,
  sessionKey: childSessionKey,
  channel: requesterOrigin?.channel,
  to: requesterOrigin?.to ?? undefined,
  accountId: requesterOrigin?.accountId ?? undefined,
  threadId: requesterOrigin?.threadId != null
    ? String(requesterOrigin.threadId)
    : undefined,
  // ...
}

// In src/commands/agent/run-context.js -- add fallback for currentChannelId:
if (!merged.currentChannelId && opts.to) {
  const trimmedTo = opts.to.trim()
  if (trimmedTo) {
    merged.currentChannelId = trimmedTo
  }
}
```

### Entry Point Respawn Fix (SYNC-048)
```javascript
// In src/entry.js -- change from NODE_OPTIONS to CLI flag:
// BEFORE: process.env.NODE_OPTIONS = `${nodeOptions} ${EXPERIMENTAL_WARNING_FLAG}`
// AFTER: pass flag directly to node executable
const child = spawn(
  process.execPath,
  [EXPERIMENTAL_WARNING_FLAG, ...process.execArgv, ...process.argv.slice(1)],
  {stdio: 'inherit', env: process.env}
)
```

### Cron Delivery Inference (SYNC-053)
```javascript
// New function in src/agents/tools/cron-tool.js
function inferDeliveryFromSessionKey(agentSessionKey) {
  const rawSessionKey = agentSessionKey?.trim()
  if (!rawSessionKey) return null
  const parsed = parseAgentSessionKey(
    stripThreadSuffixFromSessionKey(rawSessionKey)
  )
  if (!parsed || !parsed.rest) return null
  // Parse peer from session key parts (dm:, group:, channel:)
  // Returns {mode: 'announce', channel, to} or null
}
```

### Compaction Orphan Repair (SYNC-052)
```javascript
// In src/agents/compaction.js
import {repairToolUseResultPairing} from './session-transcript-repair.js'

// After dropping a chunk:
const flatRest = rest.flat()
const repairReport = repairToolUseResultPairing(flatRest)
const repairedKept = repairReport.messages
const orphanedCount = repairReport.droppedOrphanCount
droppedMessages += dropped.length + orphanedCount
keptMessages = repairedKept
```

### Billing Error Detection (SYNC-062)
```javascript
// In src/agents/pi-embedded-helpers/errors.js
export const BILLING_ERROR_USER_MESSAGE =
  'API provider returned a billing error -- your API key has run out of ' +
  'credits or has an insufficient balance. Check your provider\'s billing ' +
  'dashboard and top up or switch to a different API key.'

// In formatAssistantErrorText, before the generic HTTP/JSON fallthrough:
if (isBillingErrorMessage(raw)) {
  return BILLING_ERROR_USER_MESSAGE
}
```

## Testing Strategy

### Per-Commit Verification
```bash
# After each commit:
pnpm test                    # Full test suite
pnpm check                   # Lint check
git status                   # Verify clean tree
```

### New Test Files
- `src/agents/sessions-spawn-threadid.test.js` - Created by SYNC-043 (long name), renamed by SYNC-045
- `src/feishu/docs.test.js` - Created by SYNC-050
- `src/commands/auth-choice.default-model.test.js` - Created by SYNC-060
- `src/commands/openai-model-default.test.js` - Created by SYNC-060
- `src/commands/onboard-non-interactive.openai-api-key.test.js` - Created by SYNC-060

### Targeted Test Commands
```bash
# Telegram threading
pnpm vitest run src/infra/outbound/message-action-runner.threading.test.js
pnpm vitest run src/agents/subagent-announce.format.test.js
pnpm vitest run src/agents/sessions-spawn-threadid.test.js

# Feishu
pnpm vitest run src/feishu/docs.test.js

# Compaction
pnpm vitest run src/agents/compaction.test.js

# Cron
pnpm vitest run src/agents/tools/cron-tool.test.js

# Runtime guard
pnpm vitest run src/infra/runtime-guard.test.js
pnpm vitest run src/daemon/runtime-paths.test.js

# Model selection
pnpm vitest run src/config/model-alias-defaults.test.js
pnpm vitest run src/agents/model-selection.test.js
pnpm vitest run src/agents/tools/image-tool.test.js

# Billing error
pnpm vitest run src/agents/pi-embedded-helpers.formatassistanterrortext.test.js

# Overflow compaction
pnpm vitest run src/agents/pi-embedded-runner/run.overflow-compaction.test.js
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegram auto-thread uses string matching | Uses parseTelegramTarget for canonical chatId comparison | SYNC-043->045 | Handles format variations correctly |
| Subagent loses parent threadId | threadId/to/accountId forwarded to subagent gateway call | SYNC-044 | Subagent messages land in correct forum topic |
| Default model claude-opus-4-5 | Default model claude-opus-4-6 | SYNC-049 | New model available across all selection surfaces |
| Feishu: basic message support | Full channel: posts, docs, reactions, typing, user lookup | SYNC-050 | Feishu parity with other channels |
| Orphaned tool_results cause API errors | repairToolUseResultPairing called after chunk drops | SYNC-052 | Sessions survive aborted tool calls |
| Single compaction retry on overflow | Up to 3 compaction attempts before failure | SYNC-061 | Long agentic turns with many tools can recover |
| Cryptic billing errors | User-friendly billing error message | SYNC-062 | Clear actionable guidance for users |
| NODE_OPTIONS for --disable-warning | CLI flag passed directly to node executable | SYNC-048 | Fixes npm pack on modern Node |
| Node.js >= 22.0.0 minimum | Node.js >= 22.12.0 minimum | SYNC-058 | Aligns with Matrix plugin requirements |
| Cron timer uses .unref() | Timer without .unref() | SYNC-053 | Prevents process exit when only cron is active |

## Open Questions

1. **SYNC-049 pnpm-lock.yaml**: The pi-ai bump from 0.51.6 to 0.52.0 changes the lockfile significantly (57 lines of changes). The JS repo may have different lockfile state.
   - What we know: package.json changes are clear (4 dep version bumps)
   - What's unclear: Whether the lockfile patch applies cleanly
   - Recommendation: Apply package.json changes, run `pnpm install`, commit the resulting lockfile

2. **SYNC-050 README clawtributor changes**: The README change adds a new contributor avatar. The JS repo's README may differ from upstream.
   - What we know: The contributor image list is maintained by a script
   - What's unclear: Whether the JS repo README has the same contributor section
   - Recommendation: Apply the README diff; if it fails, just add the new contributor entry manually

3. **SYNC-060 scope and overlap with SYNC-049**: This 72-file commit touches many files already modified by SYNC-049.
   - What we know: defaults.ts changes in 060 are a comment refinement of 049. Some test files updated in 049 are updated again in 060 with different values.
   - What's unclear: Exactly which changes are additive vs overlapping
   - Recommendation: Apply 060 diff carefully. For files modified by both 049 and 060, verify the final state matches upstream after 060.

4. **SYNC-060 extensions/copilot-proxy and extensions/tlon**: These are TypeScript files in extensions.
   - What we know: They are small changes (1 line each)
   - What's unclear: Whether these extensions exist in the JS repo
   - Recommendation: Check if the files exist. If not, skip those hunks. If they exist as .js, apply the equivalent change.

5. **SYNC-053 cron tool inferDeliveryFromSessionKey**: This is a 66-line new function with complex session key parsing.
   - What we know: It uses parseAgentSessionKey from sessions/session-key-utils.js
   - What's unclear: Whether the JS version of session-key-utils has the same API
   - Recommendation: Verify parseAgentSessionKey exists in JS codebase, then convert the function

## Sources

### Primary (HIGH confidence)
- Direct upstream commit diffs via `git diff <hash>^..<hash>` for all 21 commits
- Direct codebase analysis of all relevant JavaScript files in the local repo
- Phase 8 research document (established patterns for commit syncing)

### Secondary (MEDIUM confidence)
- PROJECT.md and STATE.md context for v1 conversion patterns
- REQUIREMENTS.md with commit hashes and PR references
- ROADMAP.md with phase success criteria

### To Verify at Execution Time
- pnpm-lock.yaml regeneration after dep bumps (SYNC-049, SYNC-060)
- Extension file existence (copilot-proxy, tlon) in JS repo
- README contributor section compatibility
- Session key parsing API compatibility for cron delivery inference

## Metadata

**Confidence breakdown:**
- Commit categorization: HIGH - All 21 upstream diffs fully analyzed
- Code locations: HIGH - Verified via local file checks
- Telegram threading flow: HIGH - Full diff analysis of SYNC-043/044/045 including the parseTelegramTarget oscillation
- Feishu expansion scope: HIGH - Full diff stat and new file list verified
- Claude Opus 4.6 scope: HIGH - All 16 files identified from upstream diff
- SYNC-060 scope: MEDIUM - 72 files is complex; overlap with SYNC-049 needs careful checking
- Cron delivery inference: HIGH - Full function diff analyzed
- Compaction/billing fixes: HIGH - All diffs fully analyzed

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - commit list is fixed, patterns stable)
