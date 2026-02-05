import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setActivePluginRegistry } from '../../plugins/runtime.js';
import { loadChannelPlugin } from './load.js';
import { loadChannelOutboundAdapter } from './outbound/load.js';
const createRegistry = (channels) => ({
  plugins: [],
  tools: [],
  channels,
  providers: [],
  gatewayHandlers: {},
  httpHandlers: [],
  httpRoutes: [],
  cliRegistrars: [],
  services: [],
  diagnostics: []
});
const emptyRegistry = createRegistry([]);
const msteamsOutbound = {
  deliveryMode: 'direct',
  sendText: async () => ({ channel: 'msteams', messageId: 'm1' }),
  sendMedia: async () => ({ channel: 'msteams', messageId: 'm2' })
};
const msteamsPlugin = {
  id: 'msteams',
  meta: {
    id: 'msteams',
    label: 'Microsoft Teams',
    selectionLabel: 'Microsoft Teams (Bot Framework)',
    docsPath: '/channels/msteams',
    blurb: 'Bot Framework; enterprise support.',
    aliases: ['teams']
  },
  capabilities: { chatTypes: ['direct'] },
  config: {
    listAccountIds: () => [],
    resolveAccount: () => ({})
  },
  outbound: msteamsOutbound
};
const registryWithMSTeams = createRegistry([
  { pluginId: 'msteams', plugin: msteamsPlugin, source: 'test' }
]);
describe('channel plugin loader', () => {
  beforeEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });
  afterEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });
  it('loads channel plugins from the active registry', async () => {
    setActivePluginRegistry(registryWithMSTeams);
    const plugin = await loadChannelPlugin('msteams');
    expect(plugin).toBe(msteamsPlugin);
  });
  it('loads outbound adapters from registered plugins', async () => {
    setActivePluginRegistry(registryWithMSTeams);
    const outbound = await loadChannelOutboundAdapter('msteams');
    expect(outbound).toBe(msteamsOutbound);
  });
});
