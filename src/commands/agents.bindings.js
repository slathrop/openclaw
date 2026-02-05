const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveChannelDefaultAccountId } from '../channels/plugins/helpers.js';
import { getChannelPlugin, normalizeChannelId } from '../channels/plugins/index.js';
import { DEFAULT_ACCOUNT_ID, normalizeAgentId } from '../routing/session-key.js';
function bindingMatchKey(match) {
  const accountId = match.accountId?.trim() || DEFAULT_ACCOUNT_ID;
  return [
    match.channel,
    accountId,
    match.peer?.kind ?? '',
    match.peer?.id ?? '',
    match.guildId ?? '',
    match.teamId ?? ''
  ].join('|');
}
__name(bindingMatchKey, 'bindingMatchKey');
function describeBinding(binding) {
  const match = binding.match;
  const parts = [match.channel];
  if (match.accountId) {
    parts.push(`accountId=${match.accountId}`);
  }
  if (match.peer) {
    parts.push(`peer=${match.peer.kind}:${match.peer.id}`);
  }
  if (match.guildId) {
    parts.push(`guild=${match.guildId}`);
  }
  if (match.teamId) {
    parts.push(`team=${match.teamId}`);
  }
  return parts.join(' ');
}
__name(describeBinding, 'describeBinding');
function applyAgentBindings(cfg, bindings) {
  const existing = cfg.bindings ?? [];
  const existingMatchMap = /* @__PURE__ */ new Map();
  for (const binding of existing) {
    const key = bindingMatchKey(binding.match);
    if (!existingMatchMap.has(key)) {
      existingMatchMap.set(key, normalizeAgentId(binding.agentId));
    }
  }
  const added = [];
  const skipped = [];
  const conflicts = [];
  for (const binding of bindings) {
    const agentId = normalizeAgentId(binding.agentId);
    const key = bindingMatchKey(binding.match);
    const existingAgentId = existingMatchMap.get(key);
    if (existingAgentId) {
      if (existingAgentId === agentId) {
        skipped.push(binding);
      } else {
        conflicts.push({ binding, existingAgentId });
      }
      continue;
    }
    existingMatchMap.set(key, agentId);
    added.push({ ...binding, agentId });
  }
  if (added.length === 0) {
    return { config: cfg, added, skipped, conflicts };
  }
  return {
    config: {
      ...cfg,
      bindings: [...existing, ...added]
    },
    added,
    skipped,
    conflicts
  };
}
__name(applyAgentBindings, 'applyAgentBindings');
function resolveDefaultAccountId(cfg, provider) {
  const plugin = getChannelPlugin(provider);
  if (!plugin) {
    return DEFAULT_ACCOUNT_ID;
  }
  return resolveChannelDefaultAccountId({ plugin, cfg });
}
__name(resolveDefaultAccountId, 'resolveDefaultAccountId');
function buildChannelBindings(params) {
  const bindings = [];
  const agentId = normalizeAgentId(params.agentId);
  for (const channel of params.selection) {
    const match = { channel };
    const accountId = params.accountIds?.[channel]?.trim();
    if (accountId) {
      match.accountId = accountId;
    } else {
      const plugin = getChannelPlugin(channel);
      if (plugin?.meta.forceAccountBinding) {
        match.accountId = resolveDefaultAccountId(params.config, channel);
      }
    }
    bindings.push({ agentId, match });
  }
  return bindings;
}
__name(buildChannelBindings, 'buildChannelBindings');
function parseBindingSpecs(params) {
  const bindings = [];
  const errors = [];
  const specs = params.specs ?? [];
  const agentId = normalizeAgentId(params.agentId);
  for (const raw of specs) {
    const trimmed = raw?.trim();
    if (!trimmed) {
      continue;
    }
    const [channelRaw, accountRaw] = trimmed.split(':', 2);
    const channel = normalizeChannelId(channelRaw);
    if (!channel) {
      errors.push(`Unknown channel "${channelRaw}".`);
      continue;
    }
    let accountId = accountRaw?.trim();
    if (accountRaw !== void 0 && !accountId) {
      errors.push(`Invalid binding "${trimmed}" (empty account id).`);
      continue;
    }
    if (!accountId) {
      const plugin = getChannelPlugin(channel);
      if (plugin?.meta.forceAccountBinding) {
        accountId = resolveDefaultAccountId(params.config, channel);
      }
    }
    const match = { channel };
    if (accountId) {
      match.accountId = accountId;
    }
    bindings.push({ agentId, match });
  }
  return { bindings, errors };
}
__name(parseBindingSpecs, 'parseBindingSpecs');
export {
  applyAgentBindings,
  buildChannelBindings,
  describeBinding,
  parseBindingSpecs
};
