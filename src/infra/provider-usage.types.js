/**
 * Provider usage tracking type definitions.
 *
 * Shared types for usage snapshots, windows, and provider identifiers
 * used across all provider-specific usage fetch modules.
 */

/**
 * @typedef {object} UsageWindow
 * @property {string} label
 * @property {number} usedPercent
 * @property {number} [resetAt]
 */

/**
 * @typedef {object} ProviderUsageSnapshot
 * @property {UsageProviderId} provider
 * @property {string} displayName
 * @property {UsageWindow[]} windows
 * @property {string} [plan]
 * @property {string} [error]
 */

/**
 * @typedef {object} UsageSummary
 * @property {number} updatedAt
 * @property {ProviderUsageSnapshot[]} providers
 */

/**
 * @typedef {'anthropic' | 'github-copilot' | 'google-gemini-cli' | 'google-antigravity' | 'minimax' | 'openai-codex' | 'xiaomi' | 'zai'} UsageProviderId
 */
