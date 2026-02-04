/**
 * Channel activity tracking for inbound/outbound message timestamps.
 *
 * Records per-channel, per-account activity timestamps for both
 * inbound and outbound message directions.
 */

/**
 * @typedef {'inbound' | 'outbound'} ChannelDirection
 */

/**
 * @typedef {object} ActivityEntry
 * @property {number | null} inboundAt
 * @property {number | null} outboundAt
 */

/** @type {Map<string, ActivityEntry>} */
const activity = new Map();

/**
 * @param {import('../channels/plugins/types.js').ChannelId} channel
 * @param {string} accountId
 * @returns {string}
 */
function keyFor(channel, accountId) {
  return `${channel}:${accountId || 'default'}`;
}

/**
 * @param {import('../channels/plugins/types.js').ChannelId} channel
 * @param {string} accountId
 * @returns {ActivityEntry}
 */
function ensureEntry(channel, accountId) {
  const key = keyFor(channel, accountId);
  const existing = activity.get(key);
  if (existing) {
    return existing;
  }
  /** @type {ActivityEntry} */
  const created = {inboundAt: null, outboundAt: null};
  activity.set(key, created);
  return created;
}

/**
 * Records channel activity for a direction.
 * @param {object} params
 * @param {import('../channels/plugins/types.js').ChannelId} params.channel
 * @param {string | null} [params.accountId]
 * @param {ChannelDirection} params.direction
 * @param {number} [params.at]
 */
export function recordChannelActivity(params) {
  const at = typeof params.at === 'number' ? params.at : Date.now();
  const accountId = params.accountId?.trim() || 'default';
  const entry = ensureEntry(params.channel, accountId);
  if (params.direction === 'inbound') {
    entry.inboundAt = at;
  }
  if (params.direction === 'outbound') {
    entry.outboundAt = at;
  }
}

/**
 * Gets channel activity for a channel/account.
 * @param {object} params
 * @param {import('../channels/plugins/types.js').ChannelId} params.channel
 * @param {string | null} [params.accountId]
 * @returns {ActivityEntry}
 */
export function getChannelActivity(params) {
  const accountId = params.accountId?.trim() || 'default';
  return (
    activity.get(keyFor(params.channel, accountId)) ?? {
      inboundAt: null,
      outboundAt: null
    }
  );
}

/**
 * Resets channel activity (for testing).
 */
export function resetChannelActivityForTest() {
  activity.clear();
}
