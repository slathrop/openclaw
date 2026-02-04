/**
 * Channel summary builder for status display.
 *
 * Builds human-readable channel status summaries from plugin metadata,
 * account configuration, and runtime state. Used by the status command
 * and gateway UI.
 */
import {listChannelPlugins} from '../channels/plugins/index.js';
import {loadConfig} from '../config/config.js';
import {DEFAULT_ACCOUNT_ID} from '../routing/session-key.js';
import {theme} from '../terminal/theme.js';

/**
 * @typedef {object} ChannelSummaryOptions
 * @property {boolean} [colorize]
 * @property {boolean} [includeAllowFrom]
 */

/** @type {Required<ChannelSummaryOptions>} */
const DEFAULT_OPTIONS = {
  colorize: false,
  includeAllowFrom: false
};

/**
 * @param {object} params
 * @param {string} params.accountId
 * @param {string} [params.name]
 * @returns {string}
 */
const formatAccountLabel = (params) => {
  const base = params.accountId || DEFAULT_ACCOUNT_ID;
  if (params.name?.trim()) {
    return `${base} (${params.name.trim()})`;
  }
  return base;
};

/**
 * @param {string} label
 * @param {string[]} details
 * @returns {string}
 */
const accountLine = (label, details) =>
  `  - ${label}${details.length ? ` (${details.join(', ')})` : ''}`;

/**
 * @param {import('../channels/plugins/types.js').ChannelPlugin} plugin
 * @param {unknown} account
 * @param {import('../config/config.js').OpenClawConfig} cfg
 * @returns {boolean}
 */
const resolveAccountEnabled = (plugin, account, cfg) => {
  if (plugin.config.isEnabled) {
    return plugin.config.isEnabled(account, cfg);
  }
  if (!account || typeof account !== 'object') {
    return true;
  }
  const enabled = /** @type {{ enabled?: boolean }} */ (account).enabled;
  return enabled !== false;
};

/**
 * @param {import('../channels/plugins/types.js').ChannelPlugin} plugin
 * @param {unknown} account
 * @param {import('../config/config.js').OpenClawConfig} cfg
 * @returns {Promise<boolean>}
 */
const resolveAccountConfigured = async (plugin, account, cfg) => {
  if (plugin.config.isConfigured) {
    return await plugin.config.isConfigured(account, cfg);
  }
  return true;
};

/**
 * @param {object} params
 * @param {import('../channels/plugins/types.js').ChannelPlugin} params.plugin
 * @param {unknown} params.account
 * @param {import('../config/config.js').OpenClawConfig} params.cfg
 * @param {string} params.accountId
 * @param {boolean} params.enabled
 * @param {boolean} params.configured
 * @returns {import('../channels/plugins/types.js').ChannelAccountSnapshot}
 */
const buildAccountSnapshot = (params) => {
  const described = params.plugin.config.describeAccount
    ? params.plugin.config.describeAccount(params.account, params.cfg)
    : undefined;
  return {
    enabled: params.enabled,
    configured: params.configured,
    ...described,
    accountId: params.accountId
  };
};

/**
 * @param {object} params
 * @param {import('../channels/plugins/types.js').ChannelPlugin} params.plugin
 * @param {import('../config/config.js').OpenClawConfig} params.cfg
 * @param {string | null} [params.accountId]
 * @param {Array<string | number>} params.allowFrom
 * @returns {string[]}
 */
const formatAllowFrom = (params) => {
  if (params.plugin.config.formatAllowFrom) {
    return params.plugin.config.formatAllowFrom({
      cfg: params.cfg,
      accountId: params.accountId,
      allowFrom: params.allowFrom
    });
  }
  return params.allowFrom.map((entry) => String(entry).trim()).filter(Boolean);
};

/**
 * @param {object} params
 * @param {object} params.entry
 * @param {import('../channels/plugins/types.js').ChannelPlugin} params.plugin
 * @param {import('../config/config.js').OpenClawConfig} params.cfg
 * @param {boolean} params.includeAllowFrom
 * @returns {string[]}
 */
