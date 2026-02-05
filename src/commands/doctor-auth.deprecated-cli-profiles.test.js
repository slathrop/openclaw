const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maybeRemoveDeprecatedCliAuthProfiles } from './doctor-auth.js';
let originalAgentDir;
let originalPiAgentDir;
let tempAgentDir;
function makePrompter(confirmValue) {
  return {
    confirm: vi.fn().mockResolvedValue(confirmValue),
    confirmRepair: vi.fn().mockResolvedValue(confirmValue),
    confirmAggressive: vi.fn().mockResolvedValue(confirmValue),
    confirmSkipInNonInteractive: vi.fn().mockResolvedValue(confirmValue),
    select: vi.fn().mockResolvedValue(''),
    shouldRepair: confirmValue,
    shouldForce: false
  };
}
__name(makePrompter, 'makePrompter');
beforeEach(() => {
  originalAgentDir = process.env.OPENCLAW_AGENT_DIR;
  originalPiAgentDir = process.env.PI_CODING_AGENT_DIR;
  tempAgentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-auth-'));
  process.env.OPENCLAW_AGENT_DIR = tempAgentDir;
  process.env.PI_CODING_AGENT_DIR = tempAgentDir;
});
afterEach(() => {
  if (originalAgentDir === void 0) {
    delete process.env.OPENCLAW_AGENT_DIR;
  } else {
    process.env.OPENCLAW_AGENT_DIR = originalAgentDir;
  }
  if (originalPiAgentDir === void 0) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = originalPiAgentDir;
  }
  if (tempAgentDir) {
    fs.rmSync(tempAgentDir, { recursive: true, force: true });
    tempAgentDir = void 0;
  }
});
describe('maybeRemoveDeprecatedCliAuthProfiles', () => {
  it('removes deprecated CLI auth profiles from store + config', async () => {
    if (!tempAgentDir) {
      throw new Error('Missing temp agent dir');
    }
    const authPath = path.join(tempAgentDir, 'auth-profiles.json');
    fs.writeFileSync(
      authPath,
      `${JSON.stringify(
        {
          version: 1,
          profiles: {
            'anthropic:claude-cli': {
              type: 'oauth',
              provider: 'anthropic',
              access: 'token-a',
              refresh: 'token-r',
              expires: Date.now() + 6e4
            },
            'openai-codex:codex-cli': {
              type: 'oauth',
              provider: 'openai-codex',
              access: 'token-b',
              refresh: 'token-r2',
              expires: Date.now() + 6e4
            }
          }
        },
        null,
        2
      )}
`,
      'utf8'
    );
    const cfg = {
      auth: {
        profiles: {
          'anthropic:claude-cli': { provider: 'anthropic', mode: 'oauth' },
          'openai-codex:codex-cli': { provider: 'openai-codex', mode: 'oauth' }
        },
        order: {
          anthropic: ['anthropic:claude-cli'],
          'openai-codex': ['openai-codex:codex-cli']
        }
      }
    };
    const next = await maybeRemoveDeprecatedCliAuthProfiles(cfg, makePrompter(true));
    const raw = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    expect(raw.profiles?.['anthropic:claude-cli']).toBeUndefined();
    expect(raw.profiles?.['openai-codex:codex-cli']).toBeUndefined();
    expect(next.auth?.profiles?.['anthropic:claude-cli']).toBeUndefined();
    expect(next.auth?.profiles?.['openai-codex:codex-cli']).toBeUndefined();
    expect(next.auth?.order?.anthropic).toBeUndefined();
    expect(next.auth?.order?.['openai-codex']).toBeUndefined();
  });
});
