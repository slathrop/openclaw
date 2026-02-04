/**
 * Channel status issue collection from plugin registrations.
 *
 * Aggregates status issues reported by channel plugins from their
 * account snapshots for display in the status command.
 */
import {listChannelPlugins} from '../channels/plugins/index.js';

/**
 * Collects status issues from all registered channel plugins.
 * @param {Record<string, unknown>} payload
 * @returns {import('../channels/plugins/types.js').ChannelStatusIssue[]}
 */
export function collectChannelStatusIssues(payload) {
  /** @type {import('../channels/plugins/types.js').ChannelStatusIssue[]} */
  const issues = [];
  const accountsByChannel = /** @type {Record<string, unknown> | undefined} */ (payload.channelAccounts);
  for (const plugin of listChannelPlugins()) {
    const collect = plugin.status?.collectStatusIssues;
    if (!collect) {
      continue;
    }
    const raw = accountsByChannel?.[plugin.id];
    if (!Array.isArray(raw)) {
      continue;
    }

    issues.push(...collect(/** @type {any[]} */ (raw)));
  }
  return issues;
}
