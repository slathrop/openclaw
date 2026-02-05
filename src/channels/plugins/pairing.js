/** @module SECURITY: Channel pairing approval and allowlist management */
import {
  getChannelPlugin,
  listChannelPlugins,
  normalizeChannelId
} from './index.js';
function listPairingChannels() {
  return listChannelPlugins().filter((plugin) => plugin.pairing).map((plugin) => plugin.id);
}
function getPairingAdapter(channelId) {
  const plugin = getChannelPlugin(channelId);
  return plugin?.pairing ?? null;
}
function requirePairingAdapter(channelId) {
  const adapter = getPairingAdapter(channelId);
  if (!adapter) {
    throw new Error(`Channel ${channelId} does not support pairing`);
  }
  return adapter;
}
function resolvePairingChannel(raw) {
  const value = (typeof raw === 'string' ? raw : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : '').trim().toLowerCase();
  const normalized = normalizeChannelId(value);
  const channels = listPairingChannels();
  if (!normalized || !channels.includes(normalized)) {
    throw new Error(
      `Invalid channel: ${value || '(empty)'} (expected one of: ${channels.join(', ')})`
    );
  }
  return normalized;
}
async function notifyPairingApproved(params) {
  const adapter = params.pairingAdapter ?? requirePairingAdapter(params.channelId);
  if (!adapter.notifyApproval) {
    return;
  }
  await adapter.notifyApproval({
    cfg: params.cfg,
    id: params.id,
    runtime: params.runtime
  });
}
export {
  getPairingAdapter,
  listPairingChannels,
  notifyPairingApproved,
  requirePairingAdapter,
  resolvePairingChannel
};
