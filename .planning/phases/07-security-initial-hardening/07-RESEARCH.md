# Phase 7: Security + Initial Hardening - Research

**Researched:** 2026-02-05
**Domain:** Upstream commit syncing (security fixes, bug fixes, TypeScript cleanup, CLI improvements)
**Confidence:** HIGH

## Summary

Phase 7 is the first phase of the v2 Upstream Sync milestone. It ports 21 upstream commits (SYNC-001 to SYNC-021) from the TypeScript repository to this JavaScript codebase. Unlike v1 phases which focused on TypeScript-to-JavaScript conversion, v2 phases focus on **maintaining 1:1 commit parity with upstream** while translating TypeScript changes to JavaScript.

The 21 commits break down into: 6 security fixes, 4 Telegram code cleanup (removing @ts-nocheck), 3 CLI extension path fixes, 2 cron fixes, 2 Discord fixes, and 4 miscellaneous (TUI test, auth inference, plugin versioning, changelog). Each upstream commit must become exactly one commit in this repo, preserving the original commit message and intent.

The primary challenge is understanding each upstream commit's purpose and translating TypeScript changes to idiomatic JavaScript. The codebase is already JavaScript (v1 completed), so the task is applying patches rather than converting file formats.

**Primary recommendation:** Process commits in strict chronological order. For each commit: read the upstream diff, understand the change, apply the equivalent JavaScript change, run tests, commit with matching message.

## Standard Stack

No new libraries needed. This phase applies changes to existing JavaScript code.

### Core (already in use)
| Library | Version | Purpose | Role in Phase 7 |
|---------|---------|---------|-----------------|
| `vitest` | ^4.0.18 | Test runner | Validates each commit's changes |
| `eslint` | ^9.39.2 | Linter | Ensures style compliance after changes |
| `rolldown` | 1.0.0-rc.2 | Bundler | Builds after changes |

### Relevant Code Areas
| Module | Files | Relevant Commits |
|--------|-------|------------------|
| `src/gateway/` | auth.js, server.impl.js, net.js | SYNC-001 (credential exfiltration) |
| `src/telegram/` | bot-message.js, bot-handlers.js | SYNC-004, SYNC-007 (@ts-nocheck removal) |
| `src/auto-reply/` | command-auth.js, stage-sandbox-media.js | SYNC-003, SYNC-006, SYNC-009 (security hardening) |
| `src/cli/` | browser-cli-extension.js | SYNC-018 to SYNC-021 (extension path) |
| `src/cron/` | schedule.js | SYNC-012 (schedule formatters) |
| `src/auto-reply/` | thinking.js | SYNC-015 (xhigh downgrade) |

## Architecture Patterns

### Pattern 1: 1:1 Commit Parity Workflow
**What:** Each upstream commit becomes exactly one commit in this repo
**When to use:** Every commit in this phase (and all v2 phases)
**Example:**
```bash
# For SYNC-001: Security: Prevent gateway credential exfiltration via URL override
# 1. Read upstream diff
git -C ../openclaw show a13ff55bd --stat
git -C ../openclaw show a13ff55bd

# 2. Apply equivalent change in JavaScript
# (edit files as needed)

# 3. Run tests
pnpm test

# 4. Commit with matching message
git add src/gateway/auth.js
git commit -m "Security: Prevent gateway credential exfiltration via URL override (#9179)"
```

### Pattern 2: TypeScript to JavaScript Patch Translation
**What:** Translate TypeScript patches to equivalent JavaScript changes
**When to use:** When upstream diff modifies .ts files
**Example:**
```javascript
// Upstream TypeScript change:
function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  // ... rest of validation
}

// JavaScript equivalent (already converted):
function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  // ... rest of validation
}
// Just apply the logic change - types are already stripped
```

### Pattern 3: @ts-nocheck Removal (SYNC-004, SYNC-007)
**What:** Telegram files had @ts-nocheck directives that upstream removed by fixing type issues
**When to use:** SYNC-004 (bot-message.ts -> bot-message.js), SYNC-007 (bot-handlers.ts -> bot-handlers.js)
**Handling:** In this JavaScript codebase, there are no @ts-nocheck directives. These commits likely include code fixes that enabled TypeScript to type-check the file. Apply those code fixes.

