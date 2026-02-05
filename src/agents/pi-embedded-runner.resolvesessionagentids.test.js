import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { resolveSessionAgentIds } from './agent-scope.js';
import { ensureOpenClawModelsJson } from './models-config.js';
vi.mock('@mariozechner/pi-ai', async () => {
  const actual = await vi.importActual('@mariozechner/pi-ai');
  return {
    ...actual,
    streamSimple: (model) => {
      if (model.id === 'mock-error') {
        throw new Error('boom');
      }
      const stream = new actual.AssistantMessageEventStream();
      queueMicrotask(() => {
        stream.push({
          type: 'done',
          reason: 'stop',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'ok' }],
            stopReason: 'stop',
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 1,
              output: 1,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 2,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0
              }
            },
            timestamp: Date.now()
          }
        });
      });
      return stream;
    }
  };
});
// eslint-disable-next-line no-unused-vars
const _makeOpenAiConfig = (modelIds) => ({
  models: {
    providers: {
      openai: {
        api: 'openai-responses',
        apiKey: 'sk-test',
        baseUrl: 'https://example.com',
        models: modelIds.map((id) => ({
          id,
          name: `Mock ${id}`,
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 16e3,
          maxTokens: 2048
        }))
      }
    }
  }
});
// eslint-disable-next-line no-unused-vars
const _ensureModels = (cfg, agentDir) => ensureOpenClawModelsJson(cfg, agentDir);
// eslint-disable-next-line no-unused-vars
const _textFromContent = (content) => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content) && content[0]?.type === 'text') {
    return content[0].text;
  }
  return void 0;
};
// eslint-disable-next-line no-unused-vars
const _readSessionMessages = async (sessionFile) => {
  const raw = await fs.readFile(sessionFile, 'utf-8');
  return raw.split(/\r?\n/).filter(Boolean).map(
    (line) => JSON.parse(line)
  ).filter((entry) => entry.type === 'message').map((entry) => entry.message);
};
describe('resolveSessionAgentIds', () => {
  const cfg = {
    agents: {
      list: [{ id: 'main' }, { id: 'beta', default: true }]
    }
  };
  it('falls back to the configured default when sessionKey is missing', () => {
    const { defaultAgentId, sessionAgentId } = resolveSessionAgentIds({
      config: cfg
    });
    expect(defaultAgentId).toBe('beta');
    expect(sessionAgentId).toBe('beta');
  });
  it('falls back to the configured default when sessionKey is non-agent', () => {
    const { sessionAgentId } = resolveSessionAgentIds({
      sessionKey: 'telegram:slash:123',
      config: cfg
    });
    expect(sessionAgentId).toBe('beta');
  });
  it('falls back to the configured default for global sessions', () => {
    const { sessionAgentId } = resolveSessionAgentIds({
      sessionKey: 'global',
      config: cfg
    });
    expect(sessionAgentId).toBe('beta');
  });
  it('keeps the agent id for provider-qualified agent sessions', () => {
    const { sessionAgentId } = resolveSessionAgentIds({
      sessionKey: 'agent:beta:slack:channel:c1',
      config: cfg
    });
    expect(sessionAgentId).toBe('beta');
  });
  it('uses the agent id from agent session keys', () => {
    const { sessionAgentId } = resolveSessionAgentIds({
      sessionKey: 'agent:main:main',
      config: cfg
    });
    expect(sessionAgentId).toBe('main');
  });
});
