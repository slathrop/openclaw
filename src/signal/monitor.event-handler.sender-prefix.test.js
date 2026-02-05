import { beforeEach, describe, expect, it, vi } from 'vitest';
const dispatchMock = vi.fn();
const readAllowFromMock = vi.fn();
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: (...args) => readAllowFromMock(...args),
  upsertChannelPairingRequest: vi.fn()
}));
describe('signal event handler sender prefix', () => {
  beforeEach(() => {
    dispatchMock.mockReset().mockImplementation(async ({ dispatcher, ctx }) => {
      dispatcher.sendFinalReply({ text: 'ok' });
      return { queuedFinal: true, counts: { tool: 0, block: 0, final: 1 }, ctx };
    });
    readAllowFromMock.mockReset().mockResolvedValue([]);
  });
  it('prefixes group bodies with sender label', async () => {
    let capturedBody = '';
    const dispatchModule = await import('../auto-reply/dispatch.js');
    vi.spyOn(dispatchModule, 'dispatchInboundMessage').mockImplementation(
      async (...args) => dispatchMock(...args)
    );
    dispatchMock.mockImplementationOnce(async ({ dispatcher, ctx }) => {
      capturedBody = ctx.Body ?? '';
      dispatcher.sendFinalReply({ text: 'ok' });
      return { queuedFinal: true, counts: { tool: 0, block: 0, final: 1 } };
    });
    const { createSignalEventHandler } = await import('./monitor/event-handler.js');
    const handler = createSignalEventHandler({
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
        exit: (code) => {
          throw new Error(`exit ${code}`);
        }
      },
      cfg: {
        agents: { defaults: { model: 'anthropic/claude-opus-4-5', workspace: '/tmp/openclaw' } },
        channels: { signal: {} }
      },
      baseUrl: 'http://localhost',
      account: '+15550009999',
      accountId: 'default',
      blockStreaming: false,
      historyLimit: 0,
      groupHistories: /* @__PURE__ */ new Map(),
      textLimit: 4e3,
      dmPolicy: 'open',
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: 'open',
      reactionMode: 'off',
      reactionAllowlist: [],
      mediaMaxBytes: 1e3,
      ignoreAttachments: true,
      sendReadReceipts: false,
      readReceiptsViaDaemon: false,
      fetchAttachment: async () => null,
      deliverReplies: async () => void 0,
      resolveSignalReactionTargets: () => [],
      isSignalReactionMessage: () => false,
      shouldEmitSignalReactionNotification: () => false,
      buildSignalReactionSystemEventText: () => ''
    });
    const payload = {
      envelope: {
        sourceNumber: '+15550002222',
        sourceName: 'Alice',
        timestamp: 17e11,
        dataMessage: {
          message: 'hello',
          groupInfo: { groupId: 'group-1', groupName: 'Test Group' }
        }
      }
    };
    await handler({ event: 'receive', data: JSON.stringify(payload) });
    expect(dispatchMock).toHaveBeenCalled();
    expect(capturedBody).toContain('Alice (+15550002222): hello');
  });
});
