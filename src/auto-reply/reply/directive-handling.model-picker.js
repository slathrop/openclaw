import { normalizeProviderId } from '../../agents/model-selection.js';
const MODEL_PICK_PROVIDER_PREFERENCE = [
  'anthropic',
  'openai',
  'openai-codex',
  'minimax',
  'synthetic',
  'google',
  'zai',
  'openrouter',
  'opencode',
  'github-copilot',
  'groq',
  'cerebras',
  'mistral',
  'xai',
  'lmstudio'
];
const PROVIDER_RANK = new Map(
  MODEL_PICK_PROVIDER_PREFERENCE.map((provider, idx) => [provider, idx])
);
function compareProvidersForPicker(a, b) {
  const pa = PROVIDER_RANK.get(a);
  const pb = PROVIDER_RANK.get(b);
  if (pa !== void 0 && pb !== void 0) {
    return pa - pb;
  }
  if (pa !== void 0) {
    return -1;
  }
  if (pb !== void 0) {
    return 1;
  }
  return a.localeCompare(b);
}
function buildModelPickerItems(catalog) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const entry of catalog) {
    const provider = normalizeProviderId(entry.provider);
    const model = entry.id?.trim();
    if (!provider || !model) {
      continue;
    }
    const key = `${provider}/${model}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({ model, provider });
  }
  out.sort((a, b) => {
    const providerOrder = compareProvidersForPicker(a.provider, b.provider);
    if (providerOrder !== 0) {
      return providerOrder;
    }
    return a.model.toLowerCase().localeCompare(b.model.toLowerCase());
  });
  return out;
}
function resolveProviderEndpointLabel(provider, cfg) {
  const normalized = normalizeProviderId(provider);
  const providers = cfg.models?.providers ?? {};
  const entry = providers[normalized];
  const endpoint = entry?.baseUrl?.trim();
  const api = entry?.api?.trim();
  return {
    endpoint: endpoint || void 0,
    api: api || void 0
  };
}
export {
  buildModelPickerItems,
  resolveProviderEndpointLabel
};
