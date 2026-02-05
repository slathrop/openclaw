import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetInboundDedupe } from '../auto-reply/reply/inbound-dedupe.js';
import { createTelegramBot } from './bot.js';
const { sessionStorePath } = vi.hoisted(() => ({
  sessionStorePath: `/tmp/openclaw-telegram-${Math.random().toString(16).slice(2)}.json`
}));
const { loadWebMedia } = vi.hoisted(() => ({
  loadWebMedia: vi.fn()
}));
vi.mock('../web/media.js', () => ({
  loadWebMedia
}));
const { loadConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({}))
}));
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig
  };
});
vi.mock('../config/sessions.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveStorePath: vi.fn((storePath) => storePath ?? sessionStorePath)
  };
});
const { readChannelAllowFromStore, upsertChannelPairingRequest } = vi.hoisted(() => ({
  readChannelAllowFromStore: vi.fn(async () => []),
  upsertChannelPairingRequest: vi.fn(async () => ({
    code: 'PAIRCODE',
    created: true
  }))
}));
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore,
  upsertChannelPairingRequest
}));
const useSpy = vi.fn();
const middlewareUseSpy = vi.fn();
const onSpy = vi.fn();
const stopSpy = vi.fn();
const commandSpy = vi.fn();
const botCtorSpy = vi.fn();
const answerCallbackQuerySpy = vi.fn(async () => void 0);
const sendChatActionSpy = vi.fn();
const setMessageReactionSpy = vi.fn(async () => void 0);
const setMyCommandsSpy = vi.fn(async () => void 0);
const sendMessageSpy = vi.fn(async () => ({ message_id: 77 }));
const sendAnimationSpy = vi.fn(async () => ({ message_id: 78 }));
const sendPhotoSpy = vi.fn(async () => ({ message_id: 79 }));
const apiStub = {
  config: { use: useSpy },
  answerCallbackQuery: answerCallbackQuerySpy,
  sendChatAction: sendChatActionSpy,
  setMessageReaction: setMessageReactionSpy,
  setMyCommands: setMyCommandsSpy,
  sendMessage: sendMessageSpy,
  sendAnimation: sendAnimationSpy,
  sendPhoto: sendPhotoSpy
};
vi.mock('grammy', () => ({
  Bot: class {
    constructor(token, options) {
      this.token = token;
      this.options = options;
      botCtorSpy(token, options);
    }
    api = apiStub;
    use = middlewareUseSpy;
    on = onSpy;
    stop = stopSpy;
    command = commandSpy;
    catch = vi.fn();
  },
  InputFile: class {
  },
  webhookCallback: vi.fn()
}));
const sequentializeMiddleware = vi.fn();
const sequentializeSpy = vi.fn(() => sequentializeMiddleware);
vi.mock('@grammyjs/runner', () => ({
  sequentialize: () => {
    return sequentializeSpy();
  }
}));
const throttlerSpy = vi.fn(() => 'throttler');
vi.mock('@grammyjs/transformer-throttler', () => ({
  apiThrottler: () => throttlerSpy()
}));
vi.mock('../auto-reply/reply.js', () => {
  const replySpy = vi.fn(async (_ctx, opts) => {
    await opts?.onReplyStart?.();
    return void 0;
  });
  return { getReplyFromConfig: replySpy, __replySpy: replySpy };
});
let replyModule;
const getOnHandler = (event) => {
  const handler = onSpy.mock.calls.find((call) => call[0] === event)?.[1];
  if (!handler) {
    throw new Error(`Missing handler for event: ${event}`);
  }
  return handler;
};
describe('createTelegramBot', () => {
  beforeAll(async () => {
    replyModule = await import('../auto-reply/reply.js');
  });
  beforeEach(() => {
    resetInboundDedupe();
    loadConfig.mockReturnValue({
      channels: {
        telegram: { dmPolicy: 'open', allowFrom: ['*'] }
      }
    });
    loadWebMedia.mockReset();
    sendAnimationSpy.mockReset();
    sendPhotoSpy.mockReset();
    setMessageReactionSpy.mockReset();
    answerCallbackQuerySpy.mockReset();
    setMyCommandsSpy.mockReset();
    middlewareUseSpy.mockReset();
    sequentializeSpy.mockReset();
    botCtorSpy.mockReset();
  });
  it('dedupes duplicate callback_query updates by update_id', async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: { dmPolicy: 'open', allowFrom: ['*'] }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('callback_query');
    const ctx = {
      update: { update_id: 222 },
      callbackQuery: {
        id: 'cb-1',
        data: 'ping',
        from: { id: 789, username: 'testuser' },
        message: {
          chat: { id: 123, type: 'private' },
          date: 1736380800,
          message_id: 9001
        }
      },
      me: { username: 'openclaw_bot' },
      getFile: async () => ({})
    };
    await handler(ctx);
    await handler(ctx);
    expect(replySpy).toHaveBeenCalledTimes(1);
  });
  it('allows distinct callback_query ids without update_id', async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: { dmPolicy: 'open', allowFrom: ['*'] }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('callback_query');
    await handler({
      callbackQuery: {
        id: 'cb-1',
        data: 'ping',
        from: { id: 789, username: 'testuser' },
        message: {
          chat: { id: 123, type: 'private' },
          date: 1736380800,
          message_id: 9001
        }
      },
      me: { username: 'openclaw_bot' },
      getFile: async () => ({})
    });
    await handler({
      callbackQuery: {
        id: 'cb-2',
        data: 'ping',
        from: { id: 789, username: 'testuser' },
        message: {
          chat: { id: 123, type: 'private' },
          date: 1736380800,
          message_id: 9001
        }
      },
      me: { username: 'openclaw_bot' },
      getFile: async () => ({})
    });
    expect(replySpy).toHaveBeenCalledTimes(2);
  });
});
