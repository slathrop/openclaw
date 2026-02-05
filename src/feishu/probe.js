import { formatErrorMessage } from '../infra/errors.js';
import { getChildLogger } from '../logging.js';
import { resolveFeishuApiBase } from './domain.js';
const logger = getChildLogger({ module: 'feishu-probe' });
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function probeFeishu(appId, appSecret, timeoutMs = 5e3, domain) {
  const started = Date.now();
  const result = {
    ok: false,
    error: null,
    elapsedMs: 0
  };
  const apiBase = resolveFeishuApiBase(domain);
  try {
    const tokenRes = await fetchWithTimeout(
      `${apiBase}/auth/v3/tenant_access_token/internal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret })
      },
      timeoutMs
    );
    const tokenJson = await tokenRes.json();
    if (tokenJson.code !== 0 || !tokenJson.tenant_access_token) {
      result.error = tokenJson.msg || `Failed to get access token: code ${tokenJson.code}`;
      result.elapsedMs = Date.now() - started;
      return result;
    }
    const accessToken = tokenJson.tenant_access_token;
    const botRes = await fetchWithTimeout(
      `${apiBase}/bot/v3/info`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      timeoutMs
    );
    const botJson = await botRes.json();
    if (botJson.code !== 0) {
      result.error = botJson.msg || `Failed to get bot info: code ${botJson.code}`;
      result.elapsedMs = Date.now() - started;
      return result;
    }
    result.ok = true;
    result.bot = {
      appId,
      appName: botJson.bot?.app_name ?? null,
      avatarUrl: botJson.bot?.avatar_url ?? null
    };
    result.elapsedMs = Date.now() - started;
    return result;
  } catch (err) {
    const errMsg = formatErrorMessage(err);
    logger.debug?.(`Feishu probe failed: ${errMsg}`);
    return {
      ...result,
      error: errMsg,
      elapsedMs: Date.now() - started
    };
  }
}
export {
  probeFeishu
};
