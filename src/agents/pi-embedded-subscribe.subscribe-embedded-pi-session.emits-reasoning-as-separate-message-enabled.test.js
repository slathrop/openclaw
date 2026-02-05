import { describe, expect, it, vi } from 'vitest';
import { subscribeEmbeddedPiSession } from './pi-embedded-subscribe.js';
describe('subscribeEmbeddedPiSession', () => {
  const THINKING_TAG_CASES = [
    { tag: 'think', open: '<think>', close: '</think>' },
    { tag: 'thinking', open: '<thinking>', close: '</thinking>' },
    { tag: 'thought', open: '<thought>', close: '</thought>' },
    { tag: 'antthinking', open: '<antthinking>', close: '</antthinking>' }
  ];
  it('emits reasoning as a separate message when enabled', () => {
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
      reasoningMode: 'on'
    });
    const assistantMessage = {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'Because it helps' },
        { type: 'text', text: 'Final answer' }
      ]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(onBlockReply).toHaveBeenCalledTimes(2);
    expect(onBlockReply.mock.calls[0][0].text).toBe('Reasoning:\n_Because it helps_');
    expect(onBlockReply.mock.calls[1][0].text).toBe('Final answer');
  });
  it.each(THINKING_TAG_CASES)(
    'promotes <%s> tags to thinking blocks at write-time',
    ({ open, close }) => {
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
        reasoningMode: 'on'
      });
      const assistantMessage = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `${open}
Because it helps
${close}

Final answer`
          }
        ]
      };
      handler?.({ type: 'message_end', message: assistantMessage });
      expect(onBlockReply).toHaveBeenCalledTimes(2);
      expect(onBlockReply.mock.calls[0][0].text).toBe('Reasoning:\n_Because it helps_');
      expect(onBlockReply.mock.calls[1][0].text).toBe('Final answer');
      expect(assistantMessage.content).toEqual([
        { type: 'thinking', thinking: 'Because it helps' },
        { type: 'text', text: 'Final answer' }
      ]);
    }
  );
});
