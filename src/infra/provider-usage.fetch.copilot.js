/**
 * GitHub Copilot usage fetcher.
 *
 * Queries the GitHub Copilot internal API for premium interaction
 * and chat quota snapshots.
 */

import {fetchJson} from './provider-usage.fetch.shared.js';
import {clampPercent, PROVIDER_LABELS} from './provider-usage.shared.js';

/**
 * Fetches Copilot usage from the GitHub API.
 * @param {string} token
 * @param {number} timeoutMs
 * @param {typeof fetch} fetchFn
 * @returns {Promise<import('./provider-usage.types.js').ProviderUsageSnapshot>}
 */
export async function fetchCopilotUsage(token, timeoutMs, fetchFn) {
  const res = await fetchJson(
    'https://api.github.com/copilot_internal/user',
    {
      headers: {
        'Authorization': `token ${token}`,
        'Editor-Version': 'vscode/1.96.2',
        'User-Agent': 'GitHubCopilotChat/0.26.7',
        'X-Github-Api-Version': '2025-04-01'
      }
    },
    timeoutMs,
    fetchFn
  );

  if (!res.ok) {
    return {
      provider: 'github-copilot',
      displayName: PROVIDER_LABELS['github-copilot'],
      windows: [],
      error: `HTTP ${res.status}`
    };
  }

  const data = await res.json();
  /** @type {import('./provider-usage.types.js').UsageWindow[]} */
  const windows = [];

  if (data.quota_snapshots?.premium_interactions) {
    const remaining = data.quota_snapshots.premium_interactions.percent_remaining;
    windows.push({
      label: 'Premium',
      usedPercent: clampPercent(100 - (remaining ?? 0))
    });
  }

  if (data.quota_snapshots?.chat) {
    const remaining = data.quota_snapshots.chat.percent_remaining;
    windows.push({
      label: 'Chat',
      usedPercent: clampPercent(100 - (remaining ?? 0))
    });
  }

  return {
    provider: 'github-copilot',
    displayName: PROVIDER_LABELS['github-copilot'],
    windows,
    plan: data.copilot_plan
  };
}
