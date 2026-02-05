import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { ensureOpenClawModelsJson } from './models-config.js';
import { getDmHistoryLimitFromSessionKey } from './pi-embedded-runner.js';
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
describe('getDmHistoryLimitFromSessionKey', () => {
  it('falls back to provider default when per-DM not set', () => {
    const config = {
      channels: {
        telegram: {
          dmHistoryLimit: 15,
          dms: { '456': { historyLimit: 5 } }
        }
      }
    };
    expect(getDmHistoryLimitFromSessionKey('telegram:dm:123', config)).toBe(15);
  });
  it('returns per-DM override for agent-prefixed keys', () => {
    const config = {
      channels: {
        telegram: {
          dmHistoryLimit: 20,
          dms: { '789': { historyLimit: 3 } }
        }
      }
    };
    expect(getDmHistoryLimitFromSessionKey('agent:main:telegram:dm:789', config)).toBe(3);
  });
  it('handles userId with colons (e.g., email)', () => {
    const config = {
      channels: {
        msteams: {
          dmHistoryLimit: 10,
          dms: { 'user@example.com': { historyLimit: 7 } }
        }
      }
    };
    expect(getDmHistoryLimitFromSessionKey('msteams:dm:user@example.com', config)).toBe(7);
  });
  it('returns undefined when per-DM historyLimit is not set', () => {
    const config = {
      channels: {
        telegram: {
          dms: { '123': {} }
        }
      }
    };
    expect(getDmHistoryLimitFromSessionKey('telegram:dm:123', config)).toBeUndefined();
  });
  it('returns 0 when per-DM historyLimit is explicitly 0 (unlimited)', () => {
    const config = {
      channels: {
        telegram: {
          dmHistoryLimit: 15,
          dms: { '123': { historyLimit: 0 } }
        }
      }
    };
    expect(getDmHistoryLimitFromSessionKey('telegram:dm:123', config)).toBe(0);
  });
});
