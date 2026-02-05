/**
 * @module models-config.providers
 * Per-provider model configuration and discovery orchestration.
 */
import {
  DEFAULT_COPILOT_API_BASE_URL,
  resolveCopilotApiToken
} from '../providers/github-copilot-token.js';
import { ensureAuthProfileStore, listProfilesForProvider } from './auth-profiles.js';
import { discoverBedrockModels } from './bedrock-discovery.js';
import {
  buildCloudflareAiGatewayModelDefinition,
  resolveCloudflareAiGatewayBaseUrl
} from './cloudflare-ai-gateway.js';
import { resolveAwsSdkEnvVarName, resolveEnvApiKey } from './model-auth.js';
import {
  buildSyntheticModelDefinition,
  SYNTHETIC_BASE_URL,
  SYNTHETIC_MODEL_CATALOG
} from './synthetic-models.js';
import { discoverVeniceModels, VENICE_BASE_URL } from './venice-models.js';
const MINIMAX_API_BASE_URL = 'https://api.minimax.chat/v1';
const MINIMAX_PORTAL_BASE_URL = 'https://api.minimax.io/anthropic';
const MINIMAX_DEFAULT_MODEL_ID = 'MiniMax-M2.1';
const MINIMAX_DEFAULT_VISION_MODEL_ID = 'MiniMax-VL-01';
const MINIMAX_DEFAULT_CONTEXT_WINDOW = 2e5;
const MINIMAX_DEFAULT_MAX_TOKENS = 8192;
const MINIMAX_OAUTH_PLACEHOLDER = 'minimax-oauth';
const MINIMAX_API_COST = {
  input: 15,
  output: 60,
  cacheRead: 2,
  cacheWrite: 10
};
const XIAOMI_BASE_URL = 'https://api.xiaomimimo.com/anthropic';
const XIAOMI_DEFAULT_MODEL_ID = 'mimo-v2-flash';
const XIAOMI_DEFAULT_CONTEXT_WINDOW = 262144;
const XIAOMI_DEFAULT_MAX_TOKENS = 8192;
const XIAOMI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';
const MOONSHOT_DEFAULT_MODEL_ID = 'kimi-k2.5';
const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 256e3;
const MOONSHOT_DEFAULT_MAX_TOKENS = 8192;
const MOONSHOT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
const QWEN_PORTAL_BASE_URL = 'https://portal.qwen.ai/v1';
const QWEN_PORTAL_OAUTH_PLACEHOLDER = 'qwen-oauth';
const QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW = 128e3;
const QWEN_PORTAL_DEFAULT_MAX_TOKENS = 8192;
const QWEN_PORTAL_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434/v1';
const OLLAMA_API_BASE_URL = 'http://127.0.0.1:11434';
const OLLAMA_DEFAULT_CONTEXT_WINDOW = 128e3;
const OLLAMA_DEFAULT_MAX_TOKENS = 8192;
const OLLAMA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
async function discoverOllamaModels() {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return [];
  }
  try {
    const response = await fetch(`${OLLAMA_API_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) {
      console.warn(`Failed to discover Ollama models: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (!data.models || data.models.length === 0) {
      console.warn('No Ollama models found on local instance');
      return [];
    }
    return data.models.map((model) => {
      const modelId = model.name;
      const isReasoning = modelId.toLowerCase().includes('r1') || modelId.toLowerCase().includes('reasoning');
      return {
        id: modelId,
        name: modelId,
        reasoning: isReasoning,
        input: ['text'],
        cost: OLLAMA_DEFAULT_COST,
        contextWindow: OLLAMA_DEFAULT_CONTEXT_WINDOW,
        maxTokens: OLLAMA_DEFAULT_MAX_TOKENS
      };
    });
  } catch (error) {
    console.warn(`Failed to discover Ollama models: ${String(error)}`);
    return [];
  }
}
function normalizeApiKeyConfig(value) {
  const trimmed = value.trim();
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(trimmed);
  return match?.[1] ?? trimmed;
}
function resolveEnvApiKeyVarName(provider) {
  const resolved = resolveEnvApiKey(provider);
  if (!resolved) {
    return void 0;
  }
  const match = /^(?:env: |shell env: )([A-Z0-9_]+)$/.exec(resolved.source);
  return match ? match[1] : void 0;
}
function resolveAwsSdkApiKeyVarName() {
  return resolveAwsSdkEnvVarName() ?? 'AWS_PROFILE';
}
function resolveApiKeyFromProfiles(params) {
  const ids = listProfilesForProvider(params.store, params.provider);
  for (const id of ids) {
    const cred = params.store.profiles[id];
    if (!cred) {
      continue;
    }
    if (cred.type === 'api_key') {
      return cred.key;
    }
    if (cred.type === 'token') {
      return cred.token;
    }
  }
  return void 0;
}
function normalizeGoogleModelId(id) {
  if (id === 'gemini-3-pro') {
    return 'gemini-3-pro-preview';
  }
  if (id === 'gemini-3-flash') {
    return 'gemini-3-flash-preview';
  }
  return id;
}
function normalizeGoogleProvider(provider) {
  let mutated = false;
  const models = provider.models.map((model) => {
    const nextId = normalizeGoogleModelId(model.id);
    if (nextId === model.id) {
      return model;
    }
    mutated = true;
    return { ...model, id: nextId };
  });
  return mutated ? { ...provider, models } : provider;
}
function normalizeProviders(params) {
  const { providers } = params;
  if (!providers) {
    return providers;
  }
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false
  });
  let mutated = false;
  const next = {};
  for (const [key, provider] of Object.entries(providers)) {
    const normalizedKey = key.trim();
    let normalizedProvider = provider;
    if (normalizedProvider.apiKey && normalizeApiKeyConfig(normalizedProvider.apiKey) !== normalizedProvider.apiKey) {
      mutated = true;
      normalizedProvider = {
        ...normalizedProvider,
        apiKey: normalizeApiKeyConfig(normalizedProvider.apiKey)
      };
    }
    const hasModels = Array.isArray(normalizedProvider.models) && normalizedProvider.models.length > 0;
    if (hasModels && !normalizedProvider.apiKey?.trim()) {
      const authMode = normalizedProvider.auth ?? (normalizedKey === 'amazon-bedrock' ? 'aws-sdk' : void 0);
      if (authMode === 'aws-sdk') {
        const apiKey = resolveAwsSdkApiKeyVarName();
        mutated = true;
        normalizedProvider = { ...normalizedProvider, apiKey };
      } else {
        const fromEnv = resolveEnvApiKeyVarName(normalizedKey);
        const fromProfiles = resolveApiKeyFromProfiles({
          provider: normalizedKey,
          store: authStore
        });
        const apiKey = fromEnv ?? fromProfiles;
        if (apiKey?.trim()) {
          mutated = true;
          normalizedProvider = { ...normalizedProvider, apiKey };
        }
      }
    }
    if (normalizedKey === 'google') {
      const googleNormalized = normalizeGoogleProvider(normalizedProvider);
      if (googleNormalized !== normalizedProvider) {
        mutated = true;
      }
      normalizedProvider = googleNormalized;
    }
    next[key] = normalizedProvider;
  }
  return mutated ? next : providers;
}
function buildMinimaxProvider() {
  return {
    baseUrl: MINIMAX_API_BASE_URL,
    api: 'openai-completions',
    models: [
      {
        id: MINIMAX_DEFAULT_MODEL_ID,
        name: 'MiniMax M2.1',
        reasoning: false,
        input: ['text'],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS
      },
      {
        id: MINIMAX_DEFAULT_VISION_MODEL_ID,
        name: 'MiniMax VL 01',
        reasoning: false,
        input: ['text', 'image'],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS
      }
    ]
  };
}
function buildMinimaxPortalProvider() {
  return {
    baseUrl: MINIMAX_PORTAL_BASE_URL,
    api: 'anthropic-messages',
    models: [
      {
        id: MINIMAX_DEFAULT_MODEL_ID,
        name: 'MiniMax M2.1',
        reasoning: false,
        input: ['text'],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS
      }
    ]
  };
}
function buildMoonshotProvider() {
  return {
    baseUrl: MOONSHOT_BASE_URL,
    api: 'openai-completions',
    models: [
      {
        id: MOONSHOT_DEFAULT_MODEL_ID,
        name: 'Kimi K2.5',
        reasoning: false,
        input: ['text'],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS
      }
    ]
  };
}
function buildQwenPortalProvider() {
  return {
    baseUrl: QWEN_PORTAL_BASE_URL,
    api: 'openai-completions',
    models: [
      {
        id: 'coder-model',
        name: 'Qwen Coder',
        reasoning: false,
        input: ['text'],
        cost: QWEN_PORTAL_DEFAULT_COST,
        contextWindow: QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_PORTAL_DEFAULT_MAX_TOKENS
      },
      {
        id: 'vision-model',
        name: 'Qwen Vision',
        reasoning: false,
        input: ['text', 'image'],
        cost: QWEN_PORTAL_DEFAULT_COST,
        contextWindow: QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_PORTAL_DEFAULT_MAX_TOKENS
      }
    ]
  };
}
function buildSyntheticProvider() {
  return {
    baseUrl: SYNTHETIC_BASE_URL,
    api: 'anthropic-messages',
    models: SYNTHETIC_MODEL_CATALOG.map(buildSyntheticModelDefinition)
  };
}
function buildXiaomiProvider() {
  return {
    baseUrl: XIAOMI_BASE_URL,
    api: 'anthropic-messages',
    models: [
      {
        id: XIAOMI_DEFAULT_MODEL_ID,
        name: 'Xiaomi MiMo V2 Flash',
        reasoning: false,
        input: ['text'],
        cost: XIAOMI_DEFAULT_COST,
        contextWindow: XIAOMI_DEFAULT_CONTEXT_WINDOW,
        maxTokens: XIAOMI_DEFAULT_MAX_TOKENS
      }
    ]
  };
}
async function buildVeniceProvider() {
  const models = await discoverVeniceModels();
  return {
    baseUrl: VENICE_BASE_URL,
    api: 'openai-completions',
    models
  };
}
async function buildOllamaProvider() {
  const models = await discoverOllamaModels();
  return {
    baseUrl: OLLAMA_BASE_URL,
    api: 'openai-completions',
    models
  };
}
async function resolveImplicitProviders(params) {
  const providers = {};
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false
  });
  const minimaxKey = resolveEnvApiKeyVarName('minimax') ?? resolveApiKeyFromProfiles({ provider: 'minimax', store: authStore });
  if (minimaxKey) {
    providers.minimax = { ...buildMinimaxProvider(), apiKey: minimaxKey };
  }
  const minimaxOauthProfile = listProfilesForProvider(authStore, 'minimax-portal');
  if (minimaxOauthProfile.length > 0) {
    providers['minimax-portal'] = {
      ...buildMinimaxPortalProvider(),
      apiKey: MINIMAX_OAUTH_PLACEHOLDER
    };
  }
  const moonshotKey = resolveEnvApiKeyVarName('moonshot') ?? resolveApiKeyFromProfiles({ provider: 'moonshot', store: authStore });
  if (moonshotKey) {
    providers.moonshot = { ...buildMoonshotProvider(), apiKey: moonshotKey };
  }
  const syntheticKey = resolveEnvApiKeyVarName('synthetic') ?? resolveApiKeyFromProfiles({ provider: 'synthetic', store: authStore });
  if (syntheticKey) {
    providers.synthetic = { ...buildSyntheticProvider(), apiKey: syntheticKey };
  }
  const veniceKey = resolveEnvApiKeyVarName('venice') ?? resolveApiKeyFromProfiles({ provider: 'venice', store: authStore });
  if (veniceKey) {
    providers.venice = { ...await buildVeniceProvider(), apiKey: veniceKey };
  }
  const qwenProfiles = listProfilesForProvider(authStore, 'qwen-portal');
  if (qwenProfiles.length > 0) {
    providers['qwen-portal'] = {
      ...buildQwenPortalProvider(),
      apiKey: QWEN_PORTAL_OAUTH_PLACEHOLDER
    };
  }
  const xiaomiKey = resolveEnvApiKeyVarName('xiaomi') ?? resolveApiKeyFromProfiles({ provider: 'xiaomi', store: authStore });
  if (xiaomiKey) {
    providers.xiaomi = { ...buildXiaomiProvider(), apiKey: xiaomiKey };
  }
  const cloudflareProfiles = listProfilesForProvider(authStore, 'cloudflare-ai-gateway');
  for (const profileId of cloudflareProfiles) {
    const cred = authStore.profiles[profileId];
    if (cred?.type !== 'api_key') {
      continue;
    }
    const accountId = cred.metadata?.accountId?.trim();
    const gatewayId = cred.metadata?.gatewayId?.trim();
    if (!accountId || !gatewayId) {
      continue;
    }
    const baseUrl = resolveCloudflareAiGatewayBaseUrl({ accountId, gatewayId });
    if (!baseUrl) {
      continue;
    }
    const apiKey = resolveEnvApiKeyVarName('cloudflare-ai-gateway') ?? cred.key?.trim() ?? '';
    if (!apiKey) {
      continue;
    }
    providers['cloudflare-ai-gateway'] = {
      baseUrl,
      api: 'anthropic-messages',
      apiKey,
      models: [buildCloudflareAiGatewayModelDefinition()]
    };
    break;
  }
  const ollamaKey = resolveEnvApiKeyVarName('ollama') ?? resolveApiKeyFromProfiles({ provider: 'ollama', store: authStore });
  if (ollamaKey) {
    providers.ollama = { ...await buildOllamaProvider(), apiKey: ollamaKey };
  }
  return providers;
}
async function resolveImplicitCopilotProvider(params) {
  const env = params.env ?? process.env;
  const authStore = ensureAuthProfileStore(params.agentDir, { allowKeychainPrompt: false });
  const hasProfile = listProfilesForProvider(authStore, 'github-copilot').length > 0;
  const envToken = env.COPILOT_GITHUB_TOKEN ?? env.GH_TOKEN ?? env.GITHUB_TOKEN;
  const githubToken = (envToken ?? '').trim();
  if (!hasProfile && !githubToken) {
    return null;
  }
  let selectedGithubToken = githubToken;
  if (!selectedGithubToken && hasProfile) {
    const profileId = listProfilesForProvider(authStore, 'github-copilot')[0];
    const profile = profileId ? authStore.profiles[profileId] : void 0;
    if (profile && profile.type === 'token') {
      selectedGithubToken = profile.token;
    }
  }
  let baseUrl = DEFAULT_COPILOT_API_BASE_URL;
  if (selectedGithubToken) {
    try {
      const token = await resolveCopilotApiToken({
        githubToken: selectedGithubToken,
        env
      });
      baseUrl = token.baseUrl;
    } catch {
      baseUrl = DEFAULT_COPILOT_API_BASE_URL;
    }
  }
  return {
    baseUrl,
    models: []
  };
}
async function resolveImplicitBedrockProvider(params) {
  const env = params.env ?? process.env;
  const discoveryConfig = params.config?.models?.bedrockDiscovery;
  const enabled = discoveryConfig?.enabled;
  const hasAwsCreds = resolveAwsSdkEnvVarName(env) !== void 0;
  if (enabled === false) {
    return null;
  }
  if (enabled !== true && !hasAwsCreds) {
    return null;
  }
  const region = discoveryConfig?.region ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? 'us-east-1';
  const models = await discoverBedrockModels({ region, config: discoveryConfig });
  if (models.length === 0) {
    return null;
  }
  return {
    baseUrl: `https://bedrock-runtime.${region}.amazonaws.com`,
    api: 'bedrock-converse-stream',
    auth: 'aws-sdk',
    models
  };
}
export {
  XIAOMI_DEFAULT_MODEL_ID,
  buildXiaomiProvider,
  normalizeGoogleModelId,
  normalizeProviders,
  resolveImplicitBedrockProvider,
  resolveImplicitCopilotProvider,
  resolveImplicitProviders
};
