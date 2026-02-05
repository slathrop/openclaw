/**
 * Tests for google-shared convertTools parameter preservation and
 * convertMessages behavior with thinking blocks and consecutive messages.
 */
import { convertMessages, convertTools } from '@mariozechner/pi-ai/dist/providers/google-shared.js';
import { describe, expect, it } from 'vitest';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const asRecord = (value) => {
  expect(value).toBeTruthy();
  expect(typeof value).toBe('object');
  expect(Array.isArray(value)).toBe(false);
  return value;
};

/** @param {string} id */
const makeModel = (id) =>
  /** @type {any} */ ({
    id,
    name: id,
    api: 'google-generative-ai',
    provider: 'google',
    baseUrl: 'https://example.invalid',
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1,
    maxTokens: 1
  });

// eslint-disable-next-line no-unused-vars
const _makeGeminiCliModel = (id) =>
  /** @type {any} */ ({
    id,
    name: id,
    api: 'google-gemini-cli',
    provider: 'google-gemini-cli',
    baseUrl: 'https://example.invalid',
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1,
    maxTokens: 1
  });

describe('google-shared convertTools', () => {
  it('preserves parameters when type is missing', () => {
    const tools = /** @type {any[]} */ ([
      {
        name: 'noType',
        description: 'Tool with properties but no type',
        parameters: {
          properties: {
            action: { type: 'string' }
          },
          required: ['action']
        }
      }
    ]);

    const converted = convertTools(tools);
    const params = asRecord(converted?.[0]?.functionDeclarations?.[0]?.parameters);

    expect(params.type).toBeUndefined();
    expect(params.properties).toBeDefined();
    expect(params.required).toEqual(['action']);
  });

  it('keeps unsupported JSON Schema keywords intact', () => {
    const tools = /** @type {any[]} */ ([
      {
        name: 'example',
        description: 'Example tool',
        parameters: {
          type: 'object',
          patternProperties: {
            '^x-': { type: 'string' }
          },
          additionalProperties: false,
          properties: {
            mode: {
              type: 'string',
              const: 'fast'
            },
            options: {
              anyOf: [{ type: 'string' }, { type: 'number' }]
            },
            list: {
              type: 'array',
              items: {
                type: 'string',
                const: 'item'
              }
            }
          },
          required: ['mode']
        }
      }
    ]);

    const converted = convertTools(tools);
    const params = asRecord(converted?.[0]?.functionDeclarations?.[0]?.parameters);
    const properties = asRecord(params.properties);
    const mode = asRecord(properties.mode);
    const options = asRecord(properties.options);
    const list = asRecord(properties.list);
    const items = asRecord(list.items);

    expect(params.patternProperties).toEqual({ '^x-': { type: 'string' } });
    expect(params.additionalProperties).toBe(false);
    expect(mode.const).toBe('fast');
    expect(options.anyOf).toEqual([{ type: 'string' }, { type: 'number' }]);
    expect(items.const).toBe('item');
    expect(params.required).toEqual(['mode']);
  });

  it('keeps supported schema fields', () => {
    const tools = /** @type {any[]} */ ([
      {
        name: 'settings',
        description: 'Settings tool',
        parameters: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                retries: { type: 'number', minimum: 1 },
                tags: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['retries']
            }
          },
          required: ['config']
        }
      }
    ]);

    const converted = convertTools(tools);
    const params = asRecord(converted?.[0]?.functionDeclarations?.[0]?.parameters);
    const config = asRecord(asRecord(params.properties).config);
    const configProps = asRecord(config.properties);
    const retries = asRecord(configProps.retries);
    const tags = asRecord(configProps.tags);
    const items = asRecord(tags.items);

    expect(params.type).toBe('object');
    expect(config.type).toBe('object');
    expect(retries.minimum).toBe(1);
    expect(tags.type).toBe('array');
    expect(items.type).toBe('string');
    expect(config.required).toEqual(['retries']);
    expect(params.required).toEqual(['config']);
  });
});

