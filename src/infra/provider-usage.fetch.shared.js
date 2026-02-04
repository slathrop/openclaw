/**
 * Shared HTTP fetch helper for provider usage modules.
 *
 * Wraps fetch with an AbortController timeout to prevent
 * hanging requests during usage data collection.
 */

/**
 * Fetches a URL with a timeout via AbortController.
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 * @param {typeof fetch} fetchFn
 * @returns {Promise<Response>}
 */
export async function fetchJson(url, init, timeoutMs, fetchFn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, {...init, signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
}
