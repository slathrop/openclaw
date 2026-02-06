# Roadmap: v2 Upstream Sync

**Created:** 2026-02-05
**Milestone:** v2 — Port 104 upstream commits to JavaScript codebase
**Commit range (INCLUSIVE):** a13ff55bd..6c42d3461

## Overview

| Phase | Name | Commits | Focus |
|-------|------|---------|-------|
| 7 | Security + Initial Hardening | 1-21 | Security fixes, TUI, Telegram cleanup, CLI extensions |
| 8 | Windows ACL + Telegram Threading | 22-42 | ACL tests, Discord, Telegram DM threading, Docs |
| 9 | Threading + Features | 43-63 | Telegram threading, Opus 4.6, Feishu, Cron fixes |
| 10 | xAI + Cron + Security Scanner | 64-83 | xAI Grok, Cron fixes, Exec approvals, Security scanner |
| 11 | Agents + Feishu + Gateway Auth | 84-104 | Agent fixes, Feishu multi-account, Gateway security |

---

## Phase 7: Security + Initial Hardening

**Goal:** Port security hardening, TUI fixes, Telegram cleanup, and CLI extension path fixes

**Commits:** 1-21 (21 commits)
**Requirements:** SYNC-001 to SYNC-021
**Plans:** 7 plans

Plans:
- [ ] 07-01-PLAN.md — Security foundation (credential exfil, TUI env, sandboxed media)
- [ ] 07-02-PLAN.md — Telegram bot-message cleanup + voice allowlist
- [ ] 07-03-PLAN.md — Owner-only tools + bot-handlers cleanup
- [ ] 07-04-PLAN.md — Message schema + owner allowlist + auth inference
- [ ] 07-05-PLAN.md — Plugin versions + cron formatters + appcast + notes
- [ ] 07-06-PLAN.md — Thinking downgrade + Discord hint + cron cleanup
- [ ] 07-07-PLAN.md — CLI extension path resolution (4 commits)

**Key changes:**
- **SYNC-001**: Security: Prevent gateway credential exfiltration via URL override (a13ff55bd)
- Security: sandboxed media handling, owner-only tools, command auth hardening
- Telegram: remove @ts-nocheck from bot-message.ts and bot-handlers.ts
- Voice: anonymous voice allowlist callers
- CLI: bundled chrome extension path resolution
- Cron: schedule formatters, xhigh thinking level downgrade

**Success criteria:**
1. All security tests pass
2. Telegram bot handlers load without @ts-nocheck
3. CLI extension install works for bundled extensions
4. Full test suite passes after each commit

---

## Phase 8: Windows ACL + Telegram Threading

**Goal:** Port Windows ACL tests, Discord fixes, Telegram DM threading, and docs updates

**Commits:** 22-42 (21 commits)
**Requirements:** SYNC-022 to SYNC-042

**Key changes:**
- Tests: Windows ACL coverage, Discord allowlist tests
- Discord: owner allowFrom matches, owner hint from allowlists
- Telegram: DM topic threadId preservation, forum topic binding inheritance
- Docs: streamlined start/install docs, onboarding pages
- CLI: sort commands alphabetically in help output

**Success criteria:**
1. Windows ACL tests pass
2. Discord allowlist matching works correctly
3. Telegram DM threading preserves threadId
4. Docs render without issues
5. Full test suite passes after each commit

---

## Phase 9: Threading + Features

**Goal:** Port Telegram threading completion, Claude Opus 4.6, Feishu updates, and cron fixes

**Commits:** 43-63 (21 commits)
**Requirements:** SYNC-043 to SYNC-063

**Key changes:**
- Telegram: topic auto-threading with parseTelegramTarget, subagent gateway call threading
- Features: Claude Opus 4.6 to model catalog
- Feishu: expand channel support, tighten mention gating
- Cron: scheduling and reminder delivery regressions
- CLI: avoid NODE_OPTIONS for --disable-warning
- Runtime: bump minimum Node.js version to 22.12.0
- Skills: QR code skill (added then reverted)

**Success criteria:**
1. Telegram topic auto-threading works end-to-end
2. Claude Opus 4.6 available in model selection
3. Feishu channel support expanded
4. Cron reminders delivered correctly
5. Full test suite passes after each commit

---

## Phase 10: xAI + Cron + Security Scanner

**Goal:** Port xAI Grok provider, cron robustness fixes, and security scanner

**Commits:** 64-83 (20 commits)
**Requirements:** SYNC-064 to SYNC-083

**Key changes:**
- Features: xAI Grok provider support with grok-4 default model
- Cron: recomputeNextRuns fix, re-arm timer on errors, legacy atMs handling
- Security: skill/plugin code safety scanner
- Exec approvals: coerce bare string allowlist entries
- Telegram: accept messages from group members in allowlisted groups
- UI: enable scrolling on dashboard config page
- Agents: bump pi-mono to 0.52.5
- Thinking: accept extra-high alias

**Success criteria:**
1. xAI Grok provider works in onboarding
2. Cron jobs don't skip due runs
3. Security scanner detects unsafe code patterns
4. Exec approval allowlists parse correctly
5. Full test suite passes after each commit

---

## Phase 11: Agents + Feishu + Gateway Auth

**Goal:** Port agent fixes, Feishu multi-account, and critical gateway auth security fixes

**Commits:** 84-104 (21 commits)
**Requirements:** SYNC-084 to SYNC-104

**Key changes:**
- Agents: skip tool extraction for aborted/errored messages
- Cron: handle undefined sessionTarget in list output
- Model: add strict gpt-5.3-codex fallback
- Feishu: replace built-in SDK with community plugin, multi-account support
- Security: redact credentials from config.get gateway responses
- Gateway: require auth for canvas host and a2ui assets (critical security fix)
- Session: release locks on process termination
- Ollama: streaming config and OLLAMA_API_KEY env var support
- Slack: mention stripPatterns for /new and /reset commands
- Nextcloud Talk: sign message text instead of JSON body
- DevEx: VS Code defaults and extensions for Oxlint/Oxfmt

**Success criteria:**
1. Agent tool extraction skips aborted messages
2. Feishu multi-account support works
3. Gateway canvas host requires authentication
4. Credentials are redacted from gateway responses
5. Full test suite passes after each commit

---

## Execution Notes

**Commit approach:**
- Process commits in strict chronological order (oldest first)
- Each upstream commit becomes exactly one commit in this repo
- Run full test suite after each commit
- Translate TypeScript to JavaScript where needed (using v1 patterns)

**Files to watch:**
- `.ts` files need conversion to `.js` with JSDoc
- `.md` docs can be applied directly
- `package.json` changes may conflict with existing structure
- Test files need TypeScript stripping

**Progress tracking:**
- Update REQUIREMENTS.md checkboxes as commits are ported
- Update STATE.md progress bar after each phase

---

*Roadmap created: 2026-02-05*
*Phase 7 planned: 2026-02-05*
