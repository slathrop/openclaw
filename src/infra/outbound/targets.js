/**
 * SECURITY: Outbound target resolution and session delivery routing.
 * Validates delivery targets against allowlists, normalizes channel-specific
 * addressing formats, and prevents delivery to unauthorized recipients.
 * @module
 */

import { getChannelPlugin, normalizeChannelId } from '../../channels/plugins/index.js';
import { formatCliCommand } from '../../cli/command-format.js';
import { normalizeAccountId } from '../../routing/session-key.js';
import { deliveryContextFromSession } from '../../utils/delivery-context.js';
import {
  INTERNAL_MESSAGE_CHANNEL,
  isDeliverableMessageChannel,
  normalizeMessageChannel
} from '../../utils/message-channel.js';
import { missingTargetError } from './target-errors.js';
function resolveSessionDeliveryTarget(params) {
  const context = deliveryContextFromSession(params.entry);
  const lastChannel = context?.channel && isDeliverableMessageChannel(context.channel) ? context.channel : void 0;
  const lastTo = context?.to;
  const lastAccountId = context?.accountId;
  const lastThreadId = context?.threadId;
  const rawRequested = params.requestedChannel ?? 'last';
  const requested = rawRequested === 'last' ? 'last' : normalizeMessageChannel(rawRequested);
  const requestedChannel = requested === 'last' ? 'last' : requested && isDeliverableMessageChannel(requested) ? requested : void 0;
  const explicitTo = typeof params.explicitTo === 'string' && params.explicitTo.trim() ? params.explicitTo.trim() : void 0;
  const explicitThreadId = params.explicitThreadId !== null && params.explicitThreadId !== undefined && params.explicitThreadId !== '' ? params.explicitThreadId : void 0;
  let channel = requestedChannel === 'last' ? lastChannel : requestedChannel;
  if (!channel && params.fallbackChannel && isDeliverableMessageChannel(params.fallbackChannel)) {
    channel = params.fallbackChannel;
  }
  let to = explicitTo;
  if (!to && lastTo) {
    if (channel && channel === lastChannel) {
      to = lastTo;
    } else if (params.allowMismatchedLastTo) {
      to = lastTo;
    }
  }
  const accountId = channel && channel === lastChannel ? lastAccountId : void 0;
  const threadId = channel && channel === lastChannel ? lastThreadId : void 0;
  const mode = params.mode ?? (explicitTo ? 'explicit' : 'implicit');
  return {
    channel,
    to,
    accountId,
    threadId: explicitThreadId ?? threadId,
    mode,
    lastChannel,
    lastTo,
    lastAccountId,
    lastThreadId
  };
}
function resolveOutboundTarget(params) {
  if (params.channel === INTERNAL_MESSAGE_CHANNEL) {
    return {
      ok: false,
      error: new Error(
        `Delivering to WebChat is not supported via \`${formatCliCommand('openclaw agent')}\`; use WhatsApp/Telegram or run with --deliver=false.`
      )
    };
  }
  const plugin = getChannelPlugin(params.channel);
  if (!plugin) {
    return {
      ok: false,
      error: new Error(`Unsupported channel: ${params.channel}`)
    };
  }
  const allowFrom = params.allowFrom ?? (params.cfg && plugin.config.resolveAllowFrom ? plugin.config.resolveAllowFrom({
    cfg: params.cfg,
    accountId: params.accountId ?? void 0
  }) : void 0);
  const resolveTarget = plugin.outbound?.resolveTarget;
  if (resolveTarget) {
    return resolveTarget({
      cfg: params.cfg,
      to: params.to,
      allowFrom,
      accountId: params.accountId ?? void 0,
      mode: params.mode ?? 'explicit'
    });
  }
  const trimmed = params.to?.trim();
  if (trimmed) {
    return { ok: true, to: trimmed };
  }
  const hint = plugin.messaging?.targetResolver?.hint;
  return {
    ok: false,
    error: missingTargetError(plugin.meta.label ?? params.channel, hint)
  };
}
function resolveHeartbeatDeliveryTarget(params) {
  const { cfg, entry } = params;
  const heartbeat = params.heartbeat ?? cfg.agents?.defaults?.heartbeat;
  const rawTarget = heartbeat?.target;
  let target = 'last';
  if (rawTarget === 'none' || rawTarget === 'last') {
    target = rawTarget;
  } else if (typeof rawTarget === 'string') {
    const normalized = normalizeChannelId(rawTarget);
    if (normalized) {
      target = normalized;
    }
  }
  if (target === 'none') {
    const base = resolveSessionDeliveryTarget({ entry });
    return {
      channel: 'none',
      reason: 'target-none',
      accountId: void 0,
      lastChannel: base.lastChannel,
      lastAccountId: base.lastAccountId
    };
  }
  const resolvedTarget = resolveSessionDeliveryTarget({
    entry,
    requestedChannel: target === 'last' ? 'last' : target,
    explicitTo: heartbeat?.to,
    mode: 'heartbeat'
  });
  const heartbeatAccountId = heartbeat?.accountId?.trim();
  let effectiveAccountId = heartbeatAccountId || resolvedTarget.accountId;
  if (heartbeatAccountId && resolvedTarget.channel) {
    const plugin2 = getChannelPlugin(resolvedTarget.channel);
    const listAccountIds = plugin2?.config.listAccountIds;
    const accountIds = listAccountIds ? listAccountIds(cfg) : [];
    if (accountIds.length > 0) {
      const normalizedAccountId = normalizeAccountId(heartbeatAccountId);
      const normalizedAccountIds = new Set(
        accountIds.map((accountId) => normalizeAccountId(accountId))
      );
      if (!normalizedAccountIds.has(normalizedAccountId)) {
        return {
          channel: 'none',
          reason: 'unknown-account',
          accountId: normalizedAccountId,
          lastChannel: resolvedTarget.lastChannel,
          lastAccountId: resolvedTarget.lastAccountId
        };
      }
      effectiveAccountId = normalizedAccountId;
    }
  }
  if (!resolvedTarget.channel || !resolvedTarget.to) {
    return {
      channel: 'none',
      reason: 'no-target',
      accountId: effectiveAccountId,
      lastChannel: resolvedTarget.lastChannel,
      lastAccountId: resolvedTarget.lastAccountId
    };
  }
  const resolved = resolveOutboundTarget({
    channel: resolvedTarget.channel,
    to: resolvedTarget.to,
    cfg,
    accountId: effectiveAccountId,
    mode: 'heartbeat'
  });
  if (!resolved.ok) {
    return {
      channel: 'none',
      reason: 'no-target',
      accountId: effectiveAccountId,
      lastChannel: resolvedTarget.lastChannel,
      lastAccountId: resolvedTarget.lastAccountId
    };
  }
  let reason;
  const plugin = getChannelPlugin(resolvedTarget.channel);
  if (plugin?.config.resolveAllowFrom) {
    const explicit = resolveOutboundTarget({
      channel: resolvedTarget.channel,
      to: resolvedTarget.to,
      cfg,
      accountId: effectiveAccountId,
      mode: 'explicit'
    });
    if (explicit.ok && explicit.to !== resolved.to) {
      reason = 'allowFrom-fallback';
    }
  }
  return {
    channel: resolvedTarget.channel,
    to: resolved.to,
    reason,
    accountId: effectiveAccountId,
    lastChannel: resolvedTarget.lastChannel,
    lastAccountId: resolvedTarget.lastAccountId
  };
}
function resolveHeartbeatSenderId(params) {
  const { allowFrom, deliveryTo, lastTo, provider } = params;
  const candidates = [
    deliveryTo?.trim(),
    provider && deliveryTo ? `${provider}:${deliveryTo}` : void 0,
    lastTo?.trim(),
    provider && lastTo ? `${provider}:${lastTo}` : void 0
  ].filter((val) => Boolean(val?.trim()));
  const allowList = allowFrom.map((entry) => String(entry)).filter((entry) => entry && entry !== '*');
  if (allowFrom.includes('*')) {
    return candidates[0] ?? 'heartbeat';
  }
  if (candidates.length > 0 && allowList.length > 0) {
    const matched = candidates.find((candidate) => allowList.includes(candidate));
    if (matched) {
      return matched;
    }
  }
  if (candidates.length > 0 && allowList.length === 0) {
    return candidates[0];
  }
  if (allowList.length > 0) {
    return allowList[0];
  }
  return candidates[0] ?? 'heartbeat';
}
function resolveHeartbeatSenderContext(params) {
  const provider = params.delivery.channel !== 'none' ? params.delivery.channel : params.delivery.lastChannel;
  const accountId = params.delivery.accountId ?? (provider === params.delivery.lastChannel ? params.delivery.lastAccountId : void 0);
  const allowFrom = provider ? getChannelPlugin(provider)?.config.resolveAllowFrom?.({
    cfg: params.cfg,
    accountId
  }) ?? [] : [];
  const sender = resolveHeartbeatSenderId({
    allowFrom,
    deliveryTo: params.delivery.to,
    lastTo: params.entry?.lastTo,
    provider
  });
  return { sender, provider, allowFrom };
}
export {
  resolveHeartbeatDeliveryTarget,
  resolveHeartbeatSenderContext,
  resolveOutboundTarget,
  resolveSessionDeliveryTarget
};
