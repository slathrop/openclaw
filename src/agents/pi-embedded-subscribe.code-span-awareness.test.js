import { describe, expect, it, vi } from 'vitest';
import { subscribeEmbeddedPiSession } from './pi-embedded-subscribe.js';
describe('subscribeEmbeddedPiSession thinking tag code span awareness', () => {
  it('does not strip thinking tags inside inline code backticks', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onPartialReply = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onPartialReply
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: 'The fix strips leaked `<thinking>` tags from messages.'
      }
    });
    expect(onPartialReply).toHaveBeenCalled();
    const lastCall = onPartialReply.mock.calls[onPartialReply.mock.calls.length - 1];
    expect(lastCall[0].text).toContain('`<thinking>`');
  });
  it('does not strip thinking tags inside fenced code blocks', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onPartialReply = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onPartialReply
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: 'Example:\n  ````\n<thinking>code example</thinking>\n  ````\nDone.'
      }
    });
    expect(onPartialReply).toHaveBeenCalled();
    const lastCall = onPartialReply.mock.calls[onPartialReply.mock.calls.length - 1];
    expect(lastCall[0].text).toContain('<thinking>code example</thinking>');
  });
  it('still strips actual thinking tags outside code spans', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onPartialReply = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onPartialReply
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: 'Hello <thinking>internal thought</thinking> world'
      }
    });
    expect(onPartialReply).toHaveBeenCalled();
    const lastCall = onPartialReply.mock.calls[onPartialReply.mock.calls.length - 1];
    expect(lastCall[0].text).not.toContain('internal thought');
    expect(lastCall[0].text).toContain('Hello');
    expect(lastCall[0].text).toContain('world');
  });
});
