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
  it('keeps indented fenced blocks intact', () => {
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
        maxChars: 30,
        breakPreference: 'paragraph'
      }
    });
    const text = 'Intro\n\n  ```js\n  const x = 1;\n  ```\n\nOutro';
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
    expect(onBlockReply.mock.calls[1][0].text).toBe('  ```js\n  const x = 1;\n  ```');
  });
  it('accepts longer fence markers for close', () => {
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
    const text = 'Intro\n\n````md\nline1\nline2\n````\n\nOutro';
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
    const payloadTexts = onBlockReply.mock.calls.map((call) => call[0]?.text).filter((value) => typeof value === 'string');
    expect(payloadTexts.length).toBeGreaterThan(0);
    const combined = payloadTexts.join(' ').replace(/\s+/g, ' ').trim();
    expect(combined).toContain('````md');
    expect(combined).toContain('line1');
    expect(combined).toContain('line2');
    expect(combined).toContain('````');
    expect(combined).toContain('Intro');
    expect(combined).toContain('Outro');
  });
});
