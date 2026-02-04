/**
 * Shared constants and utilities for provider usage tracking.
 *
 * Provides provider labels, timeout defaults, error filtering,
 * and common helpers used across all usage fetch modules.
 */

import {normalizeProviderId} from '../agents/model-selection.js';

export const DEFAULT_TIMEOUT_MS = 5000;

/** @type {Record<import('./provider-usage.types.js').UsageProviderId, string>} */
export const PROVIDER_LABELS = {
  'anthropic': 'Claude',
  'github-copilot': 'Copilot',
  'google-gemini-cli': 'Gemini',
  'google-antigravity': 'Antigravity',
  'minimax': 'MiniMax',
  'openai-codex': 'Codex',
  'xiaomi': 'Xiaomi',
  'zai': 'z.ai'
};

/** @type {import('./provider-usage.types.js').UsageProviderId[]} */
export const usageProviders = [
  'anthropic',
  'github-copilot',
  'google-gemini-cli',
  'google-antigravity',
  'minimax',
  'openai-codex',
  'xiaomi',
  'zai'
];

/**
 * Resolves a provider string to a known UsageProviderId.
 * @param {string | null} [provider]
 * @returns {import('./provider-usage.types.js').UsageProviderId | undefined}
 */
export function resolveUsageProviderId(provider) {
  if (!provider) {
    return undefined;
  }
  const normalized = normalizeProviderId(provider);
  return usageProviders.includes(normalized) ?
    normalized :
    undefined;
}

export const ignoredErrors = new Set([
  'No credentials',
  'No token',
  'No API key',
  'Not logged in',
  'No auth'
]);

/**
 * Clamps a numeric value to the 0-100 range.
 * @param {number} value
 * @returns {number}
 */
export const clampPercent = (value) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

/**
 * Races a promise against a timeout, returning fallback on timeout.
 * @template T
 * @param {Promise<T>} work
 * @param {number} ms
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export const withTimeout = async (work, ms, fallback) => {
  let timeout;
  try {
    return await Promise.race([
      work,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(fallback), ms);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};
