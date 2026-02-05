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
  it('does not emit duplicate block replies when text_end repeats', () => {
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
        delta: 'Hello block'
      }
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_end'
      }
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_end'
      }
    });
    expect(onBlockReply).toHaveBeenCalledTimes(1);
    expect(subscription.assistantTexts).toEqual(['Hello block']);
  });
  it('does not duplicate assistantTexts when message_end repeats', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run'
    });
    const assistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello world' }]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(subscription.assistantTexts).toEqual(['Hello world']);
  });
  it('does not duplicate assistantTexts when message_end repeats with trailing whitespace changes', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run'
    });
    const assistantMessageWithNewline = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello world\n' }]
    };
    const assistantMessageTrimmed = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello world' }]
    };
    handler?.({ type: 'message_end', message: assistantMessageWithNewline });
    handler?.({ type: 'message_end', message: assistantMessageTrimmed });
    expect(subscription.assistantTexts).toEqual(['Hello world']);
  });
  it('does not duplicate assistantTexts when message_end repeats with reasoning blocks', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      reasoningMode: 'on'
    });
    const assistantMessage = {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'Because' },
        { type: 'text', text: 'Hello world' }
      ]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(subscription.assistantTexts).toEqual(['Hello world']);
  });
  it('populates assistantTexts for non-streaming models with chunking enabled', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run',
      blockReplyChunking: { minChars: 50, maxChars: 200 }
      // Chunking enabled
    });
    handler?.({ type: 'message_start', message: { role: 'assistant' } });
    const assistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Response from non-streaming model' }]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(subscription.assistantTexts).toEqual(['Response from non-streaming model']);
  });
});
