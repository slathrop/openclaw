/**
 * Plugin configuration type definitions.
 *
 * Covers plugin entries, slots, load paths, and install records.
 */

/**
 * @typedef {object} PluginEntryConfig
 * @property {boolean} [enabled]
 * @property {{[key: string]: *}} [config]
 */

/**
 * @typedef {object} PluginSlotsConfig
 * Select which plugin owns the memory slot ("none" disables memory plugins).
 * @property {string} [memory]
 */

/**
 * @typedef {object} PluginsLoadConfig
 * Additional plugin/extension paths to load.
 * @property {string[]} [paths]
 */

/**
 * @typedef {object} PluginInstallRecord
 * @property {"npm" | "archive" | "path"} source
 * @property {string} [spec]
 * @property {string} [sourcePath]
 * @property {string} [installPath]
 * @property {string} [version]
 * @property {string} [installedAt]
 */

/**
 * @typedef {object} PluginsConfig
 * Enable or disable plugin loading.
 * @property {boolean} [enabled]
 * Optional plugin allowlist (plugin ids).
 * @property {string[]} [allow]
 * Optional plugin denylist (plugin ids).
 * @property {string[]} [deny]
 * @property {PluginsLoadConfig} [load]
 * @property {PluginSlotsConfig} [slots]
 * @property {{[key: string]: PluginEntryConfig}} [entries]
 * @property {{[key: string]: PluginInstallRecord}} [installs]
 */
