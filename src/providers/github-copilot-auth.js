/**
 * GitHub Copilot OAuth device flow authentication.
 *
 * SECURITY: Implements the OAuth 2.0 Device Authorization Grant (RFC 8628)
 * for GitHub Copilot. The access token is stored in an auth profile via
 * `upsertAuthProfile` and persisted to disk. The token has `read:user`
 * scope and is later exchanged for a Copilot API token.
 *
 * Handles device code request, user verification, and polling for the
 * access token with backoff on `slow_down` responses.
 */
import { intro, note, outro, spinner } from '@clack/prompts';
import { ensureAuthProfileStore, upsertAuthProfile } from '../agents/auth-profiles.js';
import { updateConfig } from '../commands/models/shared.js';
import { applyAuthProfileConfig } from '../commands/onboard-auth.js';
import { logConfigUpdated } from '../config/logging.js';
import { stylePromptTitle } from '../terminal/prompt-style.js';

const CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * @typedef {object} DeviceCodeResponse
 * @property {string} device_code
 * @property {string} user_code
 * @property {string} verification_uri
 * @property {number} expires_in
 * @property {number} interval
 */

/**
 * @typedef {object} DeviceTokenSuccessResponse
 * @property {string} access_token
 * @property {string} token_type
 * @property {string} [scope]
 */

/**
 * @typedef {object} DeviceTokenErrorResponse
 * @property {string} error
 * @property {string} [error_description]
 * @property {string} [error_uri]
 */

/**
 * @param {unknown} value
 * @returns {object}
 */
const parseJsonResponse = (value) => {
  if (!value || typeof value !== 'object') {
    throw new Error('Unexpected response from GitHub');
  }
  return value;
};

/**
 * SECURITY: Requests a device code from GitHub OAuth. The device code is
 * short-lived and used only during the authorization flow.
 * @param {{ scope: string }} params
 * @returns {Promise<DeviceCodeResponse>}
 */
const requestDeviceCode = async (params) => {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: params.scope
  });

  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!res.ok) {
    throw new Error(`GitHub device code failed: HTTP ${res.status}`);
  }

  const json = parseJsonResponse(await res.json());
  if (!json.device_code || !json.user_code || !json.verification_uri) {
    throw new Error('GitHub device code response missing fields');
  }
  return json;
};

/**
 * SECURITY: Polls GitHub OAuth token endpoint until the user authorizes
 * the device code. Respects `slow_down` and `authorization_pending`
 * responses with appropriate backoff.
 * @param {{ deviceCode: string, intervalMs: number, expiresAt: number }} params
 * @returns {Promise<string>} The access token
 */
const pollForAccessToken = async (params) => {
  const bodyBase = new URLSearchParams({
    client_id: CLIENT_ID,
    device_code: params.deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
  });

  while (Date.now() < params.expiresAt) {
    const res = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyBase
    });

    if (!res.ok) {
      throw new Error(`GitHub device token failed: HTTP ${res.status}`);
    }

    const json = parseJsonResponse(await res.json());
    if ('access_token' in json && typeof json.access_token === 'string') {
      return json.access_token;
    }

    const err = 'error' in json ? json.error : 'unknown';
    if (err === 'authorization_pending') {
      await new Promise((r) => setTimeout(r, params.intervalMs));
      continue;
    }
    if (err === 'slow_down') {
      await new Promise((r) => setTimeout(r, params.intervalMs + 2000));
      continue;
    }
    if (err === 'expired_token') {
      throw new Error('GitHub device code expired; run login again');
    }
    if (err === 'access_denied') {
      throw new Error('GitHub login cancelled');
    }
    throw new Error(`GitHub device flow error: ${err}`);
  }

  throw new Error('GitHub device code expired; run login again');
};

/**
 * SECURITY: Runs the full GitHub Copilot OAuth device login flow.
 * Stores the resulting access token in an auth profile on disk.
 * @param {{ profileId?: string, yes?: boolean }} opts
 * @param {object} runtime
 */
export const githubCopilotLoginCommand = async (opts, runtime) => {
  if (!process.stdin.isTTY) {
    throw new Error('github-copilot login requires an interactive TTY.');
  }

  intro(stylePromptTitle('GitHub Copilot login'));

  const profileId = opts.profileId?.trim() || 'github-copilot:github';
  const store = ensureAuthProfileStore(undefined, {
    allowKeychainPrompt: false
  });

  if (store.profiles[profileId] && !opts.yes) {
    note(
      `Auth profile already exists: ${profileId}\nRe-running will overwrite it.`,
      stylePromptTitle('Existing credentials')
    );
  }

  const spin = spinner();
  spin.start('Requesting device code from GitHub...');
  const device = await requestDeviceCode({ scope: 'read:user' });
  spin.stop('Device code ready');

  note(
    [`Visit: ${device.verification_uri}`, `Code: ${device.user_code}`].join('\n'),
    stylePromptTitle('Authorize')
  );

  const expiresAt = Date.now() + device.expires_in * 1000;
  const intervalMs = Math.max(1000, device.interval * 1000);

  const polling = spinner();
  polling.start('Waiting for GitHub authorization...');
  // SECURITY: Token is received over HTTPS from GitHub OAuth endpoint
  const accessToken = await pollForAccessToken({
    deviceCode: device.device_code,
    intervalMs,
    expiresAt
  });
  polling.stop('GitHub access token acquired');

  // SECURITY: Token stored in auth profile on disk
  upsertAuthProfile({
    profileId,
    credential: {
      type: 'token',
      provider: 'github-copilot',
      token: accessToken
      // GitHub device flow token doesn't reliably include expiry here.
      // Leave expires unset; we'll exchange into Copilot token plus expiry later.
    }
  });

  await updateConfig((cfg) =>
    applyAuthProfileConfig(cfg, {
      provider: 'github-copilot',
      profileId,
      mode: 'token'
    })
  );

  logConfigUpdated(runtime);
  runtime.log(`Auth profile: ${profileId} (github-copilot/token)`);

  outro('Done');
};
