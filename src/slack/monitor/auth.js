/**
 * Slack sender authentication and allow-list resolution
 *
 * SECURITY: This module controls who can interact with the Slack bot.
 * Changes here affect Slack OAuth token scope and sender authorization.
 */
import { readChannelAllowFromStore } from '../../pairing/pairing-store.js';
import { allowListMatches, normalizeAllowList, normalizeAllowListLower } from './allow-list.js';
async function resolveSlackEffectiveAllowFrom(ctx) {
  const storeAllowFrom = await readChannelAllowFromStore('slack').catch(() => []);
  const allowFrom = normalizeAllowList([...ctx.allowFrom, ...storeAllowFrom]);
  const allowFromLower = normalizeAllowListLower(allowFrom);
  return { allowFrom, allowFromLower };
}
function isSlackSenderAllowListed(params) {
  const { allowListLower, senderId, senderName } = params;
  return allowListLower.length === 0 || allowListMatches({
    allowList: allowListLower,
    id: senderId,
    name: senderName
  });
}
export {
  isSlackSenderAllowListed,
  resolveSlackEffectiveAllowFrom
};
