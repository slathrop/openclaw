import { afterAll, afterEach, beforeEach, vi } from 'vitest';
process.env.VITEST = 'true';
import { installProcessWarningFilter } from '../src/infra/warnings.js';
import { setActivePluginRegistry } from '../src/plugins/runtime.js';
import { createTestRegistry } from '../src/test-utils/channel-plugins.js';
import { withIsolatedTestHome } from './test-env';
installProcessWarningFilter();
const testEnv = withIsolatedTestHome();
afterAll(() => testEnv.cleanup());
const pickSendFn = (id, deps) => {
  switch (id) {
    case 'discord':
      return deps?.sendDiscord;
    case 'slack':
      return deps?.sendSlack;
    case 'telegram':
      return deps?.sendTelegram;
    case 'whatsapp':
      return deps?.sendWhatsApp;
    case 'signal':
      return deps?.sendSignal;
    case 'imessage':
      return deps?.sendIMessage;
    default:
      return void 0;
  }
};
const createStubOutbound = (id, deliveryMode = 'direct') => ({
  deliveryMode,
  sendText: async ({ deps, to, text }) => {
    const send = pickSendFn(id, deps);
    if (send) {
      const result = await send(to, text, {});
      return { channel: id, ...result };
    }
    return { channel: id, messageId: 'test' };
  },
  sendMedia: async ({ deps, to, text, mediaUrl }) => {
    const send = pickSendFn(id, deps);
    if (send) {
      const result = await send(to, text, { mediaUrl });
      return { channel: id, ...result };
    }
    return { channel: id, messageId: 'test' };
  }
});
const createStubPlugin = (params) => ({
  id: params.id,
  meta: {
    id: params.id,
    label: params.label ?? String(params.id),
    selectionLabel: params.label ?? String(params.id),
    docsPath: `/channels/${params.id}`,
    blurb: 'test stub.',
    aliases: params.aliases,
    preferSessionLookupForAnnounceTarget: params.preferSessionLookupForAnnounceTarget
  },
  capabilities: { chatTypes: ['direct', 'group'] },
  config: {
    listAccountIds: (cfg) => {
      const channels = cfg.channels;
      const entry = channels?.[params.id];
      if (!entry || typeof entry !== 'object') {
        return [];
      }
      const accounts = entry.accounts;
      const ids = accounts ? Object.keys(accounts).filter(Boolean) : [];
      return ids.length > 0 ? ids : ['default'];
    },
    resolveAccount: (cfg, accountId) => {
      const channels = cfg.channels;
      const entry = channels?.[params.id];
      if (!entry || typeof entry !== 'object') {
        return {};
      }
      const accounts = entry.accounts;
      const match = accounts?.[accountId];
      return match && typeof match === 'object' || typeof match === 'string' ? match : entry;
    },
    isConfigured: async (_account, cfg) => {
      const channels = cfg.channels;
      return Boolean(channels?.[params.id]);
    }
  },
  outbound: createStubOutbound(params.id, params.deliveryMode)
});
const createDefaultRegistry = () => createTestRegistry([
  {
    pluginId: 'discord',
    plugin: createStubPlugin({ id: 'discord', label: 'Discord' }),
    source: 'test'
  },
  {
    pluginId: 'slack',
    plugin: createStubPlugin({ id: 'slack', label: 'Slack' }),
    source: 'test'
  },
  {
    pluginId: 'telegram',
    plugin: {
      ...createStubPlugin({ id: 'telegram', label: 'Telegram' }),
      status: {
        buildChannelSummary: async () => ({
          configured: false,
          tokenSource: process.env.TELEGRAM_BOT_TOKEN ? 'env' : 'none'
        })
      }
    },
    source: 'test'
  },
  {
    pluginId: 'whatsapp',
    plugin: createStubPlugin({
      id: 'whatsapp',
      label: 'WhatsApp',
      deliveryMode: 'gateway',
      preferSessionLookupForAnnounceTarget: true
    }),
    source: 'test'
  },
  {
    pluginId: 'signal',
    plugin: createStubPlugin({ id: 'signal', label: 'Signal' }),
    source: 'test'
  },
  {
    pluginId: 'imessage',
    plugin: createStubPlugin({ id: 'imessage', label: 'iMessage', aliases: ['imsg'] }),
    source: 'test'
  }
]);
beforeEach(() => {
  setActivePluginRegistry(createDefaultRegistry());
});
afterEach(() => {
  setActivePluginRegistry(createDefaultRegistry());
  vi.useRealTimers();
});
