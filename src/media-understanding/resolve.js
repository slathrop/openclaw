import { logVerbose, shouldLogVerbose } from '../globals.js';
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_CHARS_BY_CAPABILITY,
  DEFAULT_MEDIA_CONCURRENCY,
  DEFAULT_PROMPT
} from './defaults.js';
import { normalizeMediaProviderId } from './providers/index.js';
import { normalizeMediaUnderstandingChatType, resolveMediaUnderstandingScope } from './scope.js';
function resolveTimeoutMs(seconds, fallbackSeconds) {
  const value = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : fallbackSeconds;
  return Math.max(1e3, Math.floor(value * 1e3));
}
function resolvePrompt(capability, prompt, maxChars) {
  const base = prompt?.trim() || DEFAULT_PROMPT[capability];
  if (!maxChars || capability === 'audio') {
    return base;
  }
  return `${base} Respond in at most ${maxChars} characters.`;
}
function resolveMaxChars(params) {
  const { capability, entry, cfg } = params;
  const configured = entry.maxChars ?? params.config?.maxChars ?? cfg.tools?.media?.[capability]?.maxChars;
  if (typeof configured === 'number') {
    return configured;
  }
  return DEFAULT_MAX_CHARS_BY_CAPABILITY[capability];
}
function resolveMaxBytes(params) {
  const configured = params.entry.maxBytes ?? params.config?.maxBytes ?? params.cfg.tools?.media?.[params.capability]?.maxBytes;
  if (typeof configured === 'number') {
    return configured;
  }
  return DEFAULT_MAX_BYTES[params.capability];
}
function resolveCapabilityConfig(cfg, capability) {
  return cfg.tools?.media?.[capability];
}
function resolveScopeDecision(params) {
  return resolveMediaUnderstandingScope({
    scope: params.scope,
    sessionKey: params.ctx.SessionKey,
    channel: params.ctx.Surface ?? params.ctx.Provider,
    chatType: normalizeMediaUnderstandingChatType(params.ctx.ChatType)
  });
}
function resolveEntryCapabilities(params) {
  const entryType = params.entry.type ?? (params.entry.command ? 'cli' : 'provider');
  if (entryType === 'cli') {
    return void 0;
  }
  const providerId = normalizeMediaProviderId(params.entry.provider ?? '');
  if (!providerId) {
    return void 0;
  }
  return params.providerRegistry.get(providerId)?.capabilities;
}
function resolveModelEntries(params) {
  const { cfg, capability, config } = params;
  const sharedModels = cfg.tools?.media?.models ?? [];
  const entries = [
    ...(config?.models ?? []).map((entry) => ({ entry, source: 'capability' })),
    ...sharedModels.map((entry) => ({ entry, source: 'shared' }))
  ];
  if (entries.length === 0) {
    return [];
  }
  return entries.filter(({ entry, source }) => {
    const caps = entry.capabilities && entry.capabilities.length > 0 ? entry.capabilities : source === 'shared' ? resolveEntryCapabilities({ entry, providerRegistry: params.providerRegistry }) : void 0;
    if (!caps || caps.length === 0) {
      if (source === 'shared') {
        if (shouldLogVerbose()) {
          logVerbose(
            `Skipping shared media model without capabilities: ${entry.provider ?? entry.command ?? 'unknown'}`
          );
        }
        return false;
      }
      return true;
    }
    return caps.includes(capability);
  }).map(({ entry }) => entry);
}
function resolveConcurrency(cfg) {
  const configured = cfg.tools?.media?.concurrency;
  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  return DEFAULT_MEDIA_CONCURRENCY;
}
function resolveEntriesWithActiveFallback(params) {
  const entries = resolveModelEntries({
    cfg: params.cfg,
    capability: params.capability,
    config: params.config,
    providerRegistry: params.providerRegistry
  });
  if (entries.length > 0) {
    return entries;
  }
  if (params.config?.enabled !== true) {
    return entries;
  }
  const activeProviderRaw = params.activeModel?.provider?.trim();
  if (!activeProviderRaw) {
    return entries;
  }
  const activeProvider = normalizeMediaProviderId(activeProviderRaw);
  if (!activeProvider) {
    return entries;
  }
  const capabilities = params.providerRegistry.get(activeProvider)?.capabilities;
  if (!capabilities || !capabilities.includes(params.capability)) {
    return entries;
  }
  return [
    {
      type: 'provider',
      provider: activeProvider,
      model: params.activeModel?.model
    }
  ];
}
export {
  resolveCapabilityConfig,
  resolveConcurrency,
  resolveEntriesWithActiveFallback,
  resolveMaxBytes,
  resolveMaxChars,
  resolveModelEntries,
  resolvePrompt,
  resolveScopeDecision,
  resolveTimeoutMs
};
