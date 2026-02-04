/**
 * Message channel normalization and validation.
 *
 * Centralizes channel ID handling for both built-in channels (WhatsApp,
 * Telegram, etc.) and dynamically registered plugin channels. Provides
 * helpers to normalize raw channel strings, check capabilities, and
 * enumerate available channels.
 */
import {
  CHANNEL_IDS,
  listChatChannelAliases,
  normalizeChatChannelId
} from '../channels/registry.js';
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  normalizeGatewayClientMode,
  normalizeGatewayClientName
} from '../gateway/protocol/client-info.js';
import {getActivePluginRegistry} from '../plugins/runtime.js';

export const INTERNAL_MESSAGE_CHANNEL = 'webchat';

/**
 * @typedef {typeof INTERNAL_MESSAGE_CHANNEL} InternalMessageChannel
 */

const MARKDOWN_CAPABLE_CHANNELS = new Set([
  'slack',
  'telegram',
  'signal',
  'discord',
  'googlechat',
  'tui',
  INTERNAL_MESSAGE_CHANNEL
]);

export {GATEWAY_CLIENT_NAMES, GATEWAY_CLIENT_MODES};
export {normalizeGatewayClientName, normalizeGatewayClientMode};

/**
 * Returns true if the client is a CLI gateway client.
 * @param {{mode?: string | null, id?: string | null}} [client]
 * @returns {boolean}
 */
export function isGatewayCliClient(client) {
  return normalizeGatewayClientMode(client?.mode) === GATEWAY_CLIENT_MODES.CLI;
}

/**
 * Returns true if the raw channel value is the internal webchat channel.
 * @param {string | null} [raw]
 * @returns {boolean}
 */
export function isInternalMessageChannel(raw) {
  return normalizeMessageChannel(raw) === INTERNAL_MESSAGE_CHANNEL;
}

/**
 * Returns true if the client is a webchat client.
 * @param {{mode?: string | null, id?: string | null}} [client]
 * @returns {boolean}
 */
export function isWebchatClient(client) {
  const mode = normalizeGatewayClientMode(client?.mode);
  if (mode === GATEWAY_CLIENT_MODES.WEBCHAT) {
    return true;
  }
  return normalizeGatewayClientName(client?.id) === GATEWAY_CLIENT_NAMES.WEBCHAT_UI;
}

/**
 * Normalizes a raw channel string to its canonical identifier.
 * Checks built-in channels first, then plugin registry.
 * @param {string | null} [raw]
 * @returns {string | undefined}
 */
export function normalizeMessageChannel(raw) {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === INTERNAL_MESSAGE_CHANNEL) {
    return INTERNAL_MESSAGE_CHANNEL;
  }
  const builtIn = normalizeChatChannelId(normalized);
  if (builtIn) {
    return builtIn;
  }
  const registry = getActivePluginRegistry();
  const pluginMatch = registry?.channels.find((entry) => {
    if (entry.plugin.id.toLowerCase() === normalized) {
      return true;
    }
    return (entry.plugin.meta.aliases ?? []).some(
      (alias) => alias.trim().toLowerCase() === normalized
    );
  });
  return pluginMatch?.plugin.id ?? normalized;
}

const listPluginChannelIds = () => {
  const registry = getActivePluginRegistry();
  if (!registry) {
    return [];
  }
  return registry.channels.map((entry) => entry.plugin.id);
};

const listPluginChannelAliases = () => {
  const registry = getActivePluginRegistry();
  if (!registry) {
    return [];
  }
  return registry.channels.flatMap((entry) => entry.plugin.meta.aliases ?? []);
};

/**
 * Lists all deliverable message channels (built-in + plugins).
 * @returns {string[]}
 */
export const listDeliverableMessageChannels = () =>
  Array.from(new Set([...CHANNEL_IDS, ...listPluginChannelIds()]));

/**
 * @typedef {string} DeliverableMessageChannel
 */

/**
 * @typedef {string} GatewayMessageChannel
 */

/**
 * Lists all gateway message channels (deliverable + webchat).
 * @returns {string[]}
 */
export const listGatewayMessageChannels = () => [
  ...listDeliverableMessageChannels(),
  INTERNAL_MESSAGE_CHANNEL
];

/**
 * Lists all gateway agent channel aliases.
 * @returns {string[]}
 */
export const listGatewayAgentChannelAliases = () =>
  Array.from(new Set([...listChatChannelAliases(), ...listPluginChannelAliases()]));

/**
 * @typedef {string} GatewayAgentChannelHint
 */

/**
 * Lists all gateway agent channel values (channels + aliases + "last").
 * @returns {string[]}
 */
export const listGatewayAgentChannelValues = () =>
  Array.from(
    new Set([...listGatewayMessageChannels(), 'last', ...listGatewayAgentChannelAliases()])
  );

/**
 * Returns true if the value is a recognized gateway message channel.
 * @param {string} value
 * @returns {boolean}
 */
export function isGatewayMessageChannel(value) {
  return listGatewayMessageChannels().includes(value);
}

/**
 * Returns true if the value is a recognized deliverable message channel.
 * @param {string} value
 * @returns {boolean}
 */
export function isDeliverableMessageChannel(value) {
  return listDeliverableMessageChannels().includes(value);
}

/**
 * Resolves a raw channel string to a gateway message channel, or undefined.
 * @param {string | null} [raw]
 * @returns {string | undefined}
 */
export function resolveGatewayMessageChannel(raw) {
  const normalized = normalizeMessageChannel(raw);
  if (!normalized) {
    return undefined;
  }
  return isGatewayMessageChannel(normalized) ? normalized : undefined;
}

/**
 * Resolves a message channel from primary or fallback raw strings.
 * @param {string | null} [primary]
 * @param {string | null} [fallback]
 * @returns {string | undefined}
 */
export function resolveMessageChannel(primary, fallback) {
  return normalizeMessageChannel(primary) ?? normalizeMessageChannel(fallback);
}

/**
 * Returns true if the channel supports Markdown rendering.
 * @param {string | null} [raw]
 * @returns {boolean}
 */
export function isMarkdownCapableMessageChannel(raw) {
  const channel = normalizeMessageChannel(raw);
  if (!channel) {
    return false;
  }
  return MARKDOWN_CAPABLE_CHANNELS.has(channel);
}
