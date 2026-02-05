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
  it('splits long single-line fenced blocks with reopen/close', () => {
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
        maxChars: 40,
        breakPreference: 'paragraph'
      }
    });
    const text = `\`\`\`json
${'x'.repeat(120)}
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
      expect(chunk.startsWith('```json')).toBe(true);
      const fenceCount = chunk.match(/```/g)?.length ?? 0;
      expect(fenceCount).toBeGreaterThanOrEqual(2);
    }
  });
  it('waits for auto-compaction retry and clears buffered text', async () => {
    const listeners = [];
    const session = {
      subscribe: (listener) => {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        };
      }
    };
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run-1'
    });
    const assistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'oops' }]
    };
    for (const listener of listeners) {
      listener({ type: 'message_end', message: assistantMessage });
    }
    expect(subscription.assistantTexts.length).toBe(1);
    for (const listener of listeners) {
      listener({
        type: 'auto_compaction_end',
        willRetry: true
      });
    }
    expect(subscription.isCompacting()).toBe(true);
    expect(subscription.assistantTexts.length).toBe(0);
    let resolved = false;
    const waitPromise = subscription.waitForCompactionRetry().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    for (const listener of listeners) {
      listener({ type: 'agent_end' });
    }
    await waitPromise;
    expect(resolved).toBe(true);
  });
  it('resolves after compaction ends without retry', async () => {
    const listeners = [];
    const session = {
      subscribe: (listener) => {
        listeners.push(listener);
        return () => {
        };
      }
    };
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: 'run-2'
    });
    for (const listener of listeners) {
      listener({ type: 'auto_compaction_start' });
    }
    expect(subscription.isCompacting()).toBe(true);
    let resolved = false;
    const waitPromise = subscription.waitForCompactionRetry().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    for (const listener of listeners) {
      listener({ type: 'auto_compaction_end', willRetry: false });
    }
    await waitPromise;
    expect(resolved).toBe(true);
    expect(subscription.isCompacting()).toBe(false);
  });
});
