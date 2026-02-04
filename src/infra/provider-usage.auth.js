/**
 * Provider authentication resolution for usage tracking.
 *
 * Resolves API keys and OAuth tokens for each supported provider
 * by checking environment variables, config files, and auth profiles.
 *
 * SECURITY: Handles sensitive credentials (API keys, OAuth tokens,
 * session keys). Keys are read from env vars, config stores, and
 * on-disk auth files. Never log or expose resolved credentials.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureAuthProfileStore,
  listProfilesForProvider,
  resolveApiKeyForProfile,
  resolveAuthProfileOrder
} from '../agents/auth-profiles.js';
import {getCustomProviderApiKey, resolveEnvApiKey} from '../agents/model-auth.js';
import {normalizeProviderId} from '../agents/model-selection.js';
import {loadConfig} from '../config/config.js';

/**
 * @typedef {object} ProviderAuth
 * @property {import('./provider-usage.types.js').UsageProviderId} provider
 * @property {string} token
 * @property {string} [accountId]
 */

/**
 * Parses a Google-style JSON API key to extract the token field.
 * @param {string} apiKey
 * @returns {{ token: string } | null}
 */
function parseGoogleToken(apiKey) {
  if (!apiKey) {
    return null;
  }
  try {
    const parsed = JSON.parse(apiKey);
    if (parsed && typeof parsed.token === 'string') {
      return {token: parsed.token};
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Resolves z.ai API key from env, config, profiles, or legacy auth file.
 * SECURITY: Reads credentials from multiple sources including disk files.
 * @returns {string | undefined}
 */
function resolveZaiApiKey() {
  const envDirect = process.env.ZAI_API_KEY?.trim() || process.env.Z_AI_API_KEY?.trim();
  if (envDirect) {
    return envDirect;
  }

  const envResolved = resolveEnvApiKey('zai');
  if (envResolved?.apiKey) {
    return envResolved.apiKey;
  }

  const cfg = loadConfig();
  const key = getCustomProviderApiKey(cfg, 'zai') || getCustomProviderApiKey(cfg, 'z-ai');
  if (key) {
    return key;
  }

  const store = ensureAuthProfileStore();
  const apiProfile = [
    ...listProfilesForProvider(store, 'zai'),
    ...listProfilesForProvider(store, 'z-ai')
  ].find((id) => store.profiles[id]?.type === 'api_key');
  if (apiProfile) {
    const cred = store.profiles[apiProfile];
    if (cred?.type === 'api_key' && cred.key?.trim()) {
      return cred.key.trim();
    }
  }

  try {
    const authPath = path.join(os.homedir(), '.pi', 'agent', 'auth.json');
    if (!fs.existsSync(authPath)) {
      return undefined;
    }
    const data = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    return data['z-ai']?.access || data.zai?.access;
  } catch {
    return undefined;
  }
}

/**
 * Resolves MiniMax API key from env, config, or auth profiles.
 * SECURITY: Reads credentials from env vars and profile store.
 * @returns {string | undefined}
 */
function resolveMinimaxApiKey() {
  const envDirect =
    process.env.MINIMAX_CODE_PLAN_KEY?.trim() || process.env.MINIMAX_API_KEY?.trim();
  if (envDirect) {
    return envDirect;
  }

  const envResolved = resolveEnvApiKey('minimax');
  if (envResolved?.apiKey) {
    return envResolved.apiKey;
  }

  const cfg = loadConfig();
  const key = getCustomProviderApiKey(cfg, 'minimax');
  if (key) {
    return key;
  }

  const store = ensureAuthProfileStore();
  const apiProfile = listProfilesForProvider(store, 'minimax').find((id) => {
    const cred = store.profiles[id];
    return cred?.type === 'api_key' || cred?.type === 'token';
  });
  if (!apiProfile) {
    return undefined;
  }
  const cred = store.profiles[apiProfile];
  if (cred?.type === 'api_key' && cred.key?.trim()) {
    return cred.key.trim();
  }
  if (cred?.type === 'token' && cred.token?.trim()) {
    return cred.token.trim();
  }
  return undefined;
}

/**
 * Resolves Xiaomi API key from env, config, or auth profiles.
 * SECURITY: Reads credentials from env vars and profile store.
 * @returns {string | undefined}
 */
function resolveXiaomiApiKey() {
  const envDirect = process.env.XIAOMI_API_KEY?.trim();
  if (envDirect) {
    return envDirect;
  }

  const envResolved = resolveEnvApiKey('xiaomi');
  if (envResolved?.apiKey) {
    return envResolved.apiKey;
  }

  const cfg = loadConfig();
  const key = getCustomProviderApiKey(cfg, 'xiaomi');
  if (key) {
    return key;
  }

  const store = ensureAuthProfileStore();
  const apiProfile = listProfilesForProvider(store, 'xiaomi').find((id) => {
    const cred = store.profiles[id];
    return cred?.type === 'api_key' || cred?.type === 'token';
  });
  if (!apiProfile) {
    return undefined;
  }
  const cred = store.profiles[apiProfile];
  if (cred?.type === 'api_key' && cred.key?.trim()) {
    return cred.key.trim();
  }
  if (cred?.type === 'token' && cred.token?.trim()) {
    return cred.token.trim();
  }
  return undefined;
}

/**
 * Resolves an OAuth token for a provider from auth profiles.
 * @param {{ provider: import('./provider-usage.types.js').UsageProviderId, agentDir?: string }} params
 * @returns {Promise<ProviderAuth | null>}
 */
async function resolveOAuthToken(params) {
  const cfg = loadConfig();
  const store = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false
  });
  const order = resolveAuthProfileOrder({
    cfg,
    store,
    provider: params.provider
  });

  const candidates = order;
  const deduped = [];
  for (const entry of candidates) {
    if (!deduped.includes(entry)) {
      deduped.push(entry);
    }
  }

  for (const profileId of deduped) {
    const cred = store.profiles[profileId];
    if (!cred || (cred.type !== 'oauth' && cred.type !== 'token')) {
      continue;
    }
    try {
      const resolved = await resolveApiKeyForProfile({
        // Usage snapshots should work even if config profile metadata is stale.
        // (e.g. config says api_key but the store has a token profile.)
        cfg: undefined,
        store,
        profileId,
        agentDir: params.agentDir
      });
      if (!resolved?.apiKey) {
        continue;
      }
      let token = resolved.apiKey;
      if (params.provider === 'google-gemini-cli' || params.provider === 'google-antigravity') {
        const parsed = parseGoogleToken(resolved.apiKey);
        token = parsed?.token ?? resolved.apiKey;
      }
      return {
        provider: params.provider,
        token,
        accountId:
          cred.type === 'oauth' && 'accountId' in cred ?
            cred.accountId :
            undefined
      };
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Returns the list of providers with OAuth-like credentials available.
 * @param {string} [agentDir]
 * @returns {import('./provider-usage.types.js').UsageProviderId[]}
 */
function resolveOAuthProviders(agentDir) {
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false
  });
  const cfg = loadConfig();
  /** @type {import('./provider-usage.types.js').UsageProviderId[]} */
  const providers = [
    'anthropic',
    'github-copilot',
    'google-gemini-cli',
    'google-antigravity',
    'openai-codex'
  ];
  const isOAuthLikeCredential = (id) => {
    const cred = store.profiles[id];
    return cred?.type === 'oauth' || cred?.type === 'token';
  };
  return providers.filter((provider) => {
    const profiles = listProfilesForProvider(store, provider).filter(isOAuthLikeCredential);
    if (profiles.length > 0) {
      return true;
    }
    const normalized = normalizeProviderId(provider);
    const configuredProfiles = Object.entries(cfg.auth?.profiles ?? {})
      .filter(([, profile]) => normalizeProviderId(profile.provider) === normalized)
      .map(([id]) => id)
      .filter(isOAuthLikeCredential);
    return configuredProfiles.length > 0;
  });
}

/**
 * Resolves authentication for the requested providers.
 * SECURITY: Returns resolved tokens/keys. Callers must not log the results.
 * @param {{ providers: import('./provider-usage.types.js').UsageProviderId[], auth?: ProviderAuth[], agentDir?: string }} params
 * @returns {Promise<ProviderAuth[]>}
 */
export async function resolveProviderAuths(params) {
  if (params.auth) {
    return params.auth;
  }

  const oauthProviders = resolveOAuthProviders(params.agentDir);
  const auths = [];

  for (const provider of params.providers) {
    if (provider === 'zai') {
      const apiKey = resolveZaiApiKey();
      if (apiKey) {
        auths.push({provider, token: apiKey});
      }
      continue;
    }
    if (provider === 'minimax') {
      const apiKey = resolveMinimaxApiKey();
      if (apiKey) {
        auths.push({provider, token: apiKey});
      }
      continue;
    }
    if (provider === 'xiaomi') {
      const apiKey = resolveXiaomiApiKey();
      if (apiKey) {
        auths.push({provider, token: apiKey});
      }
      continue;
    }

    if (!oauthProviders.includes(provider)) {
      continue;
    }
    const auth = await resolveOAuthToken({
      provider,
      agentDir: params.agentDir
    });
    if (auth) {
      auths.push(auth);
    }
  }

  return auths;
}
