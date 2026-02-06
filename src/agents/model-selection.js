/**
 * @module model-selection
 * Model selection logic -- matching user preferences to available models.
 * @typedef {object} ModelMatch - A matched model from selection logic.
 * @typedef {object} ModelSelectionOptions
 * @typedef {object} SelectionResult
 * @property
 */

import { resolveAgentModelPrimary } from './agent-scope.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from './defaults.js';
import { normalizeGoogleModelId } from './models-config.providers.js';

const ANTHROPIC_MODEL_ALIASES = {
  'opus-4.6': 'claude-opus-4-6',
  'opus-4.5': 'claude-opus-4-5',
  'sonnet-4.5': 'claude-sonnet-4-5'
};

function normalizeAliasKey(value) {
  return value.trim().toLowerCase();
}
function modelKey(provider, model) {
  return `${provider}/${model}`;
}
function normalizeProviderId(provider) {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'z.ai' || normalized === 'z-ai') {
    return 'zai';
  }
  if (normalized === 'opencode-zen') {
    return 'opencode';
  }
  if (normalized === 'qwen') {
    return 'qwen-portal';
  }
  if (normalized === 'kimi-code') {
    return 'kimi-coding';
  }
  return normalized;
}
function isCliProvider(provider, cfg) {
  const normalized = normalizeProviderId(provider);
  if (normalized === 'claude-cli') {
    return true;
  }
  if (normalized === 'codex-cli') {
    return true;
  }
  const backends = cfg?.agents?.defaults?.cliBackends ?? {};
  return Object.keys(backends).some((key) => normalizeProviderId(key) === normalized);
}
function normalizeAnthropicModelId(model) {
  const trimmed = model.trim();
  if (!trimmed) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  return ANTHROPIC_MODEL_ALIASES[lower] ?? trimmed;
}
function normalizeProviderModelId(provider, model) {
  if (provider === 'anthropic') {
    return normalizeAnthropicModelId(model);
  }
  if (provider === 'google') {
    return normalizeGoogleModelId(model);
  }
  return model;
}
function parseModelRef(raw, defaultProvider) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const slash = trimmed.indexOf('/');
  if (slash === -1) {
    const provider2 = normalizeProviderId(defaultProvider);
    const model2 = normalizeProviderModelId(provider2, trimmed);
    return { provider: provider2, model: model2 };
  }
  const providerRaw = trimmed.slice(0, slash).trim();
  const provider = normalizeProviderId(providerRaw);
  const model = trimmed.slice(slash + 1).trim();
  if (!provider || !model) {
    return null;
  }
  const normalizedModel = normalizeProviderModelId(provider, model);
  return { provider, model: normalizedModel };
}
function resolveAllowlistModelKey(raw, defaultProvider) {
  const parsed = parseModelRef(raw, defaultProvider);
  if (!parsed) {
    return null;
  }
  return modelKey(parsed.provider, parsed.model);
}
function buildConfiguredAllowlistKeys(params) {
  const rawAllowlist = Object.keys(params.cfg?.agents?.defaults?.models ?? {});
  if (rawAllowlist.length === 0) {
    return null;
  }
  const keys = new Set();
  for (const raw of rawAllowlist) {
    const key = resolveAllowlistModelKey(String(raw ?? ''), params.defaultProvider);
    if (key) {
      keys.add(key);
    }
  }
  return keys.size > 0 ? keys : null;
}
function buildModelAliasIndex(params) {
  const byAlias = /* @__PURE__ */ new Map();
  const byKey = /* @__PURE__ */ new Map();
  const rawModels = params.cfg.agents?.defaults?.models ?? {};
  for (const [keyRaw, entryRaw] of Object.entries(rawModels)) {
    const parsed = parseModelRef(String(keyRaw ?? ''), params.defaultProvider);
    if (!parsed) {
      continue;
    }
    const alias = String(entryRaw?.alias ?? '').trim();
    if (!alias) {
      continue;
    }
    const aliasKey = normalizeAliasKey(alias);
    byAlias.set(aliasKey, { alias, ref: parsed });
    const key = modelKey(parsed.provider, parsed.model);
    const existing = byKey.get(key) ?? [];
    existing.push(alias);
    byKey.set(key, existing);
  }
  return { byAlias, byKey };
}
function resolveModelRefFromString(params) {
  const trimmed = params.raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.includes('/')) {
    const aliasKey = normalizeAliasKey(trimmed);
    const aliasMatch = params.aliasIndex?.byAlias.get(aliasKey);
    if (aliasMatch) {
      return { ref: aliasMatch.ref, alias: aliasMatch.alias };
    }
  }
  const parsed = parseModelRef(trimmed, params.defaultProvider);
  if (!parsed) {
    return null;
  }
  return { ref: parsed };
}
function resolveConfiguredModelRef(params) {
  const rawModel = (() => {
    const raw = params.cfg.agents?.defaults?.model;
    if (typeof raw === 'string') {
      return raw.trim();
    }
    return raw?.primary?.trim() ?? '';
  })();
  if (rawModel) {
    const trimmed = rawModel.trim();
    const aliasIndex = buildModelAliasIndex({
      cfg: params.cfg,
      defaultProvider: params.defaultProvider
    });
    if (!trimmed.includes('/')) {
      const aliasKey = normalizeAliasKey(trimmed);
      const aliasMatch = aliasIndex.byAlias.get(aliasKey);
      if (aliasMatch) {
        return aliasMatch.ref;
      }
      console.warn(
        `[openclaw] Model "${trimmed}" specified without provider. Falling back to "anthropic/${trimmed}". Please use "anthropic/${trimmed}" in your config.`
      );
      return { provider: 'anthropic', model: trimmed };
    }
    const resolved = resolveModelRefFromString({
      raw: trimmed,
      defaultProvider: params.defaultProvider,
      aliasIndex
    });
    if (resolved) {
      return resolved.ref;
    }
  }
  return { provider: params.defaultProvider, model: params.defaultModel };
}
function resolveDefaultModelForAgent(params) {
  const agentModelOverride = params.agentId ? resolveAgentModelPrimary(params.cfg, params.agentId) : void 0;
  const cfg = agentModelOverride && agentModelOverride.length > 0 ? {
    ...params.cfg,
    agents: {
      ...params.cfg.agents,
      defaults: {
        ...params.cfg.agents?.defaults,
        model: {
          ...typeof params.cfg.agents?.defaults?.model === 'object' ? params.cfg.agents.defaults.model : void 0,
          primary: agentModelOverride
        }
      }
    }
  } : params.cfg;
  return resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
}
function buildAllowedModelSet(params) {
  const rawAllowlist = (() => {
    const modelMap = params.cfg.agents?.defaults?.models ?? {};
    return Object.keys(modelMap);
  })();
  const allowAny = rawAllowlist.length === 0;
  const defaultModel = params.defaultModel?.trim();
  const defaultKey = defaultModel && params.defaultProvider ? modelKey(params.defaultProvider, defaultModel) : void 0;
  const catalogKeys = new Set(params.catalog.map((entry) => modelKey(entry.provider, entry.id)));
  if (allowAny) {
    if (defaultKey) {
      catalogKeys.add(defaultKey);
    }
    return {
      allowAny: true,
      allowedCatalog: params.catalog,
      allowedKeys: catalogKeys
    };
  }
  const allowedKeys = /* @__PURE__ */ new Set();
  const configuredProviders = params.cfg.models?.providers ?? {};
  for (const raw of rawAllowlist) {
    const parsed = parseModelRef(String(raw), params.defaultProvider);
    if (!parsed) {
      continue;
    }
    const key = modelKey(parsed.provider, parsed.model);
    const providerKey = normalizeProviderId(parsed.provider);
    if (isCliProvider(parsed.provider, params.cfg)) {
      allowedKeys.add(key);
    } else if (catalogKeys.has(key)) {
      allowedKeys.add(key);
    } else if (configuredProviders[providerKey] !== null && configuredProviders[providerKey] !== undefined) {
      allowedKeys.add(key);
    }
  }
  if (defaultKey) {
    allowedKeys.add(defaultKey);
  }
  const allowedCatalog = params.catalog.filter(
    (entry) => allowedKeys.has(modelKey(entry.provider, entry.id))
  );
  if (allowedCatalog.length === 0 && allowedKeys.size === 0) {
    if (defaultKey) {
      catalogKeys.add(defaultKey);
    }
    return {
      allowAny: true,
      allowedCatalog: params.catalog,
      allowedKeys: catalogKeys
    };
  }
  return { allowAny: false, allowedCatalog, allowedKeys };
}
function getModelRefStatus(params) {
  const allowed = buildAllowedModelSet({
    cfg: params.cfg,
    catalog: params.catalog,
    defaultProvider: params.defaultProvider,
    defaultModel: params.defaultModel
  });
  const key = modelKey(params.ref.provider, params.ref.model);
  return {
    key,
    inCatalog: params.catalog.some((entry) => modelKey(entry.provider, entry.id) === key),
    allowAny: allowed.allowAny,
    allowed: allowed.allowAny || allowed.allowedKeys.has(key)
  };
}
function resolveAllowedModelRef(params) {
  const trimmed = params.raw.trim();
  if (!trimmed) {
    return { error: 'invalid model: empty' };
  }
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: params.defaultProvider
  });
  const resolved = resolveModelRefFromString({
    raw: trimmed,
    defaultProvider: params.defaultProvider,
    aliasIndex
  });
  if (!resolved) {
    return { error: `invalid model: ${trimmed}` };
  }
  const status = getModelRefStatus({
    cfg: params.cfg,
    catalog: params.catalog,
    ref: resolved.ref,
    defaultProvider: params.defaultProvider,
    defaultModel: params.defaultModel
  });
  if (!status.allowed) {
    return { error: `model not allowed: ${status.key}` };
  }
  return { ref: resolved.ref, key: status.key };
}
function resolveThinkingDefault(params) {
  const configured = params.cfg.agents?.defaults?.thinkingDefault;
  if (configured) {
    return configured;
  }
  const candidate = params.catalog?.find(
    (entry) => entry.provider === params.provider && entry.id === params.model
  );
  if (candidate?.reasoning) {
    return 'low';
  }
  return 'off';
}
function resolveHooksGmailModel(params) {
  const hooksModel = params.cfg.hooks?.gmail?.model;
  if (!hooksModel?.trim()) {
    return null;
  }
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: params.defaultProvider
  });
  const resolved = resolveModelRefFromString({
    raw: hooksModel,
    defaultProvider: params.defaultProvider,
    aliasIndex
  });
  return resolved?.ref ?? null;
}
export {
  buildAllowedModelSet,
  buildConfiguredAllowlistKeys,
  buildModelAliasIndex,
  getModelRefStatus,
  isCliProvider,
  modelKey,
  normalizeProviderId,
  parseModelRef,
  resolveAllowedModelRef,
  resolveAllowlistModelKey,
  resolveConfiguredModelRef,
  resolveDefaultModelForAgent,
  resolveHooksGmailModel,
  resolveModelRefFromString,
  resolveThinkingDefault
};