### Pattern 4: Security Fix Application
**What:** Security fixes often add validation, block attack vectors, or harden access control
**When to use:** SYNC-001, SYNC-003, SYNC-006, SYNC-009
**Example pattern:**
```javascript
// SYNC-001 prevents URL override credential exfiltration
// Look for: URL validation before using user-provided URLs
// Pattern: Add checks like origin validation, path normalization, blocklist matching

// SYNC-003 hardens sandboxed media handling
// Look for: Path validation, directory traversal prevention
// Pattern: assertSandboxPath() calls before file operations

// SYNC-006 owner-only tools + command auth hardening
// Look for: Owner checks before allowing sensitive commands
// Pattern: resolveCommandAuthorization() enhancements
```

### Recommended Commit Order
```
Week 1: Security Foundation (commits 1-9)
  SYNC-001: Security: credential exfiltration prevention
  SYNC-002: Tests: TUI gateway env
  SYNC-003: Security: sandboxed media hardening
  SYNC-004: Telegram: bot-message.ts cleanup
  SYNC-005: Voice: anonymous allowlist callers
  SYNC-006: Security: owner-only tools
  SYNC-007: Telegram: bot-handlers.ts cleanup
  SYNC-008: Message: media schema clarification
  SYNC-009: Security: owner allowlist enforcement

Week 1: Auth + Plugin Versioning (commits 10-14)
  SYNC-010: Auth: infer --auth-choice from API key flags
  SYNC-011: Chore: sync plugin versions
  SYNC-012: Mac: cron schedule formatters
  SYNC-013: Mac: appcast update
  SYNC-014: Chore: release notes update

Week 1: Final Fixes (commits 15-21)
  SYNC-015: Thinking: graceful xhigh downgrade
  SYNC-016: Discord: restore owner hint
  SYNC-017: Cron: remove unused import
  SYNC-018-021: CLI: bundled chrome extension path resolution
```

### Anti-Patterns to Avoid
- **Batching commits:** Each upstream commit must be one local commit. Never squash multiple upstream commits.
- **Skipping tests:** Full test suite must pass after each commit, not just at phase end.
- **Ignoring commit messages:** Use the upstream commit message (or close variant) to maintain traceability.
- **Assuming no JavaScript changes needed:** Even "TypeScript cleanup" commits may include logic changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Understanding upstream changes | Reading source only | `git show` + `gh pr view` | PR context explains intent |
| Path validation | Custom regex | `assertSandboxPath()` from agents/sandbox-paths.js | Already implements proper security checks |
| Allowlist matching | Custom matching | Existing `formatAllowFromList()`, `resolveSenderCandidates()` | Complex normalization already solved |
| URL validation | Custom checks | Node.js URL constructor + existing `isLoopbackHost()` | Edge cases handled |

**Key insight:** Security fixes should leverage existing security infrastructure (assertSandboxPath, command-auth patterns, allowlist normalization) rather than introducing new patterns.

## Common Pitfalls

