/**
 * Agent delivery plan resolution.
 * Resolves which channel and target to deliver agent output to,
 * based on session context and explicit overrides.
 * @module
 */

import { DEFAULT_CHAT_CHANNEL } from '../../channels/registry.js';
import { normalizeAccountId } from '../../utils/account-id.js';
import {
  INTERNAL_MESSAGE_CHANNEL,
  isDeliverableMessageChannel,
  isGatewayMessageChannel,
  normalizeMessageChannel
} from '../../utils/message-channel.js';
import {
  resolveOutboundTarget,
  resolveSessionDeliveryTarget
} from './targets.js';
function resolveAgentDeliveryPlan(params) {
  const requestedRaw = typeof params.requestedChannel === 'string' ? params.requestedChannel.trim() : '';
  const normalizedRequested = requestedRaw ? normalizeMessageChannel(requestedRaw) : void 0;
  const requestedChannel = normalizedRequested || 'last';
  const explicitTo = typeof params.explicitTo === 'string' && params.explicitTo.trim() ? params.explicitTo.trim() : void 0;
  const baseDelivery = resolveSessionDeliveryTarget({
    entry: params.sessionEntry,
    requestedChannel: requestedChannel === INTERNAL_MESSAGE_CHANNEL ? 'last' : requestedChannel,
    explicitTo,
    explicitThreadId: params.explicitThreadId
  });
  const resolvedChannel = (() => {
    if (requestedChannel === INTERNAL_MESSAGE_CHANNEL) {
      return INTERNAL_MESSAGE_CHANNEL;
    }
    if (requestedChannel === 'last') {
      if (baseDelivery.channel && baseDelivery.channel !== INTERNAL_MESSAGE_CHANNEL) {
        return baseDelivery.channel;
      }
      return params.wantsDelivery ? DEFAULT_CHAT_CHANNEL : INTERNAL_MESSAGE_CHANNEL;
    }
    if (isGatewayMessageChannel(requestedChannel)) {
      return requestedChannel;
    }
    if (baseDelivery.channel && baseDelivery.channel !== INTERNAL_MESSAGE_CHANNEL) {
      return baseDelivery.channel;
    }
    return params.wantsDelivery ? DEFAULT_CHAT_CHANNEL : INTERNAL_MESSAGE_CHANNEL;
  })();
  const deliveryTargetMode = explicitTo ? 'explicit' : isDeliverableMessageChannel(resolvedChannel) ? 'implicit' : void 0;
  const resolvedAccountId = normalizeAccountId(params.accountId) ?? (deliveryTargetMode === 'implicit' ? baseDelivery.accountId : void 0);
  let resolvedTo = explicitTo;
  if (!resolvedTo && isDeliverableMessageChannel(resolvedChannel) && resolvedChannel === baseDelivery.lastChannel) {
    resolvedTo = baseDelivery.lastTo;
  }
  return {
    baseDelivery,
    resolvedChannel,
    resolvedTo,
    resolvedAccountId,
    resolvedThreadId: baseDelivery.threadId,
    deliveryTargetMode
  };
}
function resolveAgentOutboundTarget(params) {
  const targetMode = params.targetMode ?? params.plan.deliveryTargetMode ?? (params.plan.resolvedTo ? 'explicit' : 'implicit');
  if (!isDeliverableMessageChannel(params.plan.resolvedChannel)) {
    return {
      resolvedTarget: null,
      resolvedTo: params.plan.resolvedTo,
      targetMode
    };
  }
  if (params.validateExplicitTarget !== true && params.plan.resolvedTo) {
    return {
      resolvedTarget: null,
      resolvedTo: params.plan.resolvedTo,
      targetMode
    };
  }
  const resolvedTarget = resolveOutboundTarget({
    channel: params.plan.resolvedChannel,
    to: params.plan.resolvedTo,
    cfg: params.cfg,
    accountId: params.plan.resolvedAccountId,
    mode: targetMode
  });
  return {
    resolvedTarget,
    resolvedTo: resolvedTarget.ok ? resolvedTarget.to : params.plan.resolvedTo,
    targetMode
  };
}
export {
  resolveAgentDeliveryPlan,
  resolveAgentOutboundTarget
};
