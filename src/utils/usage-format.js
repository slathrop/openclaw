/**
 * Usage cost formatting and estimation.
 *
 * Formats token counts and USD cost values for display, resolves
 * per-model cost configuration, and estimates total usage cost
 * from token counts and rate data.
 */

/**
 * @typedef {object} ModelCostConfig
 * @property {number} input - Cost per 1M input tokens.
 * @property {number} output - Cost per 1M output tokens.
 * @property {number} cacheRead - Cost per 1M cache-read tokens.
 * @property {number} cacheWrite - Cost per 1M cache-write tokens.
 */

/**
 * @typedef {object} UsageTotals
 * @property {number} [input]
 * @property {number} [output]
 * @property {number} [cacheRead]
 * @property {number} [cacheWrite]
 * @property {number} [total]
 */

/**
 * Formats a token count for display (e.g. "1.2k", "2.5m").
 * @param {number} [value]
 * @returns {string}
 */
export function formatTokenCount(value) {
  if (value === undefined || !Number.isFinite(value)) {
    return '0';
  }
  const safe = Math.max(0, value);
  if (safe >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(1)}m`;
  }
  if (safe >= 1_000) {
    return `${(safe / 1_000).toFixed(safe >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(safe));
}

/**
 * Formats a USD value for display (e.g. "$1.23", "$0.0042").
 * @param {number} [value]
 * @returns {string | undefined}
 */
export function formatUsd(value) {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 0.01) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toFixed(4)}`;
}

/**
 * Resolves model cost configuration from the OpenClaw config.
 * @param {object} params
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {object} [params.config]
 * @returns {ModelCostConfig | undefined}
 */
export function resolveModelCostConfig(params) {
  const provider = params.provider?.trim();
  const model = params.model?.trim();
  if (!provider || !model) {
    return undefined;
  }
  const providers = params.config?.models?.providers ?? {};
  const entry = providers[provider]?.models?.find((item) => item.id === model);
  return entry?.cost;
}

/**
 * @param {number | undefined} value
 * @returns {number}
 */
const toNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * Estimates the total usage cost from token counts and rate data.
 * @param {object} params
 * @param {UsageTotals} [params.usage]
 * @param {ModelCostConfig} [params.cost]
 * @returns {number | undefined}
 */
export function estimateUsageCost(params) {
  const usage = params.usage;
  const cost = params.cost;
  if (!usage || !cost) {
    return undefined;
  }
  const input = toNumber(usage.input);
  const output = toNumber(usage.output);
  const cacheRead = toNumber(usage.cacheRead);
  const cacheWrite = toNumber(usage.cacheWrite);
  const total =
    input * cost.input +
    output * cost.output +
    cacheRead * cost.cacheRead +
    cacheWrite * cost.cacheWrite;
  if (!Number.isFinite(total)) {
    return undefined;
  }
  return total / 1_000_000;
}
