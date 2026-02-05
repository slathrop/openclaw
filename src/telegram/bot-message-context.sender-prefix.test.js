const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { describe, expect, it, vi } from 'vitest';
import { buildTelegramMessageContext } from './bot-message-context.js';
describe('buildTelegramMessageContext sender prefix', () => {
  it('prefixes group bodies with sender label', async () => {
    const ctx = await buildTelegramMessageContext({
      primaryCtx: {
        message: {
          message_id: 1,
          chat: { id: -99, type: 'supergroup', title: 'Dev Chat' },
          date: 17e8,
          text: 'hello',
          from: { id: 42, first_name: 'Alice' }
        },
        me: { id: 7, username: 'bot' }
      },
      allMedia: [],
      storeAllowFrom: [],
      options: {},
      bot: {
        api: {
          sendChatAction: vi.fn(),
          setMessageReaction: vi.fn()
        }
      },
      cfg: {
        agents: { defaults: { model: 'anthropic/claude-opus-4-5', workspace: '/tmp/openclaw' } },
        channels: { telegram: {} },
        messages: { groupChat: { mentionPatterns: [] } }
      },
      account: { accountId: 'default' },
      historyLimit: 0,
      groupHistories: /* @__PURE__ */ new Map(),
      dmPolicy: 'open',
      allowFrom: [],
      groupAllowFrom: [],
      ackReactionScope: 'off',
      logger: { info: vi.fn() },
      resolveGroupActivation: /* @__PURE__ */ __name(() => void 0, 'resolveGroupActivation'),
      resolveGroupRequireMention: /* @__PURE__ */ __name(() => false, 'resolveGroupRequireMention'),
      resolveTelegramGroupConfig: /* @__PURE__ */ __name(() => ({
        groupConfig: { requireMention: false },
        topicConfig: void 0
      }), 'resolveTelegramGroupConfig')
    });
    expect(ctx).not.toBeNull();
    const body = ctx?.ctxPayload?.Body ?? '';
    expect(body).toContain('Alice (42): hello');
  });
  it('sets MessageSid from message_id', async () => {
    const ctx = await buildTelegramMessageContext({
      primaryCtx: {
        message: {
          message_id: 12345,
          chat: { id: -99, type: 'supergroup', title: 'Dev Chat' },
          date: 17e8,
          text: 'hello',
          from: { id: 42, first_name: 'Alice' }
        },
        me: { id: 7, username: 'bot' }
      },
      allMedia: [],
      storeAllowFrom: [],
      options: {},
      bot: {
        api: {
          sendChatAction: vi.fn(),
          setMessageReaction: vi.fn()
        }
      },
      cfg: {
        agents: { defaults: { model: 'anthropic/claude-opus-4-5', workspace: '/tmp/openclaw' } },
        channels: { telegram: {} },
        messages: { groupChat: { mentionPatterns: [] } }
      },
      account: { accountId: 'default' },
      historyLimit: 0,
      groupHistories: /* @__PURE__ */ new Map(),
      dmPolicy: 'open',
      allowFrom: [],
      groupAllowFrom: [],
      ackReactionScope: 'off',
      logger: { info: vi.fn() },
      resolveGroupActivation: /* @__PURE__ */ __name(() => void 0, 'resolveGroupActivation'),
      resolveGroupRequireMention: /* @__PURE__ */ __name(() => false, 'resolveGroupRequireMention'),
      resolveTelegramGroupConfig: /* @__PURE__ */ __name(() => ({
        groupConfig: { requireMention: false },
        topicConfig: void 0
      }), 'resolveTelegramGroupConfig')
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.MessageSid).toBe('12345');
  });
  it('respects messageIdOverride option', async () => {
    const ctx = await buildTelegramMessageContext({
      primaryCtx: {
        message: {
          message_id: 12345,
          chat: { id: -99, type: 'supergroup', title: 'Dev Chat' },
          date: 17e8,
          text: 'hello',
          from: { id: 42, first_name: 'Alice' }
        },
        me: { id: 7, username: 'bot' }
      },
      allMedia: [],
      storeAllowFrom: [],
      options: { messageIdOverride: '67890' },
      bot: {
        api: {
          sendChatAction: vi.fn(),
          setMessageReaction: vi.fn()
        }
      },
      cfg: {
        agents: { defaults: { model: 'anthropic/claude-opus-4-5', workspace: '/tmp/openclaw' } },
        channels: { telegram: {} },
        messages: { groupChat: { mentionPatterns: [] } }
      },
      account: { accountId: 'default' },
      historyLimit: 0,
      groupHistories: /* @__PURE__ */ new Map(),
      dmPolicy: 'open',
      allowFrom: [],
      groupAllowFrom: [],
      ackReactionScope: 'off',
      logger: { info: vi.fn() },
      resolveGroupActivation: /* @__PURE__ */ __name(() => void 0, 'resolveGroupActivation'),
      resolveGroupRequireMention: /* @__PURE__ */ __name(() => false, 'resolveGroupRequireMention'),
      resolveTelegramGroupConfig: /* @__PURE__ */ __name(() => ({
        groupConfig: { requireMention: false },
        topicConfig: void 0
      }), 'resolveTelegramGroupConfig')
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.MessageSid).toBe('67890');
  });
});