const buildAccountDetails = (params) => {
  const details = [];
  const snapshot = params.entry.snapshot;
  if (snapshot.enabled === false) {
    details.push('disabled');
  }
  if (snapshot.dmPolicy) {
    details.push(`dm:${snapshot.dmPolicy}`);
  }
  if (snapshot.tokenSource && snapshot.tokenSource !== 'none') {
    details.push(`token:${snapshot.tokenSource}`);
  }
  if (snapshot.botTokenSource && snapshot.botTokenSource !== 'none') {
    details.push(`bot:${snapshot.botTokenSource}`);
  }
  if (snapshot.appTokenSource && snapshot.appTokenSource !== 'none') {
    details.push(`app:${snapshot.appTokenSource}`);
  }
  if (snapshot.baseUrl) {
    details.push(snapshot.baseUrl);
  }
  if (snapshot.port !== null && snapshot.port !== undefined) {
    details.push(`port:${snapshot.port}`);
  }
  if (snapshot.cliPath) {
    details.push(`cli:${snapshot.cliPath}`);
  }
  if (snapshot.dbPath) {
    details.push(`db:${snapshot.dbPath}`);
  }

  if (params.includeAllowFrom && snapshot.allowFrom?.length) {
    const formatted = formatAllowFrom({
      plugin: params.plugin,
      cfg: params.cfg,
      accountId: snapshot.accountId,
      allowFrom: snapshot.allowFrom
    }).slice(0, 2);
    if (formatted.length > 0) {
      details.push(`allow:${formatted.join(',')}`);
    }
  }
  return details;
};

/**
 * Builds a channel summary for all configured channels.
 * @param {import('../config/config.js').OpenClawConfig} [cfg]
 * @param {ChannelSummaryOptions} [options]
 * @returns {Promise<string[]>}
 */
export async function buildChannelSummary(cfg, options) {
  const effective = cfg ?? loadConfig();
  const lines = [];
  const resolved = {...DEFAULT_OPTIONS, ...options};
  const tint = (value, color) =>
    resolved.colorize && color ? color(value) : value;

  for (const plugin of listChannelPlugins()) {
    const accountIds = plugin.config.listAccountIds(effective);
    const defaultAccountId =
      plugin.config.defaultAccountId?.(effective) ?? accountIds[0] ?? DEFAULT_ACCOUNT_ID;
    const resolvedAccountIds = accountIds.length > 0 ? accountIds : [defaultAccountId];
    const entries = [];

    for (const accountId of resolvedAccountIds) {
      const account = plugin.config.resolveAccount(effective, accountId);
      const enabled = resolveAccountEnabled(plugin, account, effective);
      const configured = await resolveAccountConfigured(plugin, account, effective);
      const snapshot = buildAccountSnapshot({
        plugin,
        account,
        cfg: effective,
        accountId,
        enabled,
        configured
      });
      entries.push({accountId, account, enabled, configured, snapshot});
    }

    const configuredEntries = entries.filter((entry) => entry.configured);
    const anyEnabled = entries.some((entry) => entry.enabled);
    const fallbackEntry =
      entries.find((entry) => entry.accountId === defaultAccountId) ?? entries[0];
    const summary = plugin.status?.buildChannelSummary
      ? await plugin.status.buildChannelSummary({
        account: fallbackEntry?.account ?? {},
        cfg: effective,
        defaultAccountId,
        snapshot:
            fallbackEntry?.snapshot ?? /** @type {any} */ ({accountId: defaultAccountId})
      })
      : undefined;

    const summaryRecord = summary;
    const linked =
      summaryRecord && typeof summaryRecord.linked === 'boolean' ? summaryRecord.linked : null;
    const configured =
      summaryRecord && typeof summaryRecord.configured === 'boolean'
        ? summaryRecord.configured
        : configuredEntries.length > 0;

    const status = !anyEnabled
      ? 'disabled'
      : linked !== null
        ? linked
          ? 'linked'
          : 'not linked'
        : configured
          ? 'configured'
          : 'not configured';

    const statusColor =
      status === 'linked' || status === 'configured'
        ? theme.success
        : status === 'not linked'
          ? theme.error
          : theme.muted;
    const baseLabel = plugin.meta.label ?? plugin.id;
    let line = `${baseLabel}: ${status}`;

    const authAgeMs =
      summaryRecord && typeof summaryRecord.authAgeMs === 'number' ? summaryRecord.authAgeMs : null;
    const self = summaryRecord?.self;
    if (self?.e164) {
      line += ` ${self.e164}`;
    }
    if (authAgeMs !== null && authAgeMs !== undefined && authAgeMs >= 0) {
      line += ` auth ${formatAge(authAgeMs)}`;
    }

    lines.push(tint(line, statusColor));

    if (configuredEntries.length > 0) {
      for (const entry of configuredEntries) {
        const details = buildAccountDetails({
          entry,
          plugin,
          cfg: effective,
          includeAllowFrom: resolved.includeAllowFrom
        });
        lines.push(
          accountLine(
            formatAccountLabel({
              accountId: entry.accountId,
              name: entry.snapshot.name
            }),
            details
          )
        );
      }
    }
  }

  return lines;
}

/**
 * Formats a duration in milliseconds as a human-readable age string.
 * @param {number} ms
 * @returns {string}
 */
export function formatAge(ms) {
  if (ms < 0) {
    return 'unknown';
  }
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
