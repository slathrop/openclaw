/**
 * SECURITY: Cross-context messaging policy enforcement.
 * Prevents agents from sending messages to unauthorized channels/targets.
 * Enforces same-provider and cross-provider messaging restrictions
 * based on tool context and configuration policy.
 * @module
 */

import { getChannelMessageAdapter } from './channel-adapters.js';
import { normalizeTargetForProvider } from './target-normalization.js';
import { formatTargetDisplay, lookupDirectoryDisplay } from './target-resolver.js';
const CONTEXT_GUARDED_ACTIONS = /* @__PURE__ */ new Set([
  'send',
  'poll',
  'reply',
  'sendWithEffect',
  'sendAttachment',
  'thread-create',
  'thread-reply',
  'sticker'
]);
const CONTEXT_MARKER_ACTIONS = /* @__PURE__ */ new Set([
  'send',
  'poll',
  'reply',
  'sendWithEffect',
  'sendAttachment',
  'thread-reply',
  'sticker'
]);
function resolveContextGuardTarget(action, params) {
  if (!CONTEXT_GUARDED_ACTIONS.has(action)) {
    return void 0;
  }
  if (action === 'thread-reply' || action === 'thread-create') {
    if (typeof params.channelId === 'string') {
      return params.channelId;
    }
    if (typeof params.to === 'string') {
      return params.to;
    }
    return void 0;
  }
  if (typeof params.to === 'string') {
    return params.to;
  }
  if (typeof params.channelId === 'string') {
    return params.channelId;
  }
  return void 0;
}
function normalizeTarget(channel, raw) {
  return normalizeTargetForProvider(channel, raw) ?? raw.trim().toLowerCase();
}
function isCrossContextTarget(params) {
  const currentTarget = params.toolContext?.currentChannelId?.trim();
  if (!currentTarget) {
    return false;
  }
  const normalizedTarget = normalizeTarget(params.channel, params.target);
  const normalizedCurrent = normalizeTarget(params.channel, currentTarget);
  if (!normalizedTarget || !normalizedCurrent) {
    return false;
  }
  return normalizedTarget !== normalizedCurrent;
}
function enforceCrossContextPolicy(params) {
  const currentTarget = params.toolContext?.currentChannelId?.trim();
  if (!currentTarget) {
    return;
  }
  if (!CONTEXT_GUARDED_ACTIONS.has(params.action)) {
    return;
  }
  if (params.cfg.tools?.message?.allowCrossContextSend) {
    return;
  }
  const currentProvider = params.toolContext?.currentChannelProvider;
  const allowWithinProvider = params.cfg.tools?.message?.crossContext?.allowWithinProvider !== false;
  const allowAcrossProviders = params.cfg.tools?.message?.crossContext?.allowAcrossProviders === true;
  if (currentProvider && currentProvider !== params.channel) {
    if (!allowAcrossProviders) {
      throw new Error(
        `Cross-context messaging denied: action=${params.action} target provider "${params.channel}" while bound to "${currentProvider}".`
      );
    }
    return;
  }
  if (allowWithinProvider) {
    return;
  }
  const target = resolveContextGuardTarget(params.action, params.args);
  if (!target) {
    return;
  }
  if (!isCrossContextTarget({ channel: params.channel, target, toolContext: params.toolContext })) {
    return;
  }
  throw new Error(
    `Cross-context messaging denied: action=${params.action} target="${target}" while bound to "${currentTarget}" (channel=${params.channel}).`
  );
}
async function buildCrossContextDecoration(params) {
  if (!params.toolContext?.currentChannelId) {
    return null;
  }
  if (params.toolContext.skipCrossContextDecoration) {
    return null;
  }
  if (!isCrossContextTarget(params)) {
    return null;
  }
  const markerConfig = params.cfg.tools?.message?.crossContext?.marker;
  if (markerConfig?.enabled === false) {
    return null;
  }
  const currentName = await lookupDirectoryDisplay({
    cfg: params.cfg,
    channel: params.channel,
    targetId: params.toolContext.currentChannelId,
    accountId: params.accountId ?? void 0
  }) ?? params.toolContext.currentChannelId;
  const originLabel = formatTargetDisplay({
    channel: params.channel,
    target: params.toolContext.currentChannelId,
    display: currentName
  });
  const prefixTemplate = markerConfig?.prefix ?? '[from {channel}] ';
  const suffixTemplate = markerConfig?.suffix ?? '';
  const prefix = prefixTemplate.replaceAll('{channel}', originLabel);
  const suffix = suffixTemplate.replaceAll('{channel}', originLabel);
  const adapter = getChannelMessageAdapter(params.channel);
  const embeds = adapter.supportsEmbeds ? adapter.buildCrossContextEmbeds?.(originLabel) ?? void 0 : void 0;
  return { prefix, suffix, embeds };
}
function shouldApplyCrossContextMarker(action) {
  return CONTEXT_MARKER_ACTIONS.has(action);
}
function applyCrossContextDecoration(params) {
  const useEmbeds = params.preferEmbeds && params.decoration.embeds?.length;
  if (useEmbeds) {
    return { message: params.message, embeds: params.decoration.embeds, usedEmbeds: true };
  }
  const message = `${params.decoration.prefix}${params.message}${params.decoration.suffix}`;
  return { message, usedEmbeds: false };
}
export {
  applyCrossContextDecoration,
  buildCrossContextDecoration,
  enforceCrossContextPolicy,
  shouldApplyCrossContextMarker
};
