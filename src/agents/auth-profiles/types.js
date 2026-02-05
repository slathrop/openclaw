/**
 * @module auth-profiles/types
 * Auth profile credential and store type definitions.
 *
 * SECURITY: Contains type definitions for authentication credentials
 * (API keys, tokens, OAuth). These types govern how secrets are stored and accessed.
 */

/**
 * @typedef {object} ApiKeyCredential
 * @property {"api_key"} type
 * @property {string} provider
 * @property {string} [key]
 * @property {string} [email]
 * @property {Record<string, string>} [metadata] - Optional provider-specific metadata (e.g., account IDs, gateway IDs).
 */

/**
 * Static bearer-style token (often OAuth access token / PAT).
 * Not refreshable by OpenClaw (unlike `type: "oauth"`).
 * @typedef {object} TokenCredential
 * @property {"token"} type
 * @property {string} provider
 * @property {string} token
 * @property {number} [expires] - Optional expiry timestamp (ms since epoch).
 * @property {string} [email]
 */

/**
 * @typedef {object} OAuthCredential
 * @property {"oauth"} type
 * @property {string} provider
 * @property {string} [clientId]
 * @property {string} [email]
 * @property {string} [access]
 * @property {string} [refresh]
 * @property {number} [expires]
 * @property {string} [enterpriseUrl]
 * @property {string} [projectId]
 * @property {string} [accountId]
 */

/**
 * @typedef {ApiKeyCredential | TokenCredential | OAuthCredential} AuthProfileCredential
 */

/**
 * @typedef {"auth" | "format" | "rate_limit" | "billing" | "timeout" | "unknown"} AuthProfileFailureReason
 */

/**
 * Per-profile usage statistics for round-robin and cooldown tracking.
 * @typedef {object} ProfileUsageStats
 * @property {number} [lastUsed]
 * @property {number} [cooldownUntil]
 * @property {number} [disabledUntil]
 * @property {AuthProfileFailureReason} [disabledReason]
 * @property {number} [errorCount]
 * @property {Partial<Record<AuthProfileFailureReason, number>>} [failureCounts]
 * @property {number} [lastFailureAt]
 */

/**
 * @typedef {object} AuthProfileStore
 * @property {number} version
 * @property {Record<string, AuthProfileCredential>} profiles
 * @property {Record<string, string[]>} [order] - Optional per-agent preferred profile order overrides.
 * @property {Record<string, string>} [lastGood]
 * @property {Record<string, ProfileUsageStats>} [usageStats] - Usage statistics per profile for round-robin rotation.
 */

/**
 * @typedef {object} AuthProfileIdRepairResult
 * @property {object} config
 * @property {string[]} changes
 * @property {boolean} migrated
 * @property {string} [fromProfileId]
 * @property {string} [toProfileId]
 */
