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
  it('suppresses message_end block replies when the message tool already sent', async () => {
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
      blockReplyBreak: 'message_end'
    });
    const messageText = 'This is the answer.';
    handler?.({
      type: 'tool_execution_start',
      toolName: 'message',
      toolCallId: 'tool-message-1',
      args: { action: 'send', to: '+1555', message: messageText }
    });
    await Promise.resolve();
    handler?.({
      type: 'tool_execution_end',
      toolName: 'message',
      toolCallId: 'tool-message-1',
      isError: false,
      result: 'ok'
    });
    const assistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: messageText }]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(onBlockReply).not.toHaveBeenCalled();
  });
  it('does not suppress message_end replies when message tool reports error', async () => {
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
      blockReplyBreak: 'message_end'
    });
    const messageText = 'Please retry the send.';
    handler?.({
      type: 'tool_execution_start',
      toolName: 'message',
      toolCallId: 'tool-message-err',
      args: { action: 'send', to: '+1555', message: messageText }
    });
    await Promise.resolve();
    handler?.({
      type: 'tool_execution_end',
      toolName: 'message',
      toolCallId: 'tool-message-err',
      isError: false,
      result: { details: { status: 'error' } }
    });
    const assistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: messageText }]
    };
    handler?.({ type: 'message_end', message: assistantMessage });
    expect(onBlockReply).toHaveBeenCalledTimes(1);
  });
  it('clears block reply state on message_start', () => {
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
      blockReplyBreak: 'text_end'
    });
    handler?.({ type: 'message_start', message: { role: 'assistant' } });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: { type: 'text_delta', delta: 'OK' }
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: { type: 'text_end' }
    });
    expect(onBlockReply).toHaveBeenCalledTimes(1);
    handler?.({ type: 'message_start', message: { role: 'assistant' } });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: { type: 'text_delta', delta: 'OK' }
    });
    handler?.({
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: { type: 'text_end' }
    });
    expect(onBlockReply).toHaveBeenCalledTimes(2);
  });
});
