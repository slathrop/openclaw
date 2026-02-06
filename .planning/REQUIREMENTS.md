# Requirements: v2 Upstream Sync

**Defined:** 2026-02-05
**Core Value:** Human-friendly JavaScript synchronized with upstream TypeScript development

## v2 Requirements

Port 103 upstream commits with 1:1 parity and full test verification.

**Commit range (INCLUSIVE):** a13ff55bd..ee1ec3fab

### Phase 7: Security + Initial Hardening (commits 1-21)

- [ ] **SYNC-001**: Security: Prevent gateway credential exfiltration via URL override (#9179) (a13ff55bd)
- [ ] **SYNC-002**: Tests: restore TUI gateway env (5e025c4ba)
- [ ] **SYNC-003**: Security: harden sandboxed media handling (#9182) (4434cae56)
- [ ] **SYNC-004**: Telegram: remove @ts-nocheck from bot-message.ts (#9180) (90b4e5435)
- [ ] **SYNC-005**: fix: cover anonymous voice allowlist callers (#8104) (0cd47d830)
- [ ] **SYNC-006**: Security: owner-only tools + command auth hardening (#9202) (392bbddf2)
- [ ] **SYNC-007**: Telegram: remove last @ts-nocheck from bot-handlers.ts (#9206) (21f8c3db1)
- [ ] **SYNC-008**: Message: clarify media schema + fix MEDIA newline (a6fd76efe)
- [ ] **SYNC-009**: fix: enforce owner allowlist for commands (385a7eba3)
- [ ] **SYNC-010**: fix: infer --auth-choice from API key flags (#9241) (22927b083)
- [ ] **SYNC-011**: chore: sync plugin versions to 2026.2.3 (f895c9fba)
- [ ] **SYNC-012**: fix(mac): resolve cron schedule formatters (cfdc55134)
- [ ] **SYNC-013**: chore(mac): update appcast for 2026.2.3 (7f95cdac7)
- [ ] **SYNC-014**: chore: update 2026.2.3 notes (54ddbc466)
- [ ] **SYNC-015**: fix: gracefully downgrade xhigh thinking level (#9363) (852466645)
- [ ] **SYNC-016**: fix: restore discord owner hint from allowlists (d84eb4646)
- [ ] **SYNC-017**: fix: remove unused cron import (3b40227bc)
- [ ] **SYNC-018**: fix(cli): resolve bundled chrome extension path (0621d0e9e)
- [ ] **SYNC-019**: test(cli): use unique temp dir for extension install (1008c28f5)
- [ ] **SYNC-020**: fix(cli): support bundled extension path in dist root (44bbe09be)
- [ ] **SYNC-021**: style(cli): satisfy lint rules in extension path resolver (34e78a705)

### Phase 8: Windows ACL + Telegram Threading (commits 22-42)

- [ ] **SYNC-022**: fix: resolve bundled chrome extension assets (#8914) (1ee1522da)
- [ ] **SYNC-023**: Tests: add test coverage for security/windows-acl.ts (f26cc6087)
- [ ] **SYNC-024**: fix: stabilize windows acl tests + command auth registry (#9335) (d6cde28c8)
- [ ] **SYNC-025**: test: register discord plugin in allowlist test (bdb90ea4e)
- [ ] **SYNC-026**: chore: bump version to 2026.2.4 (5031b283a)
- [ ] **SYNC-027**: fix: resolve discord owner allowFrom matches (a4d1af1b1)
- [ ] **SYNC-028**: fix(telegram): preserve DM topic threadId in deliveryContext (8860d2ed7)
- [ ] **SYNC-029**: test(telegram): add DM topic threadId deliveryContext test (c0b267a03)
- [ ] **SYNC-030**: fix: preserve telegram DM topic threadId (#9039) (f2c5c847b)
- [ ] **SYNC-031**: Update deps. (460808e0c)
- [ ] **SYNC-032**: chore: Typecheck test helper files. (8b8451231)
- [ ] **SYNC-033**: Docs: streamline start and install docs (#9648) (675c26b2b)
- [ ] **SYNC-034**: docs(install): rename install overview page (34424ce53)
- [ ] **SYNC-035**: CLI: sort commands alphabetically in help output (203e3804b)
- [ ] **SYNC-036**: fix: update changelog for help sorting (#8068) (cf95b2f3f)
- [ ] **SYNC-037**: docs(onboarding): add bootstrapping page (#9767) (3011b00d3)
- [ ] **SYNC-038**: docs: fix onboarding rendering issues (c8f4bca0c)
- [ ] **SYNC-039**: chore: reset appcast to 2026.2.3 (547374220)
- [ ] **SYNC-040**: fix(telegram): pass parentPeer for forum topic binding (#9789) (ddedb56c0)
- [ ] **SYNC-041**: docs(onboarding): streamline CLI onboarding docs (#9830) (9e0030b75)
- [ ] **SYNC-042**: fix: auto-inject Telegram forum topic threadId (eef247b7a)

### Phase 9: Threading + Features (commits 43-63)

- [ ] **SYNC-043**: test: cover telegram topic threadId auto-injection (6ac5dd2c0)
- [ ] **SYNC-044**: fix: pass threadId/to/accountId from parent to subagent (a13efbe2b)
- [ ] **SYNC-045**: fix: telegram topic auto-threading (#7235) (01db1dde1)
- [ ] **SYNC-046**: update handle (1473fb19a)
- [ ] **SYNC-047**: docs: fix model.fallback to model.fallbacks (#9384) (679bb087d)
- [ ] **SYNC-048**: fix(cli): avoid NODE_OPTIONS for --disable-warning (#9691) (ea237115a)
- [ ] **SYNC-049**: feat: add Claude Opus 4.6 to built-in model catalog (#9853) (eb80b9acb)
- [ ] **SYNC-050**: Feishu: expand channel support (4fc4c5256)
- [ ] **SYNC-051**: Feishu: tighten mention gating (7c951b01a)
- [ ] **SYNC-052**: fix: remove orphaned tool_results during compaction (f32eeae3b)
- [ ] **SYNC-053**: fix cron scheduling and reminder delivery regressions (#9733) (821520a05)
- [ ] **SYNC-054**: chore: add agent credentials to gitignore (#9874) (d6c088910)
- [ ] **SYNC-055**: Docs: escape hash symbol in help channel names (#9695) (7159d3b25)
- [ ] **SYNC-056**: feat(skills): add QR code skill (#8817) (ad13c265b)
- [ ] **SYNC-057**: chore(agentsmd): add tsgo command to AGENTS.md (#9894) (db8e9b37c)
- [ ] **SYNC-058**: fix(runtime): bump minimum Node.js version to 22.12.0 (#5370) (2ca78a8ae)
- [ ] **SYNC-059**: fix: clear stale token metrics on /new and /reset (#8929) (93b450349)
- [ ] **SYNC-060**: chore: apply local workspace updates (#9911) (462905440)
- [ ] **SYNC-061**: fix: allow multiple compaction retries on context overflow (#8928) (4e1a7cd60)
- [ ] **SYNC-062**: fix(errors): show clear billing error (#8391) (d4c560853)
- [ ] **SYNC-063**: Revert "feat(skills): add QR code skill (#8817)" (6b7d3c306)

### Phase 10: xAI + Cron + Security Scanner (commits 64-83)

- [ ] **SYNC-064**: docs: improve DM security guidance with concrete example (b8004a28c)
- [ ] **SYNC-065**: docs: tighten secure DM example (873182ec2)
- [ ] **SYNC-066**: docs: note secure DM guidance update (#9377) (8fdc0a284)
- [ ] **SYNC-067**: Agents: bump pi-mono to 0.52.5 (#9949) (3299aeb90)
- [ ] **SYNC-068**: docs: restructure Get Started tab and improve onboarding (#9950) (c18452598)
- [ ] **SYNC-069**: fix(telegram): accept messages from group members (#9775) (4a5e9f0a4)
- [ ] **SYNC-070**: chore: remove tracked .DS_Store files (8577d015b)
- [ ] **SYNC-071**: Fix: Enable scrolling on dashboard config page (#1822) (cefd87f35)
- [ ] **SYNC-072**: feat: add xAI Grok provider support (db31c0ccc)
- [ ] **SYNC-073**: fix(onboard): align xAI default model to grok-4 (155dfa93e)
- [ ] **SYNC-074**: chore: changelog for xAI onboarding (#9885) (68393bfa3)
- [ ] **SYNC-075**: fix(cron): prevent recomputeNextRuns from skipping due jobs (#9823) (313e2f2e8)
- [ ] **SYNC-076**: fix(cron): re-arm timer in finally to survive transient errors (#9948) (40e23b05f)
- [ ] **SYNC-077**: fix(cron): handle legacy atMs field in schedule (#9932) (b0befb5f5)
- [ ] **SYNC-078**: fix(exec-approvals): coerce bare string allowlist entries (#9790) (6ff209e93)
- [ ] **SYNC-079**: fix(exec-approvals): coerce bare string allowlist entries (#9903) (141f551a4)
- [ ] **SYNC-080**: security: add skill/plugin code safety scanner (#9806) (bc88e58fc)
- [ ] **SYNC-081**: Thinking: accept extra-high alias and sync Codex FAQ (5958e5693)
- [ ] **SYNC-082**: Changelog: note #9976 thinking alias + Codex 5.3 docs sync (7db839544)
- [ ] **SYNC-083**: fix: normalize xhigh aliases and docs sync (#9976) (de7b2ba7d)

### Phase 11: Agents + Feishu + Gateway Auth (commits 84-103)

- [ ] **SYNC-084**: fix(agents): skip tool extraction for aborted messages (#4598) (861725fba)
- [ ] **SYNC-085**: fix(cron): handle undefined sessionTarget in list output (#9752) (2d15dd757)
- [ ] **SYNC-086**: chore: Update deps. (6f4665dda)
- [ ] **SYNC-087**: Model: add strict gpt-5.3-codex fallback (#9995) (370bbcd89)
- [ ] **SYNC-088**: fix(nextcloud-talk): sign message text instead of JSON body (#2092) (57326f72e)
- [ ] **SYNC-089**: fix(slack): add mention stripPatterns for /new and /reset (#9971) (02842bef9)
- [ ] **SYNC-090**: feat(feishu): replace built-in SDK with community plugin (2267d58af)
- [ ] **SYNC-091**: fix(feishu): add targeted eslint-disable comments (7e32f1ce2)
- [ ] **SYNC-092**: fix(feishu): fix webhook mode silent exit and receive_id_type (8ba1387ba)
- [ ] **SYNC-093**: chore: update pnpm-lock.yaml for feishu extension deps (7e005acd3)
- [ ] **SYNC-094**: feat(feishu): sync with clawdbot-feishu #137 (multi-account) (5f6e1c19b)
- [ ] **SYNC-095**: security: redact credentials from config.get gateway responses (#9858) (0c7fa2b0d)
- [ ] **SYNC-096**: fix: release session locks on process termination (#1962) (ec0728b35)
- [ ] **SYNC-097**: fix(ollama): add streaming config and fix OLLAMA_API_KEY env (#9870) (34a58b839)
- [ ] **SYNC-098**: fix: untrack dist/control-ui build artifacts (#1856) (3ad795836)
- [ ] **SYNC-099**: add PR review workflow templates (0a4859247)
- [ ] **SYNC-100**: fix: wire onToolResult callback for verbose tool summaries (#2022) (05b28c147)
- [ ] **SYNC-101**: fix: Gateway canvas host bypasses auth (47538bca4)
- [ ] **SYNC-102**: fix(gateway): require auth for canvas host and a2ui (#9518) (a459e237e)
- [ ] **SYNC-103**: Add proper `onToolResult` fallback. (ee1ec3fab)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Commits outside range | Only a13ff55..ee1ec3f (inclusive) |
| Reordering commits | Strict chronological order |
| Skipping commits | All 103 must be ported |

## Traceability

| Requirement Range | Phase | Status |
|-------------------|-------|--------|
| SYNC-001 to SYNC-021 | Phase 7 | Pending |
| SYNC-022 to SYNC-042 | Phase 8 | Pending |
| SYNC-043 to SYNC-063 | Phase 9 | Pending |
| SYNC-064 to SYNC-083 | Phase 10 | Pending |
| SYNC-084 to SYNC-103 | Phase 11 | Pending |

**Coverage:**
- v2 requirements: 103 total
- Mapped to phases: 103
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 — corrected to include boundary commit a13ff55*
