const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAuthChoice } from './auth-choice.js';
const noopAsync = /* @__PURE__ */ __name(async () => {
}, 'noopAsync');
const noop = /* @__PURE__ */ __name(() => {
}, 'noop');
const authProfilePathFor = /* @__PURE__ */ __name((agentDir) => path.join(agentDir, 'auth-profiles.json'), 'authProfilePathFor');
const requireAgentDir = /* @__PURE__ */ __name(() => {
  const agentDir = process.env.OPENCLAW_AGENT_DIR;
  if (!agentDir) {
    throw new Error('OPENCLAW_AGENT_DIR not set');
  }
  return agentDir;
}, 'requireAgentDir');
describe('applyAuthChoice (moonshot)', () => {
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;
  const previousAgentDir = process.env.OPENCLAW_AGENT_DIR;
  const previousPiAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousMoonshotKey = process.env.MOONSHOT_API_KEY;
  let tempStateDir = null;
  afterEach(async () => {
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
      tempStateDir = null;
    }
    if (previousStateDir === void 0) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    if (previousAgentDir === void 0) {
      delete process.env.OPENCLAW_AGENT_DIR;
    } else {
      process.env.OPENCLAW_AGENT_DIR = previousAgentDir;
    }
    if (previousPiAgentDir === void 0) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousPiAgentDir;
    }
    if (previousMoonshotKey === void 0) {
      delete process.env.MOONSHOT_API_KEY;
    } else {
      process.env.MOONSHOT_API_KEY = previousMoonshotKey;
    }
  });
  it('keeps the .cn baseUrl when setDefaultModel is false', async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-auth-'));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    process.env.OPENCLAW_AGENT_DIR = path.join(tempStateDir, 'agent');
    process.env.PI_CODING_AGENT_DIR = process.env.OPENCLAW_AGENT_DIR;
    delete process.env.MOONSHOT_API_KEY;
    const text = vi.fn().mockResolvedValue('sk-moonshot-cn-test');
    const prompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => ''),
      multiselect: vi.fn(async () => []),
      text,
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop }))
    };
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code) => {
        throw new Error(`exit:${code}`);
      })
    };
    const result = await applyAuthChoice({
      authChoice: 'moonshot-api-key-cn',
      config: {
        agents: {
          defaults: {
            model: { primary: 'anthropic/claude-opus-4-5' }
          }
        }
      },
      prompter,
      runtime,
      setDefaultModel: false
    });
    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Enter Moonshot API key (.cn)' })
    );
    expect(result.config.agents?.defaults?.model?.primary).toBe('anthropic/claude-opus-4-5');
    expect(result.config.models?.providers?.moonshot?.baseUrl).toBe('https://api.moonshot.cn/v1');
    expect(result.agentModelOverride).toBe('moonshot/kimi-k2.5');
    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.profiles?.['moonshot:default']?.key).toBe('sk-moonshot-cn-test');
  });
  it('sets the default model when setDefaultModel is true', async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-auth-'));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    process.env.OPENCLAW_AGENT_DIR = path.join(tempStateDir, 'agent');
    process.env.PI_CODING_AGENT_DIR = process.env.OPENCLAW_AGENT_DIR;
    delete process.env.MOONSHOT_API_KEY;
    const text = vi.fn().mockResolvedValue('sk-moonshot-cn-test');
    const prompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => ''),
      multiselect: vi.fn(async () => []),
      text,
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop }))
    };
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code) => {
        throw new Error(`exit:${code}`);
      })
    };
    const result = await applyAuthChoice({
      authChoice: 'moonshot-api-key-cn',
      config: {},
      prompter,
      runtime,
      setDefaultModel: true
    });
    expect(result.config.agents?.defaults?.model?.primary).toBe('moonshot/kimi-k2.5');
    expect(result.config.models?.providers?.moonshot?.baseUrl).toBe('https://api.moonshot.cn/v1');
    expect(result.agentModelOverride).toBeUndefined();
    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.profiles?.['moonshot:default']?.key).toBe('sk-moonshot-cn-test');
  });
});