### Pitfall 1: Missing Upstream Context
**What goes wrong:** Changes seem arbitrary without understanding the security issue or bug they fix.
**Why it happens:** Upstream commits reference PR numbers (#9179, #9182, etc.) that contain discussion and context.
**How to avoid:** For each commit, check the PR: `gh pr view 9179 --repo openclaw/openclaw`
**Warning signs:** Making changes without understanding "why"

### Pitfall 2: @ts-nocheck Commits Seem Empty
**What goes wrong:** SYNC-004 and SYNC-007 are "remove @ts-nocheck" but JavaScript has no @ts-nocheck.
**Why it happens:** The @ts-nocheck directive was masking type errors. The commit fixes those underlying issues.
**How to avoid:** Read the full diff - there will be code changes that made the file type-safe.
**Warning signs:** Thinking these commits need no changes

### Pitfall 3: Security Fix Incomplete
**What goes wrong:** Applying the code change but missing test coverage or related validation.
**Why it happens:** Security fixes often have multiple components (validation + test + error message).
**How to avoid:** Check if upstream commit includes test changes. Apply those too.
**Warning signs:** Security test file not modified when it should be

### Pitfall 4: Cron/Mac Commits May Not Apply
**What goes wrong:** Some commits (SYNC-012, SYNC-013) touch macOS-specific code that may not exist in this repo.
**Why it happens:** This repo may not include all native app code.
**How to avoid:** Check if the target file exists. If not, create an equivalent or note as N/A.
**Warning signs:** File not found errors during patch application

### Pitfall 5: Chrome Extension Path Resolution
**What goes wrong:** SYNC-018 to SYNC-021 fix bundled extension path issues that may work differently here.
**Why it happens:** The original issue was about `dist/` structure which differs between repos.
**How to avoid:** Verify `bundledExtensionRootDir()` in browser-cli-extension.js resolves correctly. Test with actual `openclaw browser extension install` command.
**Warning signs:** Extension path tests fail

### Pitfall 6: Thinking Level Downgrade Logic
**What goes wrong:** SYNC-015 adds graceful downgrade for "xhigh" thinking level, but logic must match existing patterns.
**Why it happens:** The thinking level system has specific enum values and fallback logic.
**How to avoid:** Check `src/auto-reply/thinking.js` for the existing level hierarchy. The fix adds fallback for unsupported "xhigh" level.
**Warning signs:** Thinking level tests fail or invalid level errors

## Code Examples

### Security: URL Validation (Pattern from SYNC-001)
```javascript
// Pattern for preventing URL override credential exfiltration
// Source: Expected pattern from security fix

/**
 * Validate that a URL is safe to use for gateway operations
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is safe
 */
const isUrlSafe = (url) => {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    // Block credentials in URL (can be used for exfiltration)
    if (parsed.username || parsed.password) return false
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    return true
  } catch {
    return false
  }
}
```

### Security: Sandboxed Media Path Validation (Pattern from SYNC-003)
```javascript
// Pattern for hardened media handling
// Source: src/auto-reply/reply/stage-sandbox-media.js (already in codebase)

import { assertSandboxPath } from '../../agents/sandbox-paths.js'

// Before copying any file into sandbox, validate it's from allowed directory
const mediaDir = getMediaDir()
try {
  await assertSandboxPath({
    filePath: source,
    cwd: mediaDir,
    root: mediaDir
  })
} catch {
  logVerbose(`Blocking attempt to stage media from outside media directory: ${source}`)
  continue
}
```

### Command Auth: Owner Check Pattern (Pattern from SYNC-006, SYNC-009)
```javascript
// Pattern for owner-only command authorization
// Source: src/auto-reply/command-auth.js

const resolveCommandAuthorization = (params) => {
  const { ctx, cfg, commandAuthorized } = params

  // Resolve allowlist for this channel
  const allowFromList = formatAllowFromList({
    dock,
    cfg,
    accountId: ctx.AccountId,
    allowFrom: allowFromRaw
  })

  // Check if sender is in owner allowlist
  const senderCandidates = resolveSenderCandidates({
    dock, cfg, accountId,
    senderId: ctx.SenderId,
    from: ctx.From
  })

  const isOwner = senderCandidates.some(candidate =>
    allowFromList.includes(candidate)
  )

  // Owner-only commands require explicit match
  if (command.ownerOnly && !isOwner) {
    return { authorized: false, reason: 'owner-only' }
  }

  return commandAuthorized(params)
}
```

### Thinking Level Downgrade (Pattern from SYNC-015)
```javascript
// Pattern for graceful xhigh thinking level downgrade
// Source: src/auto-reply/thinking.js (expected change)

const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh']

const normalizeThinkingLevel = (level) => {
  const normalized = String(level).toLowerCase().trim()

  // Direct match
  if (THINKING_LEVELS.includes(normalized)) {
    return normalized
  }

  // Graceful downgrade: xhigh -> high if not supported by model
  if (normalized === 'xhigh') {
    // Check if model supports xhigh
    // If not, gracefully downgrade to 'high'
    return 'high'
  }

  // Default
  return 'medium'
}
```

### Chrome Extension Path Resolution (Pattern from SYNC-018)
```javascript
// Pattern for bundled extension path resolution
// Source: src/cli/browser-cli-extension.js

import path from 'node:path'
import { fileURLToPath } from 'node:url'

function bundledExtensionRootDir() {
  const here = path.dirname(fileURLToPath(import.meta.url))

  // Try relative path first (dev mode)
  let candidate = path.resolve(here, '../../assets/chrome-extension')
  if (hasManifest(candidate)) return candidate

  // Try dist root (bundled mode)
  candidate = path.resolve(here, '../assets/chrome-extension')
  if (hasManifest(candidate)) return candidate

  // Fallback to original location
  return path.resolve(here, '../../assets/chrome-extension')
}
```

## Commit Analysis

| SYNC | Type | Files Expected | Complexity |
|------|------|----------------|------------|
| 001 | Security | gateway/auth.js, gateway/net.js | HIGH - credential exfiltration prevention |
| 002 | Test | tui tests | LOW - test env restoration |
| 003 | Security | stage-sandbox-media.js | MEDIUM - path validation hardening |
| 004 | Cleanup | telegram/bot-message.js | MEDIUM - type fixes as logic changes |
| 005 | Bugfix | voice/allowlist logic | LOW - allowlist matching |
| 006 | Security | command-auth.js, tools | HIGH - owner-only tools |
| 007 | Cleanup | telegram/bot-handlers.js | MEDIUM - type fixes as logic changes |
| 008 | Docs/Schema | message types | LOW - schema clarification |
| 009 | Security | command-auth.js | MEDIUM - allowlist enforcement |
| 010 | Bugfix | auth-choice-options.js | LOW - flag inference |
| 011 | Chore | package.json (plugins) | LOW - version sync |
| 012 | Bugfix | cron/schedule.js | MEDIUM - formatter fixes |
| 013 | Chore | mac appcast | LOW - may not apply |
| 014 | Docs | changelog | LOW - documentation only |
| 015 | Bugfix | thinking.js | MEDIUM - level downgrade |
| 016 | Bugfix | discord/allow-list.js | LOW - owner hint |
| 017 | Chore | cron imports | LOW - unused import removal |
| 018 | Bugfix | browser-cli-extension.js | MEDIUM - path resolution |
| 019 | Test | extension install test | LOW - test isolation |
| 020 | Bugfix | browser-cli-extension.js | LOW - dist root support |
| 021 | Style | browser-cli-extension.js | LOW - lint fixes |

## Testing Strategy

### Per-Commit Verification
```bash
# After each commit:
pnpm test                    # Full test suite
pnpm check                   # Lint/type check
git status                   # Verify clean tree
```

### Security-Specific Tests
- SYNC-001: Check gateway auth tests pass
- SYNC-003: Check sandbox media security tests pass
- SYNC-006: Check command auth tests pass
- SYNC-009: Check owner allowlist tests pass

### Regression Areas
- Gateway authentication
- Telegram message handling
- Command authorization
- Cron scheduling
- CLI extension installation

## Open Questions

1. **Mac-specific commits (SYNC-012, SYNC-013)**
   - What we know: These touch macOS app code
   - What's unclear: Whether this repo includes the macOS app code or just the CLI
   - Recommendation: Check if target files exist. If not, skip or create equivalent

2. **Plugin version sync (SYNC-011)**
   - What we know: Updates plugin versions in package.json
   - What's unclear: Whether plugin package.json files are in sync with upstream
   - Recommendation: Compare plugin package.json files and sync versions

3. **Voice allowlist (SYNC-005)**
   - What we know: Covers anonymous voice allowlist callers
   - What's unclear: Whether voice module exists in this repo
   - Recommendation: Check for voice-related code in src/ or extensions/

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of relevant JavaScript files
- REQUIREMENTS.md with commit hashes and PR references
- ROADMAP.md with phase success criteria

### Secondary (MEDIUM confidence)
- Previous v1 phase patterns (for JavaScript style conventions)
- Phase 3 research (for security annotation patterns)

### To Verify at Execution Time
- Upstream commit diffs: `git show <hash>` in upstream repo
- PR context: `gh pr view <number>` for intent and discussion

## Metadata

**Confidence breakdown:**
- Commit categorization: HIGH - Based on commit messages in REQUIREMENTS.md
- Code locations: HIGH - Verified via grep and glob in current codebase
- Security patterns: HIGH - Existing patterns visible in codebase
- Mac-specific applicability: MEDIUM - Need to verify file existence

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - commit list is fixed, patterns stable)
