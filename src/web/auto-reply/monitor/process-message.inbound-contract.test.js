import { describe, expect, it, vi } from 'vitest';
import { expectInboundContextContract } from '../../../../test/helpers/inbound-contract.js';
let capturedCtx;
vi.mock('../../../auto-reply/reply/provider-dispatcher.js', () => ({
  dispatchReplyWithBufferedBlockDispatcher: vi.fn(async (params) => {
    capturedCtx = params.ctx;
    return { queuedFinal: false };
  })
}));
import { processMessage } from './process-message.js';
describe('web processMessage inbound contract', () => {
  it('passes a finalized MsgContext to the dispatcher', async () => {
    capturedCtx = void 0;
    await processMessage({
      // oxlint-disable-next-line typescript/no-explicit-any
      cfg: { messages: {} },
      msg: {
        id: 'msg1',
        from: '123@g.us',
        to: '+15550001111',
        chatType: 'group',
        body: 'hi',
        senderName: 'Alice',
        senderJid: 'alice@s.whatsapp.net',
        senderE164: '+15550002222',
        groupSubject: 'Test Group',
        groupParticipants: []
        // oxlint-disable-next-line typescript/no-explicit-any
      },
      route: {
        agentId: 'main',
        accountId: 'default',
        sessionKey: 'agent:main:whatsapp:group:123'
        // oxlint-disable-next-line typescript/no-explicit-any
      },
      groupHistoryKey: '123@g.us',
      groupHistories: /* @__PURE__ */ new Map(),
      groupMemberNames: /* @__PURE__ */ new Map(),
      connectionId: 'conn',
      verbose: false,
      maxMediaBytes: 1,
      // oxlint-disable-next-line typescript/no-explicit-any
      replyResolver: (async () => void 0),
      // oxlint-disable-next-line typescript/no-explicit-any
      replyLogger: { info: () => {
      }, warn: () => {
      }, error: () => {
      }, debug: () => {
      } },
      backgroundTasks: /* @__PURE__ */ new Set(),
      // eslint-disable-next-line no-unused-vars
      rememberSentText: (_text, _opts) => {
      },
      echoHas: () => false,
      echoForget: () => {
      },
      buildCombinedEchoKey: () => 'echo',
      groupHistory: []
      // oxlint-disable-next-line typescript/no-explicit-any
    });
    expect(capturedCtx).toBeTruthy();
    expectInboundContextContract(capturedCtx);
  });
});
