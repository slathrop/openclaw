import { DEFAULT_CHAT_CHANNEL } from '../../channels/registry.js';
import {
  loadSessionStore,
  resolveAgentMainSessionKey,
  resolveStorePath
} from '../../config/sessions.js';
import { resolveMessageChannelSelection } from '../../infra/outbound/channel-selection.js';
import {
  resolveOutboundTarget,
  resolveSessionDeliveryTarget
} from '../../infra/outbound/targets.js';
async function resolveDeliveryTarget(cfg, agentId, jobPayload) {
  const requestedChannel = typeof jobPayload.channel === 'string' ? jobPayload.channel : 'last';
  const explicitTo = typeof jobPayload.to === 'string' ? jobPayload.to : void 0;
  const sessionCfg = cfg.session;
  const mainSessionKey = resolveAgentMainSessionKey({ cfg, agentId });
  const storePath = resolveStorePath(sessionCfg?.store, { agentId });
  const store = loadSessionStore(storePath);
  const main = store[mainSessionKey];
  const preliminary = resolveSessionDeliveryTarget({
    entry: main,
    requestedChannel,
    explicitTo,
    allowMismatchedLastTo: true
  });
  let fallbackChannel;
  if (!preliminary.channel) {
    try {
      const selection = await resolveMessageChannelSelection({ cfg });
      fallbackChannel = selection.channel;
    } catch {
      fallbackChannel = preliminary.lastChannel ?? DEFAULT_CHAT_CHANNEL;
    }
  }
  const resolved = fallbackChannel ? resolveSessionDeliveryTarget({
    entry: main,
    requestedChannel,
    explicitTo,
    fallbackChannel,
    allowMismatchedLastTo: true,
    mode: preliminary.mode
  }) : preliminary;
  const channel = resolved.channel ?? fallbackChannel ?? DEFAULT_CHAT_CHANNEL;
  const mode = resolved.mode;
  const toCandidate = resolved.to;
  if (!toCandidate) {
    return {
      channel,
      to: void 0,
      accountId: resolved.accountId,
      threadId: resolved.threadId,
      mode
    };
  }
  const docked = resolveOutboundTarget({
    channel,
    to: toCandidate,
    cfg,
    accountId: resolved.accountId,
    mode
  });
  return {
    channel,
    to: docked.ok ? docked.to : void 0,
    accountId: resolved.accountId,
    threadId: resolved.threadId,
    mode,
    error: docked.ok ? void 0 : docked.error
  };
}
export {
  resolveDeliveryTarget
};
