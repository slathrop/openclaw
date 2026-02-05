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
  it('does not call onBlockReplyFlush when callback is not provided', () => {
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
      runId: 'run-no-flush',
      onBlockReply,
      blockReplyBreak: 'text_end'
    });
    expect(() => {
      handler?.({
        type: 'tool_execution_start',
        toolName: 'bash',
        toolCallId: 'tool-no-flush',
        args: { command: 'echo test' }
      });
    }).not.toThrow();
  });
});
