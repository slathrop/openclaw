/**
 * Authentication configuration type definitions.
 *
 * SECURITY: Controls auth profile modes (api_key, oauth, token),
 * profile ordering, and billing backoff/cooldown settings.
 */

/**
 * @typedef {object} AuthProfileConfig
 * @property {string} provider
 * Credential type expected in auth-profiles.json for this profile id. - api_key: static provider API key - oauth: refreshable OAuth credentials (access+refresh+expires) - token: static bearer-style token (optionally expiring; no refresh)
 * @property {"api_key" | "oauth" | "token"} mode
 * @property {string} [email]
 */

/**
 * @typedef {object} AuthConfig
 * @property {{[key: string]: AuthProfileConfig}} [profiles]
 * @property {{[key: string]: string[]}} [order]
 * @property {object} [cooldowns]
 */
