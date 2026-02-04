/**
 * Skill configuration type definitions.
 *
 * Covers skill entries, load paths, watcher, and install settings.
 */

/**
 * @typedef {object} SkillConfig
 * @property {boolean} [enabled]
 * @property {string} [apiKey]
 * @property {{[key: string]: string}} [env]
 * @property {{[key: string]: *}} [config]
 */

/**
 * @typedef {object} SkillsLoadConfig
 * Additional skill folders to scan (lowest precedence). Each directory should contain skill subfolders with `SKILL.md`.
 * @property {string[]} [extraDirs]
 * Watch skill folders for changes and refresh the skills snapshot.
 * @property {boolean} [watch]
 * Debounce for the skills watcher (ms).
 * @property {number} [watchDebounceMs]
 */

/**
 * @typedef {object} SkillsInstallConfig
 * @property {boolean} [preferBrew]
 * @property {"npm" | "pnpm" | "yarn" | "bun"} [nodeManager]
 */

/**
 * @typedef {object} SkillsConfig
 * Optional bundled-skill allowlist (only affects bundled skills).
 * @property {string[]} [allowBundled]
 * @property {SkillsLoadConfig} [load]
 * @property {SkillsInstallConfig} [install]
 * @property {{[key: string]: SkillConfig}} [entries]
 */
