import { AssistantMessageEventStream } from '@mariozechner/pi-ai';
import { describe, expect, it } from 'vitest';
import { applyExtraParamsToAgent, resolveExtraParams } from './pi-embedded-runner.js';
describe('resolveExtraParams', () => {
  it('returns undefined with no model config', () => {
    const result = resolveExtraParams({
      cfg: void 0,
      provider: 'zai',
      modelId: 'glm-4.7'
    });
    expect(result).toBeUndefined();
  });
  it('returns params for exact provider/model key', () => {
    const result = resolveExtraParams({
      cfg: {
        agents: {
          defaults: {
            models: {
              'openai/gpt-4': {
                params: {
                  temperature: 0.7,
                  maxTokens: 2048
                }
              }
            }
          }
        }
      },
      provider: 'openai',
      modelId: 'gpt-4'
    });
    expect(result).toEqual({
      temperature: 0.7,
      maxTokens: 2048
    });
  });
  it('ignores unrelated model entries', () => {
    const result = resolveExtraParams({
      cfg: {
        agents: {
          defaults: {
            models: {
              'openai/gpt-4': {
                params: {
                  temperature: 0.7
                }
              }
            }
          }
        }
      },
      provider: 'openai',
      modelId: 'gpt-4.1-mini'
    });
    expect(result).toBeUndefined();
  });
});
describe('applyExtraParamsToAgent', () => {
  it('adds OpenRouter attribution headers to stream options', () => {
    const calls = [];
    const baseStreamFn = (_model, _context, options) => {
      calls.push(options);
      return new AssistantMessageEventStream();
    };
    const agent = { streamFn: baseStreamFn };
    applyExtraParamsToAgent(agent, void 0, 'openrouter', 'openrouter/auto');
    const model = {
      api: 'openai-completions',
      provider: 'openrouter',
      id: 'openrouter/auto'
    };
    const context = { messages: [] };
    void agent.streamFn?.(model, context, { headers: { 'X-Custom': '1' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers).toEqual({
      'HTTP-Referer': 'https://openclaw.ai',
      'X-Title': 'OpenClaw',
      'X-Custom': '1'
    });
  });
});
