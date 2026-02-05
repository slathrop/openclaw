/**
 * Slack sender authentication and allow-list resolution
 *
 * SECURITY: This module controls who can interact with the Slack bot.
 * Changes here affect Slack OAuth token scope and sender authorization.
 */
const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { readChannelAllowFromStore } from '../../pairing/pairing-store.js';
import { allowListMatches, normalizeAllowList, normalizeAllowListLower } from './allow-list.js';
async function resolveSlackEffectiveAllowFrom(ctx) {
  const storeAllowFrom = await readChannelAllowFromStore('slack').catch(() => []);
  const allowFrom = normalizeAllowList([...ctx.allowFrom, ...storeAllowFrom]);
  const allowFromLower = normalizeAllowListLower(allowFrom);
  return { allowFrom, allowFromLower };
}
__name(resolveSlackEffectiveAllowFrom, 'resolveSlackEffectiveAllowFrom');
function isSlackSenderAllowListed(params) {
  const { allowListLower, senderId, senderName } = params;
  return allowListLower.length === 0 || allowListMatches({
    allowList: allowListLower,
    id: senderId,
    name: senderName
  });
}
__name(isSlackSenderAllowListed, 'isSlackSenderAllowListed');
export {
  isSlackSenderAllowListed,
  resolveSlackEffectiveAllowFrom
};
