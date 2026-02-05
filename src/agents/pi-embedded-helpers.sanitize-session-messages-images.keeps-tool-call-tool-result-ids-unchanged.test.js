import { describe, expect, it } from 'vitest';
import { sanitizeSessionMessagesImages } from './pi-embedded-helpers.js';
describe('sanitizeSessionMessagesImages', () => {
  it('keeps tool call + tool result IDs unchanged by default', async () => {
    const input = [
      {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'call_123|fc_456',
            name: 'read',
            arguments: { path: 'package.json' }
          }
        ]
      },
      {
        role: 'toolResult',
        toolCallId: 'call_123|fc_456',
        toolName: 'read',
        content: [{ type: 'text', text: 'ok' }],
        isError: false
      }
    ];
    const out = await sanitizeSessionMessagesImages(input, 'test');
    const assistant = out[0];
    expect(assistant.role).toBe('assistant');
    expect(Array.isArray(assistant.content)).toBe(true);
    const toolCall = assistant.content.find(
      (b) => b.type === 'toolCall'
    );
    expect(toolCall?.id).toBe('call_123|fc_456');
    const toolResult = out[1];
    expect(toolResult.role).toBe('toolResult');
    expect(toolResult.toolCallId).toBe('call_123|fc_456');
  });
  it('sanitizes tool call + tool result IDs in strict mode (alphanumeric only)', async () => {
    const input = [
      {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'call_123|fc_456',
            name: 'read',
            arguments: { path: 'package.json' }
          }
        ]
      },
      {
        role: 'toolResult',
        toolCallId: 'call_123|fc_456',
        toolName: 'read',
        content: [{ type: 'text', text: 'ok' }],
        isError: false
      }
    ];
    const out = await sanitizeSessionMessagesImages(input, 'test', {
      sanitizeToolCallIds: true,
      toolCallIdMode: 'strict'
    });
    const assistant = out[0];
    expect(assistant.role).toBe('assistant');
    expect(Array.isArray(assistant.content)).toBe(true);
    const toolCall = assistant.content.find(
      (b) => b.type === 'toolCall'
    );
    expect(toolCall?.id).toBe('call123fc456');
    const toolResult = out[1];
    expect(toolResult.role).toBe('toolResult');
    expect(toolResult.toolCallId).toBe('call123fc456');
  });
  it('does not synthesize tool call input when missing', async () => {
    const input = [
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call_1', name: 'read' }]
      }
    ];
    const out = await sanitizeSessionMessagesImages(input, 'test');
    const assistant = out[0];
    const toolCall = assistant.content?.find((b) => b.type === 'toolCall');
    expect(toolCall).toBeTruthy();
    expect('input' in (toolCall ?? {})).toBe(false);
    expect('arguments' in (toolCall ?? {})).toBe(false);
  });
});
