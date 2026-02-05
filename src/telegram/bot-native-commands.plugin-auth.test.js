const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { describe, expect, it, vi } from 'vitest';
import { registerTelegramNativeCommands } from './bot-native-commands.js';
const getPluginCommandSpecs = vi.hoisted(() => vi.fn());
const matchPluginCommand = vi.hoisted(() => vi.fn());
const executePluginCommand = vi.hoisted(() => vi.fn());
vi.mock('../plugins/commands.js', () => ({
  getPluginCommandSpecs,
  matchPluginCommand,
  executePluginCommand
}));
const deliverReplies = vi.hoisted(() => vi.fn(async () => {
}));
vi.mock('./bot/delivery.js', () => ({ deliverReplies }));
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: vi.fn(async () => [])
}));
describe('registerTelegramNativeCommands (plugin auth)', () => {
  it('allows requireAuth:false plugin command even when sender is unauthorized', async () => {
    const command = {
      name: 'plugin',
      description: 'Plugin command',
      requireAuth: false,
      handler: vi.fn()
    };
    getPluginCommandSpecs.mockReturnValue([{ name: 'plugin', description: 'Plugin command' }]);
    matchPluginCommand.mockReturnValue({ command, args: void 0 });
    executePluginCommand.mockResolvedValue({ text: 'ok' });
    const handlers = {};
    const bot = {
      api: {
        setMyCommands: vi.fn().mockResolvedValue(void 0),
        sendMessage: vi.fn()
      },
      command: /* @__PURE__ */ __name((name, handler) => {
        handlers[name] = handler;
      }, 'command')
    };
    const cfg = {};
    const telegramCfg = {};
    const resolveGroupPolicy = /* @__PURE__ */ __name(() => ({
      allowlistEnabled: false,
      allowed: true
    }), 'resolveGroupPolicy');
    registerTelegramNativeCommands({
      bot,
      cfg,
      runtime: {},
      accountId: 'default',
      telegramCfg,
      allowFrom: ['999'],
      groupAllowFrom: [],
      replyToMode: 'off',
      textLimit: 4e3,
      useAccessGroups: false,
      nativeEnabled: false,
      nativeSkillsEnabled: false,
      nativeDisabledExplicit: false,
      resolveGroupPolicy,
      resolveTelegramGroupConfig: /* @__PURE__ */ __name(() => ({
        groupConfig: void 0,
        topicConfig: void 0
      }), 'resolveTelegramGroupConfig'),
      shouldSkipUpdate: /* @__PURE__ */ __name(() => false, 'shouldSkipUpdate'),
      opts: { token: 'token' }
    });
    const ctx = {
      message: {
        chat: { id: 123, type: 'private' },
        from: { id: 111, username: 'nope' },
        message_id: 10,
        date: 123456
      },
      match: ''
    };
    await handlers.plugin?.(ctx);
    expect(matchPluginCommand).toHaveBeenCalled();
    expect(executePluginCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        isAuthorizedSender: false
      })
    );
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [{ text: 'ok' }]
      })
    );
    expect(bot.api.sendMessage).not.toHaveBeenCalled();
  });
});
