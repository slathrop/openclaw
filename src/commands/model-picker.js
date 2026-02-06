const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { ensureAuthProfileStore, listProfilesForProvider } from '../agents/auth-profiles.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../agents/defaults.js';
import { getCustomProviderApiKey, resolveEnvApiKey } from '../agents/model-auth.js';
import { loadModelCatalog } from '../agents/model-catalog.js';
import {
  buildAllowedModelSet,
  buildModelAliasIndex,
  modelKey,
  normalizeProviderId,
  resolveConfiguredModelRef
} from '../agents/model-selection.js';
import { formatTokenK } from './models/shared.js';
const KEEP_VALUE = '__keep__';
const MANUAL_VALUE = '__manual__';
const PROVIDER_FILTER_THRESHOLD = 30;
const HIDDEN_ROUTER_MODELS = /* @__PURE__ */ new Set(['openrouter/auto']);
function hasAuthForProvider(provider, cfg, store) {
  if (listProfilesForProvider(store, provider).length > 0) {
    return true;
  }
  if (resolveEnvApiKey(provider)) {
    return true;
  }
  if (getCustomProviderApiKey(cfg, provider)) {
    return true;
  }
  return false;
}
__name(hasAuthForProvider, 'hasAuthForProvider');
function resolveConfiguredModelRaw(cfg) {
  const raw = cfg.agents?.defaults?.model;
  if (typeof raw === 'string') {
    return raw.trim();
  }
  return raw?.primary?.trim() ?? '';
}
__name(resolveConfiguredModelRaw, 'resolveConfiguredModelRaw');
function resolveConfiguredModelKeys(cfg) {
  const models = cfg.agents?.defaults?.models ?? {};
  return Object.keys(models).map((key) => String(key ?? '').trim()).filter((key) => key.length > 0);
}
__name(resolveConfiguredModelKeys, 'resolveConfiguredModelKeys');
function normalizeModelKeys(values) {
  const seen = /* @__PURE__ */ new Set();
  const next = [];
  for (const raw of values) {
    const value = String(raw ?? '').trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    next.push(value);
  }
  return next;
}
__name(normalizeModelKeys, 'normalizeModelKeys');
async function promptManualModel(params) {
  const modelInput = await params.prompter.text({
    message: params.allowBlank ? 'Default model (blank to keep)' : 'Default model',
    initialValue: params.initialValue,
    placeholder: 'provider/model',
    validate: params.allowBlank ? void 0 : (value) => value?.trim() ? void 0 : 'Required'
  });
  const model = String(modelInput ?? '').trim();
  if (!model) {
    return {};
  }
  return { model };
}
__name(promptManualModel, 'promptManualModel');
async function promptDefaultModel(params) {
  const cfg = params.config;
  const allowKeep = params.allowKeep ?? true;
  const includeManual = params.includeManual ?? true;
  const ignoreAllowlist = params.ignoreAllowlist ?? false;
  const preferredProviderRaw = params.preferredProvider?.trim();
  const preferredProvider = preferredProviderRaw ? normalizeProviderId(preferredProviderRaw) : void 0;
  const configuredRaw = resolveConfiguredModelRaw(cfg);
  const resolved = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
  const resolvedKey = modelKey(resolved.provider, resolved.model);
  const configuredKey = configuredRaw ? resolvedKey : '';
  const catalog = await loadModelCatalog({ config: cfg, useCache: false });
  if (catalog.length === 0) {
    return promptManualModel({
      prompter: params.prompter,
      allowBlank: allowKeep,
      initialValue: configuredRaw || resolvedKey || void 0
    });
  }
  const aliasIndex = buildModelAliasIndex({
    cfg,
    defaultProvider: DEFAULT_PROVIDER
  });
  let models = catalog;
  if (!ignoreAllowlist) {
    const { allowedCatalog } = buildAllowedModelSet({
      cfg,
      catalog,
      defaultProvider: DEFAULT_PROVIDER
    });
    models = allowedCatalog.length > 0 ? allowedCatalog : catalog;
  }
  if (models.length === 0) {
    return promptManualModel({
      prompter: params.prompter,
      allowBlank: allowKeep,
      initialValue: configuredRaw || resolvedKey || void 0
    });
  }
  const providers = Array.from(new Set(models.map((entry) => entry.provider))).toSorted(
    (a, b) => a.localeCompare(b)
  );
  const hasPreferredProvider = preferredProvider ? providers.includes(preferredProvider) : false;
  const shouldPromptProvider = !hasPreferredProvider && providers.length > 1 && models.length > PROVIDER_FILTER_THRESHOLD;
  if (shouldPromptProvider) {
    const selection2 = await params.prompter.select({
      message: 'Filter models by provider',
      options: [
        { value: '*', label: 'All providers' },
        ...providers.map((provider) => {
          const count = models.filter((entry) => entry.provider === provider).length;
          return {
            value: provider,
            label: provider,
            hint: `${count} model${count === 1 ? '' : 's'}`
          };
        })
      ]
    });
    if (selection2 !== '*') {
      models = models.filter((entry) => entry.provider === selection2);
    }
  }
  if (hasPreferredProvider && preferredProvider) {
    models = models.filter((entry) => entry.provider === preferredProvider);
  }
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false
  });
  const authCache = /* @__PURE__ */ new Map();
  const hasAuth = /* @__PURE__ */ __name((provider) => {
    const cached = authCache.get(provider);
    if (cached !== void 0) {
      return cached;
    }
    const value = hasAuthForProvider(provider, cfg, authStore);
    authCache.set(provider, value);
    return value;
  }, 'hasAuth');
  const options = [];
  if (allowKeep) {
    options.push({
      value: KEEP_VALUE,
      label: configuredRaw ? `Keep current (${configuredRaw})` : `Keep current (default: ${resolvedKey})`,
      hint: configuredRaw && configuredRaw !== resolvedKey ? `resolves to ${resolvedKey}` : void 0
    });
  }
  if (includeManual) {
    options.push({ value: MANUAL_VALUE, label: 'Enter model manually' });
  }
  const seen = /* @__PURE__ */ new Set();
  const addModelOption = /* @__PURE__ */ __name((entry) => {
    const key = modelKey(entry.provider, entry.id);
    if (seen.has(key)) {
      return;
    }
    if (HIDDEN_ROUTER_MODELS.has(key)) {
      return;
    }
    const hints = [];
    if (entry.name && entry.name !== entry.id) {
      hints.push(entry.name);
    }
    if (entry.contextWindow) {
      hints.push(`ctx ${formatTokenK(entry.contextWindow)}`);
    }
    if (entry.reasoning) {
      hints.push('reasoning');
    }
    const aliases = aliasIndex.byKey.get(key);
    if (aliases?.length) {
      hints.push(`alias: ${aliases.join(', ')}`);
    }
    if (!hasAuth(entry.provider)) {
      hints.push('auth missing');
    }
    options.push({
      value: key,
      label: key,
      hint: hints.length > 0 ? hints.join(' \xB7 ') : void 0
    });
    seen.add(key);
  }, 'addModelOption');
  for (const entry of models) {
    addModelOption(entry);
  }
  if (configuredKey && !seen.has(configuredKey)) {
    options.push({
      value: configuredKey,
      label: configuredKey,
      hint: 'current (not in catalog)'
    });
  }
  let initialValue = allowKeep ? KEEP_VALUE : configuredKey || void 0;
  if (allowKeep && hasPreferredProvider && preferredProvider && resolved.provider !== preferredProvider) {
    const firstModel = models[0];
    if (firstModel) {
      initialValue = modelKey(firstModel.provider, firstModel.id);
    }
  }
  const selection = await params.prompter.select({
    message: params.message ?? 'Default model',
    options,
    initialValue
  });
  if (selection === KEEP_VALUE) {
    return {};
  }
  if (selection === MANUAL_VALUE) {
    return promptManualModel({
      prompter: params.prompter,
      allowBlank: false,
      initialValue: configuredRaw || resolvedKey || void 0
    });
  }
  return { model: String(selection) };
}
__name(promptDefaultModel, 'promptDefaultModel');
async function promptModelAllowlist(params) {
  const cfg = params.config;
  const existingKeys = resolveConfiguredModelKeys(cfg);
  const allowedKeys = normalizeModelKeys(params.allowedKeys ?? []);
  const allowedKeySet = allowedKeys.length > 0 ? new Set(allowedKeys) : null;
  const resolved = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
  const resolvedKey = modelKey(resolved.provider, resolved.model);
  const initialSeeds = normalizeModelKeys([
    ...existingKeys,
    resolvedKey,
    ...params.initialSelections ?? []
  ]);
  const initialKeys = allowedKeySet ? initialSeeds.filter((key) => allowedKeySet.has(key)) : initialSeeds;
  const catalog = await loadModelCatalog({ config: cfg, useCache: false });
  if (catalog.length === 0 && allowedKeys.length === 0) {
    const raw = await params.prompter.text({
      message: params.message ?? 'Allowlist models (comma-separated provider/model; blank to keep current)',
      initialValue: existingKeys.join(', '),
      placeholder: 'openai-codex/gpt-5.2, anthropic/claude-opus-4-6'
    });
    const parsed = String(raw ?? '').split(',').map((value) => value.trim()).filter((value) => value.length > 0);
    if (parsed.length === 0) {
      return {};
    }
    return { models: normalizeModelKeys(parsed) };
  }
  const aliasIndex = buildModelAliasIndex({
    cfg,
    defaultProvider: DEFAULT_PROVIDER
  });
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false
  });
  const authCache = /* @__PURE__ */ new Map();
  const hasAuth = /* @__PURE__ */ __name((provider) => {
    const cached = authCache.get(provider);
    if (cached !== void 0) {
      return cached;
    }
    const value = hasAuthForProvider(provider, cfg, authStore);
    authCache.set(provider, value);
    return value;
  }, 'hasAuth');
  const options = [];
  const seen = /* @__PURE__ */ new Set();
  const addModelOption = /* @__PURE__ */ __name((entry) => {
    const key = modelKey(entry.provider, entry.id);
    if (seen.has(key)) {
      return;
    }
    if (HIDDEN_ROUTER_MODELS.has(key)) {
      return;
    }
    const hints = [];
    if (entry.name && entry.name !== entry.id) {
      hints.push(entry.name);
    }
    if (entry.contextWindow) {
      hints.push(`ctx ${formatTokenK(entry.contextWindow)}`);
    }
    if (entry.reasoning) {
      hints.push('reasoning');
    }
    const aliases = aliasIndex.byKey.get(key);
    if (aliases?.length) {
      hints.push(`alias: ${aliases.join(', ')}`);
    }
    if (!hasAuth(entry.provider)) {
      hints.push('auth missing');
    }
    options.push({
      value: key,
      label: key,
      hint: hints.length > 0 ? hints.join(' \xB7 ') : void 0
    });
    seen.add(key);
  }, 'addModelOption');
  const filteredCatalog = allowedKeySet ? catalog.filter((entry) => allowedKeySet.has(modelKey(entry.provider, entry.id))) : catalog;
  for (const entry of filteredCatalog) {
    addModelOption(entry);
  }
  const supplementalKeys = allowedKeySet ? allowedKeys : existingKeys;
  for (const key of supplementalKeys) {
    if (seen.has(key)) {
      continue;
    }
    options.push({
      value: key,
      label: key,
      hint: allowedKeySet ? 'allowed (not in catalog)' : 'configured (not in catalog)'
    });
    seen.add(key);
  }
  if (options.length === 0) {
    return {};
  }
  const selection = await params.prompter.multiselect({
    message: params.message ?? 'Models in /model picker (multi-select)',
    options,
    initialValues: initialKeys.length > 0 ? initialKeys : void 0
  });
  const selected = normalizeModelKeys(selection.map((value) => String(value)));
  if (selected.length > 0) {
    return { models: selected };
  }
  if (existingKeys.length === 0) {
    return { models: [] };
  }
  const confirmClear = await params.prompter.confirm({
    message: 'Clear the model allowlist? (shows all models)',
    initialValue: false
  });
  if (!confirmClear) {
    return {};
  }
  return { models: [] };
}
__name(promptModelAllowlist, 'promptModelAllowlist');
function applyPrimaryModel(cfg, model) {
  const defaults = cfg.agents?.defaults;
  const existingModel = defaults?.model;
  const existingModels = defaults?.models;
  const fallbacks = typeof existingModel === 'object' && existingModel !== null && 'fallbacks' in existingModel ? existingModel.fallbacks : void 0;
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        model: {
          ...fallbacks ? { fallbacks } : void 0,
          primary: model
        },
        models: {
          ...existingModels,
          [model]: existingModels?.[model] ?? {}
        }
      }
    }
  };
}
__name(applyPrimaryModel, 'applyPrimaryModel');
function applyModelAllowlist(cfg, models) {
  const defaults = cfg.agents?.defaults;
  const normalized = normalizeModelKeys(models);
  if (normalized.length === 0) {
    if (!defaults?.models) {
      return cfg;
    }
    // eslint-disable-next-line no-unused-vars
    const { models: _ignored, ...restDefaults } = defaults;
    return {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: restDefaults
      }
    };
  }
  const existingModels = defaults?.models ?? {};
  const nextModels = {};
  for (const key of normalized) {
    nextModels[key] = existingModels[key] ?? {};
  }
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        models: nextModels
      }
    }
  };
}
__name(applyModelAllowlist, 'applyModelAllowlist');
function applyModelFallbacksFromSelection(cfg, selection) {
  const normalized = normalizeModelKeys(selection);
  if (normalized.length <= 1) {
    return cfg;
  }
  const resolved = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
  const resolvedKey = modelKey(resolved.provider, resolved.model);
  if (!normalized.includes(resolvedKey)) {
    return cfg;
  }
  const defaults = cfg.agents?.defaults;
  const existingModel = defaults?.model;
  const existingPrimary = typeof existingModel === 'string' ? existingModel : existingModel && typeof existingModel === 'object' ? existingModel.primary : void 0;
  const fallbacks = normalized.filter((key) => key !== resolvedKey);
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        model: {
          ...typeof existingModel === 'object' ? existingModel : void 0,
          primary: existingPrimary ?? resolvedKey,
          fallbacks
        }
      }
    }
  };
}
__name(applyModelFallbacksFromSelection, 'applyModelFallbacksFromSelection');
export {
  applyModelAllowlist,
  applyModelFallbacksFromSelection,
  applyPrimaryModel,
  promptDefaultModel,
  promptModelAllowlist
};
