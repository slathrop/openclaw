const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { describe, expect, it, vi } from 'vitest';
import { buildTelegramMessageContext } from './bot-message-context.js';
describe('buildTelegramMessageContext dm thread sessions', () => {
  const baseConfig = {
    agents: { defaults: { model: 'anthropic/claude-opus-4-5', workspace: '/tmp/openclaw' } },
    channels: { telegram: {} },
    messages: { groupChat: { mentionPatterns: [] } }
  };
  const buildContext = /* @__PURE__ */ __name(async (message) => await buildTelegramMessageContext({
    primaryCtx: {
      message,
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
    cfg: baseConfig,
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
  }), 'buildContext');
  it('uses thread session key for dm topics', async () => {
    const ctx = await buildContext({
      message_id: 1,
      chat: { id: 1234, type: 'private' },
      date: 17e8,
      text: 'hello',
      message_thread_id: 42,
      from: { id: 42, first_name: 'Alice' }
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.MessageThreadId).toBe(42);
    expect(ctx?.ctxPayload?.SessionKey).toBe('agent:main:main:thread:42');
  });
  it('keeps legacy dm session key when no thread id', async () => {
    const ctx = await buildContext({
      message_id: 2,
      chat: { id: 1234, type: 'private' },
      date: 1700000001,
      text: 'hello',
      from: { id: 42, first_name: 'Alice' }
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.MessageThreadId).toBeUndefined();
    expect(ctx?.ctxPayload?.SessionKey).toBe('agent:main:main');
  });
});
describe('buildTelegramMessageContext group sessions without forum', () => {
  const baseConfig = {
    agents: { defaults: { model: 'anthropic/claude-opus-4-5', workspace: '/tmp/openclaw' } },
    channels: { telegram: {} },
    messages: { groupChat: { mentionPatterns: [] } }
  };
  const buildContext = /* @__PURE__ */ __name(async (message) => await buildTelegramMessageContext({
    primaryCtx: {
      message,
      me: { id: 7, username: 'bot' }
    },
    allMedia: [],
    storeAllowFrom: [],
    options: { forceWasMentioned: true },
    bot: {
      api: {
        sendChatAction: vi.fn(),
        setMessageReaction: vi.fn()
      }
    },
    cfg: baseConfig,
    account: { accountId: 'default' },
    historyLimit: 0,
    groupHistories: /* @__PURE__ */ new Map(),
    dmPolicy: 'open',
    allowFrom: [],
    groupAllowFrom: [],
    ackReactionScope: 'off',
    logger: { info: vi.fn() },
    resolveGroupActivation: /* @__PURE__ */ __name(() => true, 'resolveGroupActivation'),
    resolveGroupRequireMention: /* @__PURE__ */ __name(() => false, 'resolveGroupRequireMention'),
    resolveTelegramGroupConfig: /* @__PURE__ */ __name(() => ({
      groupConfig: { requireMention: false },
      topicConfig: void 0
    }), 'resolveTelegramGroupConfig')
  }), 'buildContext');
  it('ignores message_thread_id for regular groups (not forums)', async () => {
    const ctx = await buildContext({
      message_id: 1,
      chat: { id: -1001234567890, type: 'supergroup', title: 'Test Group' },
      date: 17e8,
      text: '@bot hello',
      message_thread_id: 42,
      // This is a reply thread, NOT a forum topic
      from: { id: 42, first_name: 'Alice' }
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.SessionKey).toBe('agent:main:telegram:group:-1001234567890');
    expect(ctx?.ctxPayload?.MessageThreadId).toBeUndefined();
  });
  it('keeps same session for regular group with and without message_thread_id', async () => {
    const ctxWithThread = await buildContext({
      message_id: 1,
      chat: { id: -1001234567890, type: 'supergroup', title: 'Test Group' },
      date: 17e8,
      text: '@bot hello',
      message_thread_id: 42,
      from: { id: 42, first_name: 'Alice' }
    });
    const ctxWithoutThread = await buildContext({
      message_id: 2,
      chat: { id: -1001234567890, type: 'supergroup', title: 'Test Group' },
      date: 1700000001,
      text: '@bot world',
      from: { id: 42, first_name: 'Alice' }
    });
    expect(ctxWithThread).not.toBeNull();
    expect(ctxWithoutThread).not.toBeNull();
    expect(ctxWithThread?.ctxPayload?.SessionKey).toBe(ctxWithoutThread?.ctxPayload?.SessionKey);
  });
  it('uses topic session for forum groups with message_thread_id', async () => {
    const ctx = await buildContext({
      message_id: 1,
      chat: { id: -1001234567890, type: 'supergroup', title: 'Test Forum', is_forum: true },
      date: 17e8,
      text: '@bot hello',
      message_thread_id: 99,
      from: { id: 42, first_name: 'Alice' }
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.SessionKey).toBe('agent:main:telegram:group:-1001234567890:topic:99');
    expect(ctx?.ctxPayload?.MessageThreadId).toBe(99);
  });
});
