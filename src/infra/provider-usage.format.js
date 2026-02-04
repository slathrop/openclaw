/**
 * Provider usage formatting utilities.
 *
 * Formats usage snapshots and summaries into human-readable
 * text for CLI output, status lines, and report displays.
 */

import {clampPercent} from './provider-usage.shared.js';

/**
 * Formats remaining time until reset as a human-readable string.
 * @param {number} [targetMs]
 * @param {number} [now]
 * @returns {string | null}
 */
function formatResetRemaining(targetMs, now) {
  if (!targetMs) {
    return null;
  }
  const base = now ?? Date.now();
  const diffMs = targetMs - base;
  if (diffMs <= 0) {
    return 'now';
  }

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ${hours % 24}h`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(targetMs));
}

/**
 * Picks the window with the highest usage percent.
 * @param {import('./provider-usage.types.js').UsageWindow[]} windows
 * @returns {import('./provider-usage.types.js').UsageWindow | undefined}
 */
function pickPrimaryWindow(windows) {
  if (windows.length === 0) {
    return undefined;
  }
  return windows.reduce((best, next) => (next.usedPercent > best.usedPercent ? next : best));
}

/**
 * Formats a single window as a short summary string.
 * @param {import('./provider-usage.types.js').UsageWindow} window
 * @param {number} [now]
 * @returns {string}
 */
function formatWindowShort(window, now) {
  const remaining = clampPercent(100 - window.usedPercent);
  const reset = formatResetRemaining(window.resetAt, now);
  const resetSuffix = reset ? ` \u23F1${reset}` : '';
  return `${remaining.toFixed(0)}% left (${window.label}${resetSuffix})`;
}

/**
 * Formats a snapshot's windows as a compact summary string.
 * @param {import('./provider-usage.types.js').ProviderUsageSnapshot} snapshot
 * @param {{ now?: number, maxWindows?: number, includeResets?: boolean }} [opts]
 * @returns {string | null}
 */
export function formatUsageWindowSummary(snapshot, opts) {
  if (snapshot.error) {
    return null;
  }
  if (snapshot.windows.length === 0) {
    return null;
  }
  const now = opts?.now ?? Date.now();
  const maxWindows =
    typeof opts?.maxWindows === 'number' && opts.maxWindows > 0 ?
      Math.min(opts.maxWindows, snapshot.windows.length) :
      snapshot.windows.length;
  const includeResets = opts?.includeResets ?? false;
  const windows = snapshot.windows.slice(0, maxWindows);
  const parts = windows.map((window) => {
    const remaining = clampPercent(100 - window.usedPercent);
    const reset = includeResets ? formatResetRemaining(window.resetAt, now) : null;
    const resetSuffix = reset ? ` \u23F1${reset}` : '';
    return `${window.label} ${remaining.toFixed(0)}% left${resetSuffix}`;
  });
  return parts.join(' \u00B7 ');
}

/**
 * Formats a full usage summary as a single-line status string.
 * @param {import('./provider-usage.types.js').UsageSummary} summary
 * @param {{ now?: number, maxProviders?: number }} [opts]
 * @returns {string | null}
 */
export function formatUsageSummaryLine(summary, opts) {
  const providers = summary.providers
    .filter((entry) => entry.windows.length > 0 && !entry.error)
    .slice(0, opts?.maxProviders ?? summary.providers.length);
  if (providers.length === 0) {
    return null;
  }

  const parts = providers
    .map((entry) => {
      const window = pickPrimaryWindow(entry.windows);
      if (!window) {
        return null;
      }
      return `${entry.displayName} ${formatWindowShort(window, opts?.now)}`;
    })
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }
  return `\uD83D\uDCCA Usage: ${parts.join(' \u00B7 ')}`;
}

/**
 * Formats a full usage summary as multi-line report output.
 * @param {import('./provider-usage.types.js').UsageSummary} summary
 * @param {{ now?: number }} [opts]
 * @returns {string[]}
 */
export function formatUsageReportLines(summary, opts) {
  if (summary.providers.length === 0) {
    return ['Usage: no provider usage available.'];
  }

  const lines = ['Usage:'];
  for (const entry of summary.providers) {
    const planSuffix = entry.plan ? ` (${entry.plan})` : '';
    if (entry.error) {
      lines.push(`  ${entry.displayName}${planSuffix}: ${entry.error}`);
      continue;
    }
    if (entry.windows.length === 0) {
      lines.push(`  ${entry.displayName}${planSuffix}: no data`);
      continue;
    }
    lines.push(`  ${entry.displayName}${planSuffix}`);
    for (const window of entry.windows) {
      const remaining = clampPercent(100 - window.usedPercent);
      const reset = formatResetRemaining(window.resetAt, opts?.now);
      const resetSuffix = reset ? ` \u00B7 resets ${reset}` : '';
      lines.push(`    ${window.label}: ${remaining.toFixed(0)}% left${resetSuffix}`);
    }
  }
  return lines;
}
