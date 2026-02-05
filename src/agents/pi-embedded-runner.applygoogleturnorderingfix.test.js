import { SessionManager } from '@mariozechner/pi-coding-agent';
import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { ensureOpenClawModelsJson } from './models-config.js';
import { applyGoogleTurnOrderingFix } from './pi-embedded-runner.js';
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
describe('applyGoogleTurnOrderingFix', () => {
  const makeAssistantFirst = () => [
    {
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call_1', name: 'exec', arguments: {} }]
    }
  ];
  it('prepends a bootstrap once and records a marker for Google models', () => {
    const sessionManager = SessionManager.inMemory();
    const warn = vi.fn();
    const input = makeAssistantFirst();
    const first = applyGoogleTurnOrderingFix({
      messages: input,
      modelApi: 'google-generative-ai',
      sessionManager,
      sessionId: 'session:1',
      warn
    });
    expect(first.messages[0]?.role).toBe('user');
    expect(first.messages[1]?.role).toBe('assistant');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(
      sessionManager.getEntries().some(
        (entry) => entry.type === 'custom' && entry.customType === 'google-turn-ordering-bootstrap'
      )
    ).toBe(true);
    applyGoogleTurnOrderingFix({
      messages: input,
      modelApi: 'google-generative-ai',
      sessionManager,
      sessionId: 'session:1',
      warn
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('skips non-Google models', () => {
    const sessionManager = SessionManager.inMemory();
    const warn = vi.fn();
    const input = makeAssistantFirst();
    const result = applyGoogleTurnOrderingFix({
      messages: input,
      modelApi: 'openai',
      sessionManager,
      sessionId: 'session:2',
      warn
    });
    expect(result.messages).toBe(input);
    expect(warn).not.toHaveBeenCalled();
  });
});
