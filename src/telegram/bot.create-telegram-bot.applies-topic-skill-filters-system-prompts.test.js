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
  it('applies topic skill filters and system prompts', async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          groupPolicy: 'open',
          groups: {
            '-1001234567890': {
              requireMention: false,
              systemPrompt: 'Group prompt',
              skills: ['group-skill'],
              topics: {
                '99': {
                  skills: [],
                  systemPrompt: 'Topic prompt'
                }
              }
            }
          }
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    await handler({
      message: {
        chat: {
          id: -1001234567890,
          type: 'supergroup',
          title: 'Forum Group',
          is_forum: true
        },
        from: { id: 12345, username: 'testuser' },
        text: 'hello',
        date: 1736380800,
        message_id: 42,
        message_thread_id: 99
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(replySpy).toHaveBeenCalledTimes(1);
    const payload = replySpy.mock.calls[0][0];
    expect(payload.GroupSystemPrompt).toBe('Group prompt\n\nTopic prompt');
    const opts = replySpy.mock.calls[0][1];
    expect(opts?.skillFilter).toEqual([]);
  });
  it('passes message_thread_id to topic replies', async () => {
    onSpy.mockReset();
    sendMessageSpy.mockReset();
    commandSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    replySpy.mockResolvedValue({ text: 'response' });
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
        chat: {
          id: -1001234567890,
          type: 'supergroup',
          title: 'Forum Group',
          is_forum: true
        },
        from: { id: 12345, username: 'testuser' },
        text: 'hello',
        date: 1736380800,
        message_id: 42,
        message_thread_id: 99
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    });
    expect(sendMessageSpy).toHaveBeenCalledWith(
      '-1001234567890',
      expect.any(String),
      expect.objectContaining({ message_thread_id: 99 })
    );
  });
  it('threads native command replies inside topics', async () => {
    onSpy.mockReset();
    sendMessageSpy.mockReset();
    commandSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    replySpy.mockResolvedValue({ text: 'response' });
    loadConfig.mockReturnValue({
      commands: { native: true },
      channels: {
        telegram: {
          dmPolicy: 'open',
          allowFrom: ['*'],
          groups: { '*': { requireMention: false } }
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    expect(commandSpy).toHaveBeenCalled();
    const handler = commandSpy.mock.calls[0][1];
    await handler({
      message: {
        chat: {
          id: -1001234567890,
          type: 'supergroup',
          title: 'Forum Group',
          is_forum: true
        },
        from: { id: 12345, username: 'testuser' },
        text: '/status',
        date: 1736380800,
        message_id: 42,
        message_thread_id: 99
      },
      match: ''
    });
    expect(sendMessageSpy).toHaveBeenCalledWith(
      '-1001234567890',
      expect.any(String),
      expect.objectContaining({ message_thread_id: 99 })
    );
  });
  it('skips tool summaries for native slash commands', async () => {
    onSpy.mockReset();
    sendMessageSpy.mockReset();
    commandSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    replySpy.mockImplementation(async (_ctx, opts) => {
      await opts?.onToolResult?.({ text: 'tool update' });
      return { text: 'final reply' };
    });
    loadConfig.mockReturnValue({
      commands: { native: true },
      channels: {
        telegram: {
          dmPolicy: 'open',
          allowFrom: ['*']
        }
      }
    });
    createTelegramBot({ token: 'tok' });
    const verboseHandler = commandSpy.mock.calls.find((call) => call[0] === 'verbose')?.[1];
    if (!verboseHandler) {
      throw new Error('verbose command handler missing');
    }
    await verboseHandler({
      message: {
        chat: { id: 12345, type: 'private' },
        from: { id: 12345, username: 'testuser' },
        text: '/verbose on',
        date: 1736380800,
        message_id: 42
      },
      match: 'on'
    });
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0]?.[1]).toContain('final reply');
  });
  it('dedupes duplicate message updates by update_id', async () => {
    onSpy.mockReset();
    const replySpy = replyModule.__replySpy;
    replySpy.mockReset();
    loadConfig.mockReturnValue({
      channels: {
        telegram: { dmPolicy: 'open', allowFrom: ['*'] }
      }
    });
    createTelegramBot({ token: 'tok' });
    const handler = getOnHandler('message');
    const ctx = {
      update: { update_id: 111 },
      message: {
        chat: { id: 123, type: 'private' },
        from: { id: 456, username: 'testuser' },
        text: 'hello',
        date: 1736380800,
        message_id: 42
      },
      me: { username: 'openclaw_bot' },
      getFile: /* @__PURE__ */ __name(async () => ({ download: /* @__PURE__ */ __name(async () => new Uint8Array(), 'download') }), 'getFile')
    };
    await handler(ctx);
    await handler(ctx);
    expect(replySpy).toHaveBeenCalledTimes(1);
  });
});
