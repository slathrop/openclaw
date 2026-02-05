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
  it('does not append when text_end content is a prefix of deltas', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onBlockReply = vi.fn();
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onBlockReply,
      blockReplyBreak: 'text_end'
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: 'Hello world'
      }
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_end',
        content: 'Hello'
      }
    });
    expect(onBlockReply).toHaveBeenCalledTimes(1);
    expect(subscription.assistantTexts).toEqual(['Hello world']);
  });
  it('does not append when text_end content is already contained', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onBlockReply = vi.fn();
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onBlockReply,
      blockReplyBreak: 'text_end'
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: 'Hello world'
      }
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_end',
        content: 'world'
      }
    });
    expect(onBlockReply).toHaveBeenCalledTimes(1);
    expect(subscription.assistantTexts).toEqual(['Hello world']);
  });
  it('appends suffix when text_end content extends deltas', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onBlockReply = vi.fn();
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      onBlockReply,
      blockReplyBreak: 'text_end'
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: 'Hello'
      }
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_end',
        content: 'Hello world'
      }
    });
    expect(onBlockReply).toHaveBeenCalledTimes(1);
    expect(subscription.assistantTexts).toEqual(['Hello world']);
  });
});
