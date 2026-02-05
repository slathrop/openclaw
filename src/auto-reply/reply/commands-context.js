import { resolveCommandAuthorization } from '../command-auth.js';
import { normalizeCommandBody } from '../commands-registry.js';
import { stripMentions } from './mentions.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

function buildCommandContext(params) {
  const { ctx, cfg, agentId, sessionKey, isGroup, triggerBodyNormalized } = params;
  const auth = resolveCommandAuthorization({
    ctx,
    cfg,
    commandAuthorized: params.commandAuthorized
  });
  const surface = (ctx.Surface ?? ctx.Provider ?? '').trim().toLowerCase();
  const channel = (ctx.Provider ?? surface).trim().toLowerCase();
  const abortKey = sessionKey ?? (auth.from || void 0) ?? (auth.to || void 0);
  const rawBodyNormalized = triggerBodyNormalized;
  const commandBodyNormalized = normalizeCommandBody(
    isGroup ? stripMentions(rawBodyNormalized, ctx, cfg, agentId) : rawBodyNormalized
  );
  return {
    surface,
    channel,
    channelId: auth.providerId,
    ownerList: auth.ownerList,
    isAuthorizedSender: auth.isAuthorizedSender,
    senderId: auth.senderId,
    abortKey,
    rawBodyNormalized,
    commandBodyNormalized,
    from: auth.from,
    to: auth.to
  };
}
export {
  buildCommandContext
};
