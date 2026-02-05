import { requireActivePluginRegistry } from '../../plugins/runtime.js';
import { CHAT_CHANNEL_ORDER, normalizeAnyChannelId } from '../registry.js';
function listPluginChannels() {
  const registry = requireActivePluginRegistry();
  return registry.channels.map((entry) => entry.plugin);
}
function dedupeChannels(channels) {
  const seen = /* @__PURE__ */ new Set();
  const resolved = [];
  for (const plugin of channels) {
    const id = String(plugin.id).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    resolved.push(plugin);
  }
  return resolved;
}
function listChannelPlugins() {
  const combined = dedupeChannels(listPluginChannels());
  return combined.toSorted((a, b) => {
    const indexA = CHAT_CHANNEL_ORDER.indexOf(a.id);
    const indexB = CHAT_CHANNEL_ORDER.indexOf(b.id);
    const orderA = a.meta.order ?? (indexA === -1 ? 999 : indexA);
    const orderB = b.meta.order ?? (indexB === -1 ? 999 : indexB);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.id.localeCompare(b.id);
  });
}
function getChannelPlugin(id) {
  const resolvedId = String(id).trim();
  if (!resolvedId) {
    return void 0;
  }
  return listChannelPlugins().find((plugin) => plugin.id === resolvedId);
}
function normalizeChannelId(raw) {
  return normalizeAnyChannelId(raw);
}
import {
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  listWhatsAppDirectoryGroupsFromConfig,
  listWhatsAppDirectoryPeersFromConfig
} from './directory-config.js';
import {
  applyChannelMatchMeta,
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatch,
  resolveChannelEntryMatchWithFallback,
  resolveChannelMatchConfig,
  resolveNestedAllowlistDecision
} from './channel-config.js';
import {
  formatAllowlistMatchMeta
} from './allowlist-match.js';
export {
  applyChannelMatchMeta,
  buildChannelKeyCandidates,
  formatAllowlistMatchMeta,
  getChannelPlugin,
  listChannelPlugins,
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  listWhatsAppDirectoryGroupsFromConfig,
  listWhatsAppDirectoryPeersFromConfig,
  normalizeChannelId,
  normalizeChannelSlug,
  resolveChannelEntryMatch,
  resolveChannelEntryMatchWithFallback,
  resolveChannelMatchConfig,
  resolveNestedAllowlistDecision
};
