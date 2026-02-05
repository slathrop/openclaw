/**
 * GitHub Copilot API token exchange and caching.
 *
 * SECURITY: Exchanges a GitHub OAuth access token for a Copilot API token
 * via the internal Copilot token endpoint. Tokens are cached to disk at
 * `~/.openclaw/credentials/github-copilot.token.json` with expiry tracking.
 * A 5-minute safety margin is applied before considering a cached token
 * expired. The Copilot token contains a `proxy-ep` field used to derive
 * the API base URL.
 */
import path from 'node:path';
import { resolveStateDir } from '../config/paths.js';
import { loadJsonFile, saveJsonFile } from '../infra/json-file.js';

const COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';

/**
 * @typedef {object} CachedCopilotToken
 * @property {string} token
 * @property {number} expiresAt - milliseconds since epoch
 * @property {number} updatedAt - milliseconds since epoch
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
const resolveCopilotTokenCachePath = (env = process.env) =>
  path.join(resolveStateDir(env), 'credentials', 'github-copilot.token.json');

/**
 * @param {CachedCopilotToken} cache
 * @param {number} [now]
 * @returns {boolean}
 */
const isTokenUsable = (cache, now = Date.now()) =>
  // Keep a small safety margin when checking expiry.
  cache.expiresAt - now > 5 * 60 * 1000;

/**
 * SECURITY: Parses the raw Copilot token response. Validates that a
 * non-empty token string and a valid expires_at value are present.
 * Accepts both unix-seconds and unix-milliseconds timestamps defensively.
 * @param {unknown} value
 * @returns {{ token: string, expiresAt: number }}
 */
const parseCopilotTokenResponse = (value) => {
  if (!value || typeof value !== 'object') {
    throw new Error('Unexpected response from GitHub Copilot token endpoint');
  }
  const token = value.token;
  const expiresAt = value.expires_at;
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Copilot token response missing token');
  }

  // GitHub returns a unix timestamp (seconds), but we defensively accept ms too.
  let expiresAtMs;
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    expiresAtMs = expiresAt > 10_000_000_000 ? expiresAt : expiresAt * 1000;
  } else if (typeof expiresAt === 'string' && expiresAt.trim().length > 0) {
    const parsed = Number.parseInt(expiresAt, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error('Copilot token response has invalid expires_at');
    }
    expiresAtMs = parsed > 10_000_000_000 ? parsed : parsed * 1000;
  } else {
    throw new Error('Copilot token response missing expires_at');
  }

  return { token, expiresAt: expiresAtMs };
};

export const DEFAULT_COPILOT_API_BASE_URL = 'https://api.individual.githubcopilot.com';

/**
 * Derives the Copilot API base URL from a Copilot token's `proxy-ep` field.
 * @param {string} token
 * @returns {string | null}
 */
export const deriveCopilotApiBaseUrlFromToken = (token) => {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  // The token returned from the Copilot token endpoint is a semicolon-delimited
  // set of key/value pairs. One of them is `proxy-ep=...`.
  const match = trimmed.match(/(?:^|;)\s*proxy-ep=([^;\s]+)/i);
  const proxyEp = match?.[1]?.trim();
  if (!proxyEp) {
    return null;
  }

  // pi-ai expects converting proxy.* -> api.*
  // (see upstream getGitHubCopilotBaseUrl).
  const host = proxyEp.replace(/^https?:\/\//, '').replace(/^proxy\./i, 'api.');
  if (!host) {
    return null;
  }

  return `https://${host}`;
};

/**
 * SECURITY: Resolves a Copilot API token. First checks the on-disk cache;
 * if the cached token is still valid (with 5-minute margin), returns it.
 * Otherwise exchanges the GitHub OAuth token for a fresh Copilot token
 * via HTTPS and persists the result to disk.
 * @param {{ githubToken: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch }} params
 * @returns {Promise<{ token: string, expiresAt: number, source: string, baseUrl: string }>}
 */
export const resolveCopilotApiToken = async (params) => {
  const env = params.env ?? process.env;
  const cachePath = resolveCopilotTokenCachePath(env);
  const cached = loadJsonFile(cachePath);
  if (cached && typeof cached.token === 'string' && typeof cached.expiresAt === 'number') {
    if (isTokenUsable(cached)) {
      return {
        token: cached.token,
        expiresAt: cached.expiresAt,
        source: `cache:${cachePath}`,
        baseUrl: deriveCopilotApiBaseUrlFromToken(cached.token) ?? DEFAULT_COPILOT_API_BASE_URL
      };
    }
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  // SECURITY: Token exchange over HTTPS with Bearer auth
  const res = await fetchImpl(COPILOT_TOKEN_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.githubToken}`
    }
  });

  if (!res.ok) {
    throw new Error(`Copilot token exchange failed: HTTP ${res.status}`);
  }

  const json = parseCopilotTokenResponse(await res.json());
  // SECURITY: Token cached to disk with expiry tracking
  const payload = {
    token: json.token,
    expiresAt: json.expiresAt,
    updatedAt: Date.now()
  };
  saveJsonFile(cachePath, payload);

  return {
    token: payload.token,
    expiresAt: payload.expiresAt,
    source: `fetched:${COPILOT_TOKEN_URL}`,
    baseUrl: deriveCopilotApiBaseUrlFromToken(payload.token) ?? DEFAULT_COPILOT_API_BASE_URL
  };
};
