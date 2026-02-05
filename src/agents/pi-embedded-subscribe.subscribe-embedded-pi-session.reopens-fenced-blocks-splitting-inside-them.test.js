import { describe, expect, it, vi } from 'vitest';
import { subscribeEmbeddedPiSession } from './pi-embedded-subscribe.js';
describe('subscribeEmbeddedPiSession', () => {
  // eslint-disable-next-line no-unused-vars
  const _THINKING_TAG_CASES = [
    { tag: 'think', open: '<think>', close: '</think>' },
    { tag: 'thinking', open: '<thinking>', close: '</thinking>' },
    { tag: 'thought', open: '<thought>', close: '</thought>' },
    { tag: 'antthinking', open: '<antthinking>', close: '</antthinking>' }
  ];
  it('reopens fenced blocks when splitting inside them', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onBlockReply = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onBlockReply,
      blockReplyBreak: 'message_end',
      blockReplyChunking: {
        minChars: 10,
        maxChars: 30,
        breakPreference: 'paragraph'
      }
    });
    const text = `\`\`\`txt
${'a'.repeat(80)}
\`\`\``;
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: text
      }
    });
    const assistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text }]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(onBlockReply.mock.calls.length).toBeGreaterThan(1);
    for (const call of onBlockReply.mock.calls) {
      const chunk = call[0].text;
      expect(chunk.startsWith('```txt')).toBe(true);
      const fenceCount = chunk.match(/```/g)?.length ?? 0;
      expect(fenceCount).toBeGreaterThanOrEqual(2);
    }
  });
  it('avoids splitting inside tilde fences', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onBlockReply = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onBlockReply,
      blockReplyBreak: 'message_end',
      blockReplyChunking: {
        minChars: 5,
        maxChars: 25,
        breakPreference: 'paragraph'
      }
    });
    const text = 'Intro\n\n~~~sh\nline1\nline2\n~~~\n\nOutro';
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: text
      }
    });
    const assistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text }]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(onBlockReply).toHaveBeenCalledTimes(3);
    expect(onBlockReply.mock.calls[1][0].text).toBe('~~~sh\nline1\nline2\n~~~');
  });
});
