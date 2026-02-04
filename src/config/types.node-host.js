/**
 * Node host configuration type definitions.
 *
 * Covers browser proxy settings for node-hosted instances.
 */

/**
 * @typedef {object} NodeHostBrowserProxyConfig
 * Enable the browser proxy on the node host (default: true).
 * @property {boolean} [enabled]
 * Optional allowlist of profile names exposed via the proxy.
 * @property {string[]} [allowProfiles]
 */

/**
 * @typedef {object} NodeHostConfig
 * Browser proxy settings for node hosts.
 * @property {NodeHostBrowserProxyConfig} [browserProxy]
 */
