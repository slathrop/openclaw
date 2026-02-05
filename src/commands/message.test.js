const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestRegistry } from '../test-utils/channel-plugins.js';
const loadMessageCommand = /* @__PURE__ */ __name(async () => await import('./message.js'), 'loadMessageCommand');
let testConfig = {};
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: /* @__PURE__ */ __name(() => testConfig, 'loadConfig')
  };
});
const callGatewayMock = vi.fn();
vi.mock('../gateway/call.js', () => ({
  callGateway: /* @__PURE__ */ __name((...args) => callGatewayMock(...args), 'callGateway'),
  randomIdempotencyKey: /* @__PURE__ */ __name(() => 'idem-1', 'randomIdempotencyKey')
}));
const webAuthExists = vi.fn(async () => false);
vi.mock('../web/session.js', () => ({
  webAuthExists: /* @__PURE__ */ __name((...args) => webAuthExists(...args), 'webAuthExists')
}));
const handleDiscordAction = vi.fn(async () => ({ details: { ok: true } }));
vi.mock('../agents/tools/discord-actions.js', () => ({
  handleDiscordAction: /* @__PURE__ */ __name((...args) => handleDiscordAction(...args), 'handleDiscordAction')
}));
const handleSlackAction = vi.fn(async () => ({ details: { ok: true } }));
vi.mock('../agents/tools/slack-actions.js', () => ({
  handleSlackAction: /* @__PURE__ */ __name((...args) => handleSlackAction(...args), 'handleSlackAction')
}));
const handleTelegramAction = vi.fn(async () => ({ details: { ok: true } }));
vi.mock('../agents/tools/telegram-actions.js', () => ({
  handleTelegramAction: /* @__PURE__ */ __name((...args) => handleTelegramAction(...args), 'handleTelegramAction')
}));
const handleWhatsAppAction = vi.fn(async () => ({ details: { ok: true } }));
vi.mock('../agents/tools/whatsapp-actions.js', () => ({
  handleWhatsAppAction: /* @__PURE__ */ __name((...args) => handleWhatsAppAction(...args), 'handleWhatsAppAction')
}));
const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
const originalDiscordToken = process.env.DISCORD_BOT_TOKEN;
const setRegistry = /* @__PURE__ */ __name(async (registry) => {
  const { setActivePluginRegistry } = await import('../plugins/runtime.js');
  setActivePluginRegistry(registry);
}, 'setRegistry');
beforeEach(async () => {
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.DISCORD_BOT_TOKEN = '';
  testConfig = {};
  vi.resetModules();
  await setRegistry(createTestRegistry([]));
  callGatewayMock.mockReset();
  webAuthExists.mockReset().mockResolvedValue(false);
  handleDiscordAction.mockReset();
  handleSlackAction.mockReset();
  handleTelegramAction.mockReset();
  handleWhatsAppAction.mockReset();
});
afterAll(() => {
  process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken;
  process.env.DISCORD_BOT_TOKEN = originalDiscordToken;
});
const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(() => {
    throw new Error('exit');
  })
};
const makeDeps = /* @__PURE__ */ __name((overrides = {}) => ({
  sendMessageWhatsApp: vi.fn(),
  sendMessageTelegram: vi.fn(),
  sendMessageDiscord: vi.fn(),
  sendMessageSlack: vi.fn(),
  sendMessageSignal: vi.fn(),
  sendMessageIMessage: vi.fn(),
  ...overrides
}), 'makeDeps');
const createStubPlugin = /* @__PURE__ */ __name((params) => ({
  id: params.id,
  meta: {
    id: params.id,
    label: params.label ?? String(params.id),
    selectionLabel: params.label ?? String(params.id),
    docsPath: `/channels/${params.id}`,
    blurb: 'test stub.'
  },
  capabilities: { chatTypes: ['direct'] },
  config: {
    listAccountIds: /* @__PURE__ */ __name(() => ['default'], 'listAccountIds'),
    resolveAccount: /* @__PURE__ */ __name(() => ({}), 'resolveAccount'),
    isConfigured: /* @__PURE__ */ __name(async () => true, 'isConfigured')
  },
  actions: params.actions,
  outbound: params.outbound
}), 'createStubPlugin');
describe('messageCommand', () => {
  it('defaults channel when only one configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token-abc';
    await setRegistry(
      createTestRegistry([
        {
          pluginId: 'telegram',
          source: 'test',
          plugin: createStubPlugin({
            id: 'telegram',
            label: 'Telegram',
            actions: {
              listActions: /* @__PURE__ */ __name(() => ['send'], 'listActions'),
              handleAction: /* @__PURE__ */ __name(async ({ action, params, cfg, accountId }) => await handleTelegramAction(
                { action, to: params.to, accountId: accountId ?? void 0 },
                cfg
              ), 'handleAction')
            }
          })
        }
      ])
    );
    const deps = makeDeps();
    const { messageCommand } = await loadMessageCommand();
    await messageCommand(
      {
        target: '123456',
        message: 'hi'
      },
      deps,
      runtime
    );
    expect(handleTelegramAction).toHaveBeenCalled();
  });
  it('requires channel when multiple configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token-abc';
    process.env.DISCORD_BOT_TOKEN = 'token-discord';
    await setRegistry(
      createTestRegistry([
        {
          pluginId: 'telegram',
          source: 'test',
          plugin: createStubPlugin({
            id: 'telegram',
            label: 'Telegram',
            actions: {
              listActions: /* @__PURE__ */ __name(() => ['send'], 'listActions'),
              handleAction: /* @__PURE__ */ __name(async ({ action, params, cfg, accountId }) => await handleTelegramAction(
                { action, to: params.to, accountId: accountId ?? void 0 },
                cfg
              ), 'handleAction')
            }
          })
        },
        {
          pluginId: 'discord',
          source: 'test',
          plugin: createStubPlugin({
            id: 'discord',
            label: 'Discord',
            actions: {
              listActions: /* @__PURE__ */ __name(() => ['poll'], 'listActions'),
              handleAction: /* @__PURE__ */ __name(async ({ action, params, cfg, accountId }) => await handleDiscordAction(
                { action, to: params.to, accountId: accountId ?? void 0 },
                cfg
              ), 'handleAction')
            }
          })
        }
      ])
    );
    const deps = makeDeps();
    const { messageCommand } = await loadMessageCommand();
    await expect(
      messageCommand(
        {
          target: '123',
          message: 'hi'
        },
        deps,
        runtime
      )
    ).rejects.toThrow(/Channel is required/);
  });
  it('sends via gateway for WhatsApp', async () => {
    callGatewayMock.mockResolvedValueOnce({ messageId: 'g1' });
    await setRegistry(
      createTestRegistry([
        {
          pluginId: 'whatsapp',
          source: 'test',
          plugin: createStubPlugin({
            id: 'whatsapp',
            label: 'WhatsApp',
            outbound: {
              deliveryMode: 'gateway'
            }
          })
        }
      ])
    );
    const deps = makeDeps();
    const { messageCommand } = await loadMessageCommand();
    await messageCommand(
      {
        action: 'send',
        channel: 'whatsapp',
        target: '+15551234567',
        message: 'hi'
      },
      deps,
      runtime
    );
    expect(callGatewayMock).toHaveBeenCalled();
  });
  it('routes discord polls through message action', async () => {
    await setRegistry(
      createTestRegistry([
        {
          pluginId: 'discord',
          source: 'test',
          plugin: createStubPlugin({
            id: 'discord',
            label: 'Discord',
            actions: {
              listActions: /* @__PURE__ */ __name(() => ['poll'], 'listActions'),
              handleAction: /* @__PURE__ */ __name(async ({ action, params, cfg, accountId }) => await handleDiscordAction(
                { action, to: params.to, accountId: accountId ?? void 0 },
                cfg
              ), 'handleAction')
            }
          })
        }
      ])
    );
    const deps = makeDeps();
    const { messageCommand } = await loadMessageCommand();
    await messageCommand(
      {
        action: 'poll',
        channel: 'discord',
        target: 'channel:123456789',
        pollQuestion: 'Snack?',
        pollOption: ['Pizza', 'Sushi']
      },
      deps,
      runtime
    );
    expect(handleDiscordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'poll',
        to: 'channel:123456789'
      }),
      expect.any(Object)
    );
  });
});