describe('google-shared convertMessages', () => {
  it('keeps thinking blocks when provider/model match', () => {
    const model = makeModel('gemini-1.5-pro');
    const context = /** @type {any} */ ({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'hidden',
              thinkingSignature: 'c2ln'
            }
          ],
          api: 'google-generative-ai',
          provider: 'google',
          model: 'gemini-1.5-pro',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0
            }
          },
          stopReason: 'stop',
          timestamp: 0
        }
      ]
    });

    const contents = convertMessages(model, context);
    expect(contents).toHaveLength(1);
    expect(contents[0].role).toBe('model');
    expect(contents[0].parts?.[0]).toMatchObject({
      thought: true,
      thoughtSignature: 'c2ln'
    });
  });

  it('keeps thought signatures for Claude models', () => {
    const model = makeModel('claude-3-opus');
    const context = /** @type {any} */ ({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'structured',
              thinkingSignature: 'c2ln'
            }
          ],
          api: 'google-generative-ai',
          provider: 'google',
          model: 'claude-3-opus',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0
            }
          },
          stopReason: 'stop',
          timestamp: 0
        }
      ]
    });

    const contents = convertMessages(model, context);
    const parts = contents?.[0]?.parts ?? [];
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      thought: true,
      thoughtSignature: 'c2ln'
    });
  });

  it('does not merge consecutive user messages for Gemini', () => {
    const model = makeModel('gemini-1.5-pro');
    const context = /** @type {any} */ ({
      messages: [
        {
          role: 'user',
          content: 'Hello'
        },
        {
          role: 'user',
          content: 'How are you?'
        }
      ]
    });

    const contents = convertMessages(model, context);
    expect(contents).toHaveLength(2);
    expect(contents[0].role).toBe('user');
    expect(contents[1].role).toBe('user');
    expect(contents[0].parts).toHaveLength(1);
    expect(contents[1].parts).toHaveLength(1);
  });

  it('does not merge consecutive user messages for non-Gemini Google models', () => {
    const model = makeModel('claude-3-opus');
    const context = /** @type {any} */ ({
      messages: [
        {
          role: 'user',
          content: 'First'
        },
        {
          role: 'user',
          content: 'Second'
        }
      ]
    });

    const contents = convertMessages(model, context);
    expect(contents).toHaveLength(2);
    expect(contents[0].role).toBe('user');
    expect(contents[1].role).toBe('user');
    expect(contents[0].parts).toHaveLength(1);
    expect(contents[1].parts).toHaveLength(1);
  });

  it('does not merge consecutive model messages for Gemini', () => {
    const model = makeModel('gemini-1.5-pro');
    const context = /** @type {any} */ ({
      messages: [
        {
          role: 'user',
          content: 'Hello'
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
          api: 'google-generative-ai',
          provider: 'google',
          model: 'gemini-1.5-pro',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0
            }
          },
          stopReason: 'stop',
          timestamp: 0
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'How can I help?' }],
          api: 'google-generative-ai',
          provider: 'google',
          model: 'gemini-1.5-pro',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0
            }
          },
          stopReason: 'stop',
          timestamp: 0
        }
      ]
    });

    const contents = convertMessages(model, context);
    expect(contents).toHaveLength(3);
    expect(contents[0].role).toBe('user');
    expect(contents[1].role).toBe('model');
    expect(contents[2].role).toBe('model');
    expect(contents[1].parts).toHaveLength(1);
    expect(contents[2].parts).toHaveLength(1);
  });

  it('handles user message after tool result without model response in between', () => {
    const model = makeModel('gemini-1.5-pro');
    const context = /** @type {any} */ ({
      messages: [
        {
          role: 'user',
          content: 'Use a tool'
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              id: 'call_1',
              name: 'myTool',
              arguments: { arg: 'value' }
            }
          ],
          api: 'google-generative-ai',
          provider: 'google',
          model: 'gemini-1.5-pro',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0
            }
          },
          stopReason: 'stop',
          timestamp: 0
        },
        {
          role: 'toolResult',
          toolCallId: 'call_1',
          toolName: 'myTool',
          content: [{ type: 'text', text: 'Tool result' }],
          isError: false,
          timestamp: 0
        },
        {
          role: 'user',
          content: 'Now do something else'
        }
      ]
    });

    const contents = convertMessages(model, context);
    expect(contents).toHaveLength(4);
    expect(contents[0].role).toBe('user');
    expect(contents[1].role).toBe('model');
    expect(contents[2].role).toBe('user');
    expect(contents[3].role).toBe('user');
    const toolResponsePart = contents[2].parts?.find(
      (part) => typeof part === 'object' && part !== null && 'functionResponse' in part
    );
    const toolResponse = asRecord(toolResponsePart);
    expect(toolResponse.functionResponse).toBeTruthy();
    expect(contents[3].role).toBe('user');
  });
});
