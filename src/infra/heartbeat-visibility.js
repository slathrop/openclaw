/**
 * Heartbeat visibility resolution with 3-layer config precedence.
 *
 * Resolves heartbeat visibility settings per channel/account from
 * global defaults, per-channel config, and per-account overrides.
 */

/**
 * @typedef {object} ResolvedHeartbeatVisibility
 * @property {boolean} showOk
 * @property {boolean} showAlerts
 * @property {boolean} useIndicator
 */

/** @type {ResolvedHeartbeatVisibility} */
const DEFAULT_VISIBILITY = {
  showOk: false, // Silent by default
  showAlerts: true, // Show content messages
  useIndicator: true // Emit indicator events
};

/**
 * Resolve heartbeat visibility settings for a channel.
 * Supports both deliverable channels (telegram, signal, etc.) and webchat.
 * For webchat, uses channels.defaults.heartbeat since webchat doesn't have per-channel config.
 * @param {object} params
 * @param {import('../config/config.js').OpenClawConfig} params.cfg
 * @param {import('../utils/message-channel.js').GatewayMessageChannel} params.channel
 * @param {string} [params.accountId]
 * @returns {ResolvedHeartbeatVisibility}
 */
export function resolveHeartbeatVisibility(params) {
  const {cfg, channel, accountId} = params;

  // Webchat uses channel defaults only (no per-channel or per-account config)
  if (channel === 'webchat') {
    const channelDefaults = cfg.channels?.defaults?.heartbeat;
    return {
      showOk: channelDefaults?.showOk ?? DEFAULT_VISIBILITY.showOk,
      showAlerts: channelDefaults?.showAlerts ?? DEFAULT_VISIBILITY.showAlerts,
      useIndicator: channelDefaults?.useIndicator ?? DEFAULT_VISIBILITY.useIndicator
    };
  }

  // Layer 1: Global channel defaults
  const channelDefaults = cfg.channels?.defaults?.heartbeat;

  // Layer 2: Per-channel config (at channel root level)
  const channelCfg = cfg.channels?.[channel];
  const perChannel = channelCfg?.heartbeat;

  // Layer 3: Per-account config (most specific)
  const accountCfg = accountId ? channelCfg?.accounts?.[accountId] : undefined;
  const perAccount = accountCfg?.heartbeat;

  // Precedence: per-account > per-channel > channel-defaults > global defaults
  return {
    showOk:
      perAccount?.showOk ??
      perChannel?.showOk ??
      channelDefaults?.showOk ??
      DEFAULT_VISIBILITY.showOk,
    showAlerts:
      perAccount?.showAlerts ??
      perChannel?.showAlerts ??
      channelDefaults?.showAlerts ??
      DEFAULT_VISIBILITY.showAlerts,
    useIndicator:
      perAccount?.useIndicator ??
      perChannel?.useIndicator ??
      channelDefaults?.useIndicator ??
      DEFAULT_VISIBILITY.useIndicator
  };
}
