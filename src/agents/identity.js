/**
 * @module identity
 * Agent identity resolution -- name, avatar, and persona.
 */
import { resolveAgentConfig } from './agent-scope.js';
const DEFAULT_ACK_REACTION = '\u{1F440}';
function resolveAgentIdentity(cfg, agentId) {
  return resolveAgentConfig(cfg, agentId)?.identity;
}
function resolveAckReaction(cfg, agentId) {
  const configured = cfg.messages?.ackReaction;
  if (configured !== void 0) {
    return configured.trim();
  }
  const emoji = resolveAgentIdentity(cfg, agentId)?.emoji?.trim();
  return emoji || DEFAULT_ACK_REACTION;
}
function resolveIdentityNamePrefix(cfg, agentId) {
  const name = resolveAgentIdentity(cfg, agentId)?.name?.trim();
  if (!name) {
    return void 0;
  }
  return `[${name}]`;
}
function resolveIdentityName(cfg, agentId) {
  return resolveAgentIdentity(cfg, agentId)?.name?.trim() || void 0;
}
function resolveMessagePrefix(cfg, agentId, opts) {
  const configured = opts?.configured ?? cfg.messages?.messagePrefix;
  if (configured !== void 0) {
    return configured;
  }
  const hasAllowFrom = opts?.hasAllowFrom === true;
  if (hasAllowFrom) {
    return '';
  }
  return resolveIdentityNamePrefix(cfg, agentId) ?? opts?.fallback ?? '[openclaw]';
}
function getChannelConfig(cfg, channel) {
  const channels = cfg.channels;
  const value = channels?.[channel];
  return typeof value === 'object' && value !== null ? value : void 0;
}
function resolveResponsePrefix(cfg, agentId, opts) {
  if (opts?.channel && opts?.accountId) {
    const channelCfg = getChannelConfig(cfg, opts.channel);
    const accounts = channelCfg?.accounts;
    const accountPrefix = accounts?.[opts.accountId]?.responsePrefix;
    if (accountPrefix !== void 0) {
      if (accountPrefix === 'auto') {
        return resolveIdentityNamePrefix(cfg, agentId);
      }
      return accountPrefix;
    }
  }
  if (opts?.channel) {
    const channelCfg = getChannelConfig(cfg, opts.channel);
    const channelPrefix = channelCfg?.responsePrefix;
    if (channelPrefix !== void 0) {
      if (channelPrefix === 'auto') {
        return resolveIdentityNamePrefix(cfg, agentId);
      }
      return channelPrefix;
    }
  }
  const configured = cfg.messages?.responsePrefix;
  if (configured !== void 0) {
    if (configured === 'auto') {
      return resolveIdentityNamePrefix(cfg, agentId);
    }
    return configured;
  }
  return void 0;
}
function resolveEffectiveMessagesConfig(cfg, agentId, opts) {
  return {
    messagePrefix: resolveMessagePrefix(cfg, agentId, {
      hasAllowFrom: opts?.hasAllowFrom,
      fallback: opts?.fallbackMessagePrefix
    }),
    responsePrefix: resolveResponsePrefix(cfg, agentId, {
      channel: opts?.channel,
      accountId: opts?.accountId
    })
  };
}
function resolveHumanDelayConfig(cfg, agentId) {
  const defaults = cfg.agents?.defaults?.humanDelay;
  const overrides = resolveAgentConfig(cfg, agentId)?.humanDelay;
  if (!defaults && !overrides) {
    return void 0;
  }
  return {
    mode: overrides?.mode ?? defaults?.mode,
    minMs: overrides?.minMs ?? defaults?.minMs,
    maxMs: overrides?.maxMs ?? defaults?.maxMs
  };
}
export {
  resolveAckReaction,
  resolveAgentIdentity,
  resolveEffectiveMessagesConfig,
  resolveHumanDelayConfig,
  resolveIdentityName,
  resolveIdentityNamePrefix,
  resolveMessagePrefix,
  resolveResponsePrefix
};
