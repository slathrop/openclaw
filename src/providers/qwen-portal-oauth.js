/**
 * Qwen Portal OAuth token refresh.
 *
 * SECURITY: Refreshes expired Qwen OAuth access tokens using the
 * stored refresh token. Tokens are exchanged over HTTPS with the
 * Qwen OAuth token endpoint. The refresh token is preserved if the
 * server does not return a new one. Expired or invalid refresh tokens
 * produce a user-friendly error directing re-authentication.
 */
import { formatCliCommand } from '../cli/command-format.js';

const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';

/**
 * SECURITY: Refreshes Qwen Portal OAuth credentials using the refresh token.
 * The refresh token is sent over HTTPS to the Qwen token endpoint.
 * @param {{ access: string, refresh: string, expires: number }} credentials
 * @returns {Promise<{ access: string, refresh: string, expires: number }>}
 */
export const refreshQwenPortalCredentials = async (credentials) => {
  if (!credentials.refresh?.trim()) {
    throw new Error('Qwen OAuth refresh token missing; re-authenticate.');
  }

  // SECURITY: Token refresh over HTTPS
  const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh,
      client_id: QWEN_OAUTH_CLIENT_ID
    })
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 400) {
      throw new Error(
        `Qwen OAuth refresh token expired or invalid. Re-authenticate with \`${formatCliCommand('openclaw models auth login --provider qwen-portal')}\`.`
      );
    }
    throw new Error(`Qwen OAuth refresh failed: ${text || response.statusText}`);
  }

  const payload = await response.json();

  if (!payload.access_token || !payload.expires_in) {
    throw new Error('Qwen OAuth refresh response missing access token.');
  }

  return {
    ...credentials,
    access: payload.access_token,
    refresh: payload.refresh_token || credentials.refresh,
    expires: Date.now() + payload.expires_in * 1000
  };
};
