/** @module gateway/server-restart-sentinel -- Restart sentinel for detecting and recovering from gateway restarts. */
import { resolveAnnounceTargetFromKey } from '../agents/tools/sessions-send-helpers.js';
import { normalizeChannelId } from '../channels/plugins/index.js';
import { agentCommand } from '../commands/agent.js';
import { resolveMainSessionKeyFromConfig } from '../config/sessions.js';
import { resolveOutboundTarget } from '../infra/outbound/targets.js';
import {
  consumeRestartSentinel,
  formatRestartSentinelMessage,
  summarizeRestartSentinel
} from '../infra/restart-sentinel.js';
import { enqueueSystemEvent } from '../infra/system-events.js';
import { defaultRuntime } from '../runtime.js';
import { deliveryContextFromSession, mergeDeliveryContext } from '../utils/delivery-context.js';
import { loadSessionEntry } from './session-utils.js';
async function scheduleRestartSentinelWake(params) {
  const sentinel = await consumeRestartSentinel();
  if (!sentinel) {
    return;
  }
  const payload = sentinel.payload;
  const sessionKey = payload.sessionKey?.trim();
  const message = formatRestartSentinelMessage(payload);
  const summary = summarizeRestartSentinel(payload);
  if (!sessionKey) {
    const mainSessionKey = resolveMainSessionKeyFromConfig();
    enqueueSystemEvent(message, { sessionKey: mainSessionKey });
    return;
  }
  const topicIndex = sessionKey.lastIndexOf(':topic:');
  const threadIndex = sessionKey.lastIndexOf(':thread:');
  const markerIndex = Math.max(topicIndex, threadIndex);
  const marker = topicIndex > threadIndex ? ':topic:' : ':thread:';
  const baseSessionKey = markerIndex === -1 ? sessionKey : sessionKey.slice(0, markerIndex);
  const threadIdRaw = markerIndex === -1 ? void 0 : sessionKey.slice(markerIndex + marker.length);
  const sessionThreadId = threadIdRaw?.trim() || void 0;
  const { cfg, entry } = loadSessionEntry(sessionKey);
  const parsedTarget = resolveAnnounceTargetFromKey(baseSessionKey);
  const sentinelContext = payload.deliveryContext;
  let sessionDeliveryContext = deliveryContextFromSession(entry);
  if (!sessionDeliveryContext && markerIndex !== -1 && baseSessionKey) {
    const { entry: baseEntry } = loadSessionEntry(baseSessionKey);
    sessionDeliveryContext = deliveryContextFromSession(baseEntry);
  }
  const origin = mergeDeliveryContext(
    sentinelContext,
    mergeDeliveryContext(sessionDeliveryContext, parsedTarget ?? void 0)
  );
  const channelRaw = origin?.channel;
  const channel = channelRaw ? normalizeChannelId(channelRaw) : null;
  const to = origin?.to;
  if (!channel || !to) {
    enqueueSystemEvent(message, { sessionKey });
    return;
  }
  const resolved = resolveOutboundTarget({
    channel,
    to,
    cfg,
    accountId: origin?.accountId,
    mode: 'implicit'
  });
  if (!resolved.ok) {
    enqueueSystemEvent(message, { sessionKey });
    return;
  }
  const threadId = payload.threadId ?? parsedTarget?.threadId ?? // From resolveAnnounceTargetFromKey (extracts :topic:N)
  sessionThreadId ?? (origin?.threadId !== null && origin?.threadId !== undefined ? String(origin.threadId) : void 0);
  try {
    await agentCommand(
      {
        message,
        sessionKey,
        to: resolved.to,
        channel,
        deliver: true,
        bestEffortDeliver: true,
        messageChannel: channel,
        threadId
      },
      defaultRuntime,
      params.deps
    );
  } catch (err) {
    enqueueSystemEvent(`${summary}
${String(err)}`, { sessionKey });
  }
}
function shouldWakeFromRestartSentinel() {
  return !process.env.VITEST && process.env.NODE_ENV !== 'test';
}
export {
  scheduleRestartSentinelWake,
  shouldWakeFromRestartSentinel
};
