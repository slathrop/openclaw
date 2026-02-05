const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
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
    static {
      __name(this, 'Bot');
    }
    api = apiStub;
    use = middlewareUseSpy;
    on = onSpy;
    stop = stopSpy;
    command = commandSpy;
    catch = vi.fn();
  },
  InputFile: class {
    static {
      __name(this, 'InputFile');
    }
  },
  webhookCallback: vi.fn()
}));
const sequentializeMiddleware = vi.fn();
const sequentializeSpy = vi.fn(() => sequentializeMiddleware);
vi.mock('@grammyjs/runner', () => ({
  sequentialize: /* @__PURE__ */ __name(() => {
    return sequentializeSpy();
  }, 'sequentialize')
}));
const throttlerSpy = vi.fn(() => 'throttler');
vi.mock('@grammyjs/transformer-throttler', () => ({
  apiThrottler: /* @__PURE__ */ __name(() => throttlerSpy(), 'apiThrottler')
}));
vi.mock('../auto-reply/reply.js', () => {
  const replySpy = vi.fn(async (_ctx, opts) => {
    await opts?.onReplyStart?.();
    return void 0;
  });
  return { getReplyFromConfig: replySpy, __replySpy: replySpy };
});
let replyModule;
const getOnHandler = /* @__PURE__ */ __name((event) => {
  const handler = onSpy.mock.calls.find((call) => call[0] === event)?.[1];
  if (!handler) {
    throw new Error(`Missing handler for event: ${event}`);
  }
  return handler;
}, 'getOnHandler');
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
  it("blocks all group messages when groupPolicy is 'disabled'", async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'disabled',
          allowFrom: ['123456789']
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
        from: { id: 123456789, username: 'testuser' },
        text: '@openclaw_bot hello',
        date: 1736380800
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).not.toHaveBeenCalled();
  });
  it("blocks group messages from senders not in allowFrom when groupPolicy is 'allowlist'", async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'allowlist',
          allowFrom: ['123456789']
          // Does not include sender 999999
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
        from: { id: 999999, username: 'notallowed' },
        // Not in allowFrom
        text: '@openclaw_bot hello',
        date: 1736380800
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).not.toHaveBeenCalled();
  });
  it("allows group messages from senders in allowFrom (by ID) when groupPolicy is 'allowlist'", async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'allowlist',
          allowFrom: ['123456789'],
          groups: { '*': { requireMention: false } }
          // Skip mention check
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
        from: { id: 123456789, username: 'testuser' },
        // In allowFrom
        text: 'hello',
        date: 1736380800
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).toHaveBeenCalledTimes(1);
  });
  it("allows group messages from senders in allowFrom (by username) when groupPolicy is 'allowlist'", async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'allowlist',
          allowFrom: ['@testuser'],
          // By username
          groups: { '*': { requireMention: false } }
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
        from: { id: 12345, username: 'testuser' },
        // Username matches @testuser
        text: 'hello',
        date: 1736380800
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).toHaveBeenCalledTimes(1);
  });
  it("allows group messages from telegram:-prefixed allowFrom entries when groupPolicy is 'allowlist'", async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'allowlist',
          allowFrom: ['telegram:77112533'],
          groups: { '*': { requireMention: false } }
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
        from: { id: 77112533, username: 'mneves' },
        text: 'hello',
        date: 1736380800
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).toHaveBeenCalledTimes(1);
  });
  it("allows group messages from tg:-prefixed allowFrom entries case-insensitively when groupPolicy is 'allowlist'", async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'allowlist',
          allowFrom: ['TG:77112533'],
          groups: { '*': { requireMention: false } }
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
        from: { id: 77112533, username: 'mneves' },
        text: 'hello',
        date: 1736380800
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).toHaveBeenCalledTimes(1);
  });
  it("allows all group messages when groupPolicy is 'open'", async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'open',
          groups: { '*': { requireMention: false } }
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
        from: { id: 999999, username: 'random' },
        // Random sender
        text: 'hello',
        date: 1736380800
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).toHaveBeenCalledTimes(1);
  });
});
