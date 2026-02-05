import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestCtx } from './test-ctx.js';
const mocks = vi.hoisted(() => ({
  routeReply: vi.fn(async () => ({ ok: true, messageId: 'mock' })),
  tryFastAbortFromMessage: vi.fn(async () => ({
    handled: false,
    aborted: false
  }))
}));
const diagnosticMocks = vi.hoisted(() => ({
  logMessageQueued: vi.fn(),
  logMessageProcessed: vi.fn(),
  logSessionStateChange: vi.fn()
}));
const hookMocks = vi.hoisted(() => ({
  runner: {
    hasHooks: vi.fn(() => false),
    runMessageReceived: vi.fn(async () => {
    })
  }
}));
vi.mock('./route-reply.js', () => ({
  isRoutableChannel: (channel) => Boolean(
    channel && ['telegram', 'slack', 'discord', 'signal', 'imessage', 'whatsapp'].includes(channel)
  ),
  routeReply: mocks.routeReply
}));
vi.mock('./abort.js', () => ({
  tryFastAbortFromMessage: mocks.tryFastAbortFromMessage,
  formatAbortReplyText: (stoppedSubagents) => {
    if (typeof stoppedSubagents !== 'number' || stoppedSubagents <= 0) {
      return '\u2699\uFE0F Agent was aborted.';
    }
    const label = stoppedSubagents === 1 ? 'sub-agent' : 'sub-agents';
    return `\u2699\uFE0F Agent was aborted. Stopped ${stoppedSubagents} ${label}.`;
  }
}));
vi.mock('../../logging/diagnostic.js', () => ({
  logMessageQueued: diagnosticMocks.logMessageQueued,
  logMessageProcessed: diagnosticMocks.logMessageProcessed,
  logSessionStateChange: diagnosticMocks.logSessionStateChange
}));
vi.mock('../../plugins/hook-runner-global.js', () => ({
  getGlobalHookRunner: () => hookMocks.runner
}));
const { dispatchReplyFromConfig } = await import('./dispatch-from-config.js');
const { resetInboundDedupe } = await import('./inbound-dedupe.js');
function createDispatcher() {
  return {
    sendToolResult: vi.fn(() => true),
    sendBlockReply: vi.fn(() => true),
    sendFinalReply: vi.fn(() => true),
    waitForIdle: vi.fn(async () => {
    }),
    getQueuedCounts: vi.fn(() => ({ tool: 0, block: 0, final: 0 }))
  };
}
describe('dispatchReplyFromConfig', () => {
  beforeEach(() => {
    resetInboundDedupe();
    diagnosticMocks.logMessageQueued.mockReset();
    diagnosticMocks.logMessageProcessed.mockReset();
    diagnosticMocks.logSessionStateChange.mockReset();
    hookMocks.runner.hasHooks.mockReset();
    hookMocks.runner.hasHooks.mockReturnValue(false);
    hookMocks.runner.runMessageReceived.mockReset();
  });
  it('does not route when Provider matches OriginatingChannel (even if Surface is missing)', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    mocks.routeReply.mockClear();
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'slack',
      Surface: void 0,
      OriginatingChannel: 'slack',
      OriginatingTo: 'channel:C123'
    });
     
     
    // eslint-disable-next-line no-unused-vars
    const replyResolver = async (_ctx, _opts, _cfg) => ({ text: 'hi' });
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(mocks.routeReply).not.toHaveBeenCalled();
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });
  it('routes when OriginatingChannel differs from Provider', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    mocks.routeReply.mockClear();
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'slack',
      AccountId: 'acc-1',
      MessageThreadId: 123,
      OriginatingChannel: 'telegram',
      OriginatingTo: 'telegram:999'
    });
     
     
    // eslint-disable-next-line no-unused-vars
    const replyResolver = async (_ctx, _opts, _cfg) => ({ text: 'hi' });
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'telegram',
        to: 'telegram:999',
        accountId: 'acc-1',
        threadId: 123
      })
    );
  });
  it('provides onToolResult in DM sessions', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    mocks.routeReply.mockClear();
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'telegram',
      ChatType: 'direct'
    });
    // eslint-disable-next-line no-unused-vars
    const replyResolver = async (_ctx, opts, _cfg) => {
      expect(opts?.onToolResult).toBeDefined();
      expect(typeof opts?.onToolResult).toBe('function');
      return { text: 'hi' };
    };
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });
  it('does not provide onToolResult in group sessions', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'telegram',
      ChatType: 'group'
    });
    // eslint-disable-next-line no-unused-vars
    const replyResolver = async (_ctx, opts, _cfg) => {
      expect(opts?.onToolResult).toBeUndefined();
      return { text: 'hi' };
    };
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });
  it('sends tool results via dispatcher in DM sessions', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'telegram',
      ChatType: 'direct'
    });
    // eslint-disable-next-line no-unused-vars
    const replyResolver = async (_ctx, opts, _cfg) => {
      await opts?.onToolResult?.({ text: '\u{1F527} exec: ls' });
      return { text: 'done' };
    };
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendToolResult).toHaveBeenCalledWith(
      expect.objectContaining({ text: '\u{1F527} exec: ls' })
    );
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });
  it('does not provide onToolResult for native slash commands', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'telegram',
      ChatType: 'direct',
      CommandSource: 'native'
    });
    // eslint-disable-next-line no-unused-vars
    const replyResolver = async (_ctx, opts, _cfg) => {
      expect(opts?.onToolResult).toBeUndefined();
      return { text: 'hi' };
    };
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });
  it('fast-aborts without calling the reply resolver', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: true,
      aborted: true
    });
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'telegram',
      Body: '/stop'
    });
    const replyResolver = vi.fn(async () => ({ text: 'hi' }));
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(replyResolver).not.toHaveBeenCalled();
    expect(dispatcher.sendFinalReply).toHaveBeenCalledWith({
      text: '\u2699\uFE0F Agent was aborted.'
    });
  });
  it('fast-abort reply includes stopped subagent count when provided', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: true,
      aborted: true,
      stoppedSubagents: 2
    });
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'telegram',
      Body: '/stop'
    });
    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher,
      replyResolver: vi.fn(async () => ({ text: 'hi' }))
    });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledWith({
      text: '\u2699\uFE0F Agent was aborted. Stopped 2 sub-agents.'
    });
  });
  it('deduplicates inbound messages by MessageSid and origin', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    const cfg = {};
    const ctx = buildTestCtx({
      Provider: 'whatsapp',
      OriginatingChannel: 'whatsapp',
      OriginatingTo: 'whatsapp:+15555550123',
      MessageSid: 'msg-1'
    });
    const replyResolver = vi.fn(async () => ({ text: 'hi' }));
    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver
    });
    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver
    });
    expect(replyResolver).toHaveBeenCalledTimes(1);
  });
  it('emits message_received hook with originating channel metadata', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    hookMocks.runner.hasHooks.mockReturnValue(true);
    const cfg = {};
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'slack',
      Surface: 'slack',
      OriginatingChannel: 'Telegram',
      OriginatingTo: 'telegram:999',
      CommandBody: '/search hello',
      RawBody: 'raw text',
      Body: 'body text',
      Timestamp: 171e10,
      MessageSidFull: 'sid-full',
      SenderId: 'user-1',
      SenderName: 'Alice',
      SenderUsername: 'alice',
      SenderE164: '+15555550123',
      AccountId: 'acc-1'
    });
    const replyResolver = async () => ({ text: 'hi' });
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(hookMocks.runner.runMessageReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        from: ctx.From,
        content: '/search hello',
        timestamp: 171e10,
        metadata: expect.objectContaining({
          originatingChannel: 'Telegram',
          originatingTo: 'telegram:999',
          messageId: 'sid-full',
          senderId: 'user-1',
          senderName: 'Alice',
          senderUsername: 'alice',
          senderE164: '+15555550123'
        })
      }),
      expect.objectContaining({
        channelId: 'telegram',
        accountId: 'acc-1',
        conversationId: 'telegram:999'
      })
    );
  });
  it('emits diagnostics when enabled', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    const cfg = { diagnostics: { enabled: true } };
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: 'slack',
      Surface: 'slack',
      SessionKey: 'agent:main:main',
      MessageSid: 'msg-1',
      To: 'slack:C123'
    });
    const replyResolver = async () => ({ text: 'hi' });
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(diagnosticMocks.logMessageQueued).toHaveBeenCalledTimes(1);
    expect(diagnosticMocks.logSessionStateChange).toHaveBeenCalledWith({
      sessionKey: 'agent:main:main',
      state: 'processing',
      reason: 'message_start'
    });
    expect(diagnosticMocks.logMessageProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'slack',
        outcome: 'completed',
        sessionKey: 'agent:main:main'
      })
    );
  });
  it('marks diagnostics skipped for duplicate inbound messages', async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false
    });
    const cfg = { diagnostics: { enabled: true } };
    const ctx = buildTestCtx({
      Provider: 'whatsapp',
      OriginatingChannel: 'whatsapp',
      OriginatingTo: 'whatsapp:+15555550123',
      MessageSid: 'msg-dup'
    });
    const replyResolver = vi.fn(async () => ({ text: 'hi' }));
    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver
    });
    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver
    });
    expect(replyResolver).toHaveBeenCalledTimes(1);
    expect(diagnosticMocks.logMessageProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        outcome: 'skipped',
        reason: 'duplicate'
      })
    );
  });
});
