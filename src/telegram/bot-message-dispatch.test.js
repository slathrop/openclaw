const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { beforeEach, describe, expect, it, vi } from 'vitest';
const createTelegramDraftStream = vi.hoisted(() => vi.fn());
const dispatchReplyWithBufferedBlockDispatcher = vi.hoisted(() => vi.fn());
const deliverReplies = vi.hoisted(() => vi.fn());
vi.mock('./draft-stream.js', () => ({
  createTelegramDraftStream
}));
vi.mock('../auto-reply/reply/provider-dispatcher.js', () => ({
  dispatchReplyWithBufferedBlockDispatcher
}));
vi.mock('./bot/delivery.js', () => ({
  deliverReplies
}));
vi.mock('./sticker-cache.js', () => ({
  cacheSticker: vi.fn(),
  describeStickerImage: vi.fn()
}));
import { dispatchTelegramMessage } from './bot-message-dispatch.js';
describe('dispatchTelegramMessage draft streaming', () => {
  beforeEach(() => {
    createTelegramDraftStream.mockReset();
    dispatchReplyWithBufferedBlockDispatcher.mockReset();
    deliverReplies.mockReset();
  });
  it('streams drafts in private threads and forwards thread id', async () => {
    const draftStream = {
      update: vi.fn(),
      flush: vi.fn().mockResolvedValue(void 0),
      stop: vi.fn()
    };
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: 'Hello' });
        await dispatcherOptions.deliver({ text: 'Hello' }, { kind: 'final' });
        return { queuedFinal: true };
      }
    );
    deliverReplies.mockResolvedValue({ delivered: true });
    const resolveBotTopicsEnabled = vi.fn().mockResolvedValue(true);
    const context = {
      ctxPayload: {},
      primaryCtx: { message: { chat: { id: 123, type: 'private' } } },
      msg: {
        chat: { id: 123, type: 'private' },
        message_id: 456,
        message_thread_id: 777
      },
      chatId: 123,
      isGroup: false,
      resolvedThreadId: void 0,
      replyThreadId: 777,
      threadSpec: { id: 777, scope: 'dm' },
      historyKey: void 0,
      historyLimit: 0,
      groupHistories: /* @__PURE__ */ new Map(),
      route: { agentId: 'default', accountId: 'default' },
      skillFilter: void 0,
      sendTyping: vi.fn(),
      sendRecordVoice: vi.fn(),
      ackReactionPromise: null,
      reactionApi: null,
      removeAckAfterReply: false
    };
    const bot = { api: { sendMessageDraft: vi.fn() } };
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: /* @__PURE__ */ __name(() => {
        throw new Error('exit');
      }, 'exit')
    };
    await dispatchTelegramMessage({
      context,
      bot,
      cfg: {},
      runtime,
      replyToMode: 'first',
      streamMode: 'partial',
      textLimit: 4096,
      telegramCfg: {},
      opts: { token: 'token' },
      resolveBotTopicsEnabled
    });
    expect(resolveBotTopicsEnabled).toHaveBeenCalledWith(context.primaryCtx);
    expect(createTelegramDraftStream).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 123,
        thread: { id: 777, scope: 'dm' }
      })
    );
    expect(draftStream.update).toHaveBeenCalledWith('Hello');
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        thread: { id: 777, scope: 'dm' }
      })
    );
  });
});
