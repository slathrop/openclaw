import { fetchWithSsrFGuard } from '../../infra/net/fetch-guard.js';
const MAX_ERROR_CHARS = 300;
function normalizeBaseUrl(baseUrl, fallback) {
  const raw = baseUrl?.trim() || fallback;
  return raw.replace(/\/+$/, '');
}
async function fetchWithTimeout(url, init, timeoutMs, fetchFn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function fetchWithTimeoutGuarded(url, init, timeoutMs, fetchFn, options) {
  return await fetchWithSsrFGuard({
    url,
    fetchImpl: fetchFn,
    init,
    timeoutMs,
    policy: options?.ssrfPolicy,
    lookupFn: options?.lookupFn,
    pinDns: options?.pinDns
  });
}
async function readErrorResponse(res) {
  try {
    const text = await res.text();
    const collapsed = text.replace(/\s+/g, ' ').trim();
    if (!collapsed) {
      return void 0;
    }
    if (collapsed.length <= MAX_ERROR_CHARS) {
      return collapsed;
    }
    return `${collapsed.slice(0, MAX_ERROR_CHARS)}\u2026`;
  } catch {
    return void 0;
  }
}
export {
  fetchWithTimeout,
  fetchWithTimeoutGuarded,
  normalizeBaseUrl,
  readErrorResponse
};
