/**
 * Tests for google-shared convertMessages ensuring function calls
 * come after user turns and tool call/response ID stripping for gemini-cli.
 */
import { convertMessages } from '@mariozechner/pi-ai/dist/providers/google-shared.js';
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

/** @param {string} id */
const makeGeminiCliModel = (id) =>
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
  it('ensures function call comes after user turn, not after model turn', () => {
    const model = makeModel('gemini-1.5-pro');
    const context = /** @type {any} */ ({
      messages: [
        {
          role: 'user',
          content: 'Hello'
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi!' }],
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
          content: [
            {
              type: 'toolCall',
              id: 'call_1',
              name: 'myTool',
              arguments: {}
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
    expect(contents).toHaveLength(3);
    expect(contents[0].role).toBe('user');
    expect(contents[1].role).toBe('model');
    expect(contents[2].role).toBe('model');
    const toolCallPart = contents[2].parts?.find(
      (part) => typeof part === 'object' && part !== null && 'functionCall' in part
    );
    const toolCall = asRecord(toolCallPart);
    expect(toolCall.functionCall).toBeTruthy();
  });

  it('strips tool call and response ids for google-gemini-cli', () => {
    const model = makeGeminiCliModel('gemini-3-flash');
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
              arguments: { arg: 'value' },
              thoughtSignature: 'dGVzdA=='
            }
          ],
          api: 'google-gemini-cli',
          provider: 'google-gemini-cli',
          model: 'gemini-3-flash',
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
        }
      ]
    });

    const contents = convertMessages(model, context);
    const parts = contents.flatMap((content) => content.parts ?? []);
    const toolCallPart = parts.find(
      (part) => typeof part === 'object' && part !== null && 'functionCall' in part
    );
    const toolResponsePart = parts.find(
      (part) => typeof part === 'object' && part !== null && 'functionResponse' in part
    );

    const toolCall = asRecord(toolCallPart);
    const toolResponse = asRecord(toolResponsePart);

    expect(asRecord(toolCall.functionCall).id).toBeUndefined();
    expect(asRecord(toolResponse.functionResponse).id).toBeUndefined();
  });
});
