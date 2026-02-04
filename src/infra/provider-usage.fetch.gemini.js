/**
 * Google Gemini CLI usage fetcher.
 *
 * Queries the Google Cloud Code PA API to retrieve per-model
 * quota buckets (Pro/Flash) for Gemini CLI users.
 */

import {fetchJson} from './provider-usage.fetch.shared.js';
import {clampPercent, PROVIDER_LABELS} from './provider-usage.shared.js';

/**
 * Fetches Gemini usage from the Cloud Code PA API.
 * @param {string} token
 * @param {number} timeoutMs
 * @param {typeof fetch} fetchFn
 * @param {import('./provider-usage.types.js').UsageProviderId} provider
 * @returns {Promise<import('./provider-usage.types.js').ProviderUsageSnapshot>}
 */
export async function fetchGeminiUsage(token, timeoutMs, fetchFn, provider) {
  const res = await fetchJson(
    'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    },
    timeoutMs,
    fetchFn
  );

  if (!res.ok) {
    return {
      provider,
      displayName: PROVIDER_LABELS[provider],
      windows: [],
      error: `HTTP ${res.status}`
    };
  }

  const data = await res.json();
  /** @type {Record<string, number>} */
  const quotas = {};

  for (const bucket of data.buckets || []) {
    const model = bucket.modelId || 'unknown';
    const frac = bucket.remainingFraction ?? 1;
    if (!quotas[model] || frac < quotas[model]) {
      quotas[model] = frac;
    }
  }

  /** @type {import('./provider-usage.types.js').UsageWindow[]} */
  const windows = [];
  let proMin = 1;
  let flashMin = 1;
  let hasPro = false;
  let hasFlash = false;

  for (const [model, frac] of Object.entries(quotas)) {
    const lower = model.toLowerCase();
    if (lower.includes('pro')) {
      hasPro = true;
      if (frac < proMin) {
        proMin = frac;
      }
    }
    if (lower.includes('flash')) {
      hasFlash = true;
      if (frac < flashMin) {
        flashMin = frac;
      }
    }
  }

  if (hasPro) {
    windows.push({
      label: 'Pro',
      usedPercent: clampPercent((1 - proMin) * 100)
    });
  }
  if (hasFlash) {
    windows.push({
      label: 'Flash',
      usedPercent: clampPercent((1 - flashMin) * 100)
    });
  }

  return {provider, displayName: PROVIDER_LABELS[provider], windows};
}
