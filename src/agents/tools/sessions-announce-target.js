/**
 * Session announcement target resolution for message routing.
 * @module agents/tools/sessions-announce-target
 */
import { getChannelPlugin, normalizeChannelId } from '../../channels/plugins/index.js';
import { callGateway } from '../../gateway/call.js';
import { resolveAnnounceTargetFromKey } from './sessions-send-helpers.js';
async function resolveAnnounceTarget(params) {
  const parsed = resolveAnnounceTargetFromKey(params.sessionKey);
  const parsedDisplay = resolveAnnounceTargetFromKey(params.displayKey);
  const fallback = parsed ?? parsedDisplay ?? null;
  if (fallback) {
    const normalized = normalizeChannelId(fallback.channel);
    const plugin = normalized ? getChannelPlugin(normalized) : null;
    if (!plugin?.meta?.preferSessionLookupForAnnounceTarget) {
      return fallback;
    }
  }
  try {
    const list = await callGateway({
      method: 'sessions.list',
      params: {
        includeGlobal: true,
        includeUnknown: true,
        limit: 200
      }
    });
    const sessions = Array.isArray(list?.sessions) ? list.sessions : [];
    const match = sessions.find((entry) => entry?.key === params.sessionKey) ?? sessions.find((entry) => entry?.key === params.displayKey);
    const deliveryContext = match?.deliveryContext && typeof match.deliveryContext === 'object' ? match.deliveryContext : void 0;
    const channel = (typeof deliveryContext?.channel === 'string' ? deliveryContext.channel : void 0) ?? (typeof match?.lastChannel === 'string' ? match.lastChannel : void 0);
    const to = (typeof deliveryContext?.to === 'string' ? deliveryContext.to : void 0) ?? (typeof match?.lastTo === 'string' ? match.lastTo : void 0);
    const accountId = (typeof deliveryContext?.accountId === 'string' ? deliveryContext.accountId : void 0) ?? (typeof match?.lastAccountId === 'string' ? match.lastAccountId : void 0);
    if (channel && to) {
      return { channel, to, accountId };
    }
  } catch {
    // intentionally ignored
  }
  return fallback;
}
export {
  resolveAnnounceTarget
};
