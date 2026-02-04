/**
 * Webhook and internal hook configuration type definitions.
 *
 * Covers inbound hook mappings, Gmail push, transforms,
 * internal event handlers, and hook pack installs.
 */

/**
 * @typedef {object} HookMappingMatch
 * @property {string} [path]
 * @property {string} [source]
 */

/**
 * @typedef {object} HookMappingTransform
 * @property {string} module
 * @property {string} [export]
 */

/**
 * @typedef {object} HookMappingConfig
 * @property {string} [id]
 * @property {HookMappingMatch} [match]
 * @property {"wake" | "agent"} [action]
 * @property {"now" | "next-heartbeat"} [wakeMode]
 * @property {string} [name]
 * @property {string} [sessionKey]
 * @property {string} [messageTemplate]
 * @property {string} [textTemplate]
 * @property {boolean} [deliver]
 * DANGEROUS: Disable external content safety wrapping for this hook.
 * @property {boolean} [allowUnsafeExternalContent]
 * @property {*} [channel]
 * @property {string} [to]
 * Override model for this hook (provider/model or alias).
 * @property {string} [model]
 * @property {string} [thinking]
 * @property {number} [timeoutSeconds]
 * @property {HookMappingTransform} [transform]
 */

/**
 * @typedef {"off" | "serve" | "funnel"} HooksGmailTailscaleMode
 */

/**
 * @typedef {object} HooksGmailConfig
 * @property {string} [account]
 * @property {string} [label]
 * @property {string} [topic]
 * @property {string} [subscription]
 * @property {string} [pushToken]
 * @property {string} [hookUrl]
 * @property {boolean} [includeBody]
 * @property {number} [maxBytes]
 * @property {number} [renewEveryMinutes]
 * DANGEROUS: Disable external content safety wrapping for Gmail hooks.
 * @property {boolean} [allowUnsafeExternalContent]
 * @property {object} [serve]
 * @property {object} [tailscale]
 * Optional model override for Gmail hook processing (provider/model or alias).
 * @property {string} [model]
 * Optional thinking level override for Gmail hook processing.
 * @property {"off" | "minimal" | "low" | "medium" | "high"} [thinking]
 */

/**
 * @typedef {object} InternalHookHandlerConfig
 * Event key to listen for (e.g., 'command:new', 'session:start')
 * @property {string} event
 * Path to handler module (absolute or relative to cwd)
 * @property {string} module
 * Export name from module (default: 'default')
 * @property {string} [export]
 */

/**
 * @typedef {object} HookConfig
 * @property {boolean} [enabled]
 * @property {{[key: string]: string}} [env]
 * @property {*} [key]
 */

/**
 * @typedef {object} HookInstallRecord
 * @property {"npm" | "archive" | "path"} source
 * @property {string} [spec]
 * @property {string} [sourcePath]
 * @property {string} [installPath]
 * @property {string} [version]
 * @property {string} [installedAt]
 * @property {string[]} [hooks]
 */

/**
 * @typedef {object} InternalHooksConfig
 * Enable hooks system
 * @property {boolean} [enabled]
 * Legacy: List of internal hook handlers to register (still supported)
 * @property {InternalHookHandlerConfig[]} [handlers]
 * Per-hook configuration overrides
 * @property {{[key: string]: HookConfig}} [entries]
 * Load configuration
 * @property {object} [load]
 * Install records for hook packs or hooks
 * @property {{[key: string]: HookInstallRecord}} [installs]
 */

/**
 * @typedef {object} HooksConfig
 * @property {boolean} [enabled]
 * @property {string} [path]
 * @property {string} [token]
 * @property {number} [maxBodyBytes]
 * @property {string[]} [presets]
 * @property {string} [transformsDir]
 * @property {HookMappingConfig[]} [mappings]
 * @property {HooksGmailConfig} [gmail]
 * Internal agent event hooks
 * @property {InternalHooksConfig} [internal]
 */
