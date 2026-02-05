/**
 * Type definitions for daemon CLI commands
 * @module daemon-cli/types
 */

/**
 * @typedef {object} GatewayRpcOpts
 * @property {string} [url]
 * @property {string} [token]
 * @property {string} [password]
 * @property {string} [timeout]
 * @property {boolean} [json]
 */

/**
 * @typedef {object} DaemonStatusOptions
 * @property {GatewayRpcOpts} rpc
 * @property {boolean} probe
 * @property {boolean} json
 * @property {string} [installDir] - From FindExtraGatewayServicesOptions
 */

/**
 * @typedef {object} DaemonInstallOptions
 * @property {string|number} [port]
 * @property {string} [runtime]
 * @property {string} [token]
 * @property {boolean} [force]
 * @property {boolean} [json]
 */

/**
 * @typedef {object} DaemonLifecycleOptions
 * @property {boolean} [json]
 */

export {};
