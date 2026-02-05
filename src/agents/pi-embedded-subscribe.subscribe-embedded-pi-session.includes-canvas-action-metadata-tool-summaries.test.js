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
  it('includes canvas action metadata in tool summaries', async () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onToolResult = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run-canvas-tool',
      verboseLevel: 'on',
      onToolResult
    });
    handler?.({
      type: 'tool_execution_start',
      toolName: 'canvas',
      toolCallId: 'tool-canvas-1',
      args: { action: 'a2ui_push', jsonlPath: '/tmp/a2ui.jsonl' }
    });
    await Promise.resolve();
    expect(onToolResult).toHaveBeenCalledTimes(1);
    const payload = onToolResult.mock.calls[0][0];
    expect(payload.text).toContain('\u{1F5BC}\uFE0F');
    expect(payload.text).toContain('Canvas');
    expect(payload.text).toContain('A2UI push');
    expect(payload.text).toContain('/tmp/a2ui.jsonl');
  });
  it('skips tool summaries when shouldEmitToolResult is false', () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onToolResult = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run-tool-off',
      shouldEmitToolResult: () => false,
      onToolResult
    });
    handler?.({
      type: 'tool_execution_start',
      toolName: 'read',
      toolCallId: 'tool-2',
      args: { path: '/tmp/b.txt' }
    });
    expect(onToolResult).not.toHaveBeenCalled();
  });
  it('emits tool summaries when shouldEmitToolResult overrides verbose', async () => {
    let handler;
    const session = {
      subscribe: (fn) => {
        handler = fn;
        return () => {
        };
      }
    };
    const onToolResult = vi.fn();
    subscribeEmbeddedPiSession({
      session,
      runId: 'run-tool-override',
      verboseLevel: 'off',
      shouldEmitToolResult: () => true,
      onToolResult
    });
    handler?.({
      type: 'tool_execution_start',
      toolName: 'read',
      toolCallId: 'tool-3',
      args: { path: '/tmp/c.txt' }
    });
    await Promise.resolve();
    expect(onToolResult).toHaveBeenCalledTimes(1);
  });
});
