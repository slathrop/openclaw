import { describe, expect, it, vi } from 'vitest';
import { expectInboundContextContract } from '../../../test/helpers/inbound-contract.js';
let capturedCtx;
vi.mock('../../auto-reply/dispatch.js', async (importOriginal) => {
  const actual = await importOriginal();
  const dispatchInboundMessage = vi.fn(async (params) => {
    capturedCtx = params.ctx;
    return { queuedFinal: false, counts: { tool: 0, block: 0, final: 0 } };
  });
  return {
    ...actual,
    dispatchInboundMessage,
    dispatchInboundMessageWithDispatcher: dispatchInboundMessage,
    dispatchInboundMessageWithBufferedDispatcher: dispatchInboundMessage
  };
});
import { createSignalEventHandler } from './event-handler.js';
describe('signal createSignalEventHandler inbound contract', () => {
  it('passes a finalized MsgContext to dispatchInboundMessage', async () => {
    capturedCtx = void 0;
    const handler = createSignalEventHandler({
      // oxlint-disable-next-line typescript/no-explicit-any
      runtime: { log: () => {
      }, error: () => {
      } },
      // oxlint-disable-next-line typescript/no-explicit-any
      cfg: { messages: { inbound: { debounceMs: 0 } } },
      baseUrl: 'http://localhost',
      accountId: 'default',
      historyLimit: 0,
      groupHistories: /* @__PURE__ */ new Map(),
      textLimit: 4e3,
      dmPolicy: 'open',
      allowFrom: ['*'],
      groupAllowFrom: ['*'],
      groupPolicy: 'open',
      reactionMode: 'off',
      reactionAllowlist: [],
      mediaMaxBytes: 1024,
      ignoreAttachments: true,
      sendReadReceipts: false,
      readReceiptsViaDaemon: false,
      fetchAttachment: async () => null,
      deliverReplies: async () => {
      },
      resolveSignalReactionTargets: () => [],
      // oxlint-disable-next-line typescript/no-explicit-any
      isSignalReactionMessage: () => false,
      shouldEmitSignalReactionNotification: () => false,
      buildSignalReactionSystemEventText: () => 'reaction'
    });
    await handler({
      event: 'receive',
      data: JSON.stringify({
        envelope: {
          sourceNumber: '+15550001111',
          sourceName: 'Alice',
          timestamp: 17e11,
          dataMessage: {
            message: 'hi',
            attachments: [],
            groupInfo: { groupId: 'g1', groupName: 'Test Group' }
          }
        }
      })
    });
    expect(capturedCtx).toBeTruthy();
    expectInboundContextContract(capturedCtx);
    expect(String(capturedCtx?.Body ?? '')).toContain('Alice');
    expect(String(capturedCtx?.Body ?? '')).toMatch(/Alice.*:/);
    expect(String(capturedCtx?.Body ?? '')).not.toContain('[from:');
  });
});
