/**
 * SECURITY: Target parameter routing for message actions.
 * Maps the unified target parameter to action-specific fields (to/channelId)
 * and validates that legacy parameters are not mixed with new format.
 * @module
 */

import { MESSAGE_ACTION_TARGET_MODE } from './message-action-spec.js';
const CHANNEL_TARGET_DESCRIPTION = 'Recipient/channel: E.164 for WhatsApp/Signal, Telegram chat id/@username, Discord/Slack channel/user, or iMessage handle/chat_id';
const CHANNEL_TARGETS_DESCRIPTION = 'Recipient/channel targets (same format as --target); accepts ids or names when the directory is available.';
function applyTargetToParams(params) {
  const target = typeof params.args.target === 'string' ? params.args.target.trim() : '';
  const hasLegacyTo = typeof params.args.to === 'string';
  const hasLegacyChannelId = typeof params.args.channelId === 'string';
  const mode = MESSAGE_ACTION_TARGET_MODE[params.action] ?? 'none';
  if (mode !== 'none') {
    if (hasLegacyTo || hasLegacyChannelId) {
      throw new Error('Use `target` instead of `to`/`channelId`.');
    }
  } else if (hasLegacyTo) {
    throw new Error('Use `target` for actions that accept a destination.');
  }
  if (!target) {
    return;
  }
  if (mode === 'channelId') {
    params.args.channelId = target;
    return;
  }
  if (mode === 'to') {
    params.args.to = target;
    return;
  }
  throw new Error(`Action ${params.action} does not accept a target.`);
}
export {
  CHANNEL_TARGETS_DESCRIPTION,
  CHANNEL_TARGET_DESCRIPTION,
  applyTargetToParams
};
