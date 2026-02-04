/**
 * Memory backend configuration type definitions.
 *
 * Covers builtin and QMD memory backends, indexing, sessions, and limits.
 */

/**
 * @typedef {"builtin" | "qmd"} MemoryBackend
 */

/**
 * @typedef {"auto" | "on" | "off"} MemoryCitationsMode
 */

/**
 * @typedef {object} MemoryConfig
 * @property {MemoryBackend} [backend]
 * @property {MemoryCitationsMode} [citations]
 * @property {MemoryQmdConfig} [qmd]
 */

/**
 * @typedef {object} MemoryQmdConfig
 * @property {string} [command]
 * @property {boolean} [includeDefaultMemory]
 * @property {MemoryQmdIndexPath[]} [paths]
 * @property {MemoryQmdSessionConfig} [sessions]
 * @property {MemoryQmdUpdateConfig} [update]
 * @property {MemoryQmdLimitsConfig} [limits]
 * @property {SessionSendPolicyConfig} [scope]
 */

/**
 * @typedef {object} MemoryQmdIndexPath
 * @property {string} path
 * @property {string} [name]
 * @property {string} [pattern]
 */

/**
 * @typedef {object} MemoryQmdSessionConfig
 * @property {boolean} [enabled]
 * @property {string} [exportDir]
 * @property {number} [retentionDays]
 */

/**
 * @typedef {object} MemoryQmdUpdateConfig
 * @property {string} [interval]
 * @property {number} [debounceMs]
 * @property {boolean} [onBoot]
 * @property {string} [embedInterval]
 */

/**
 * @typedef {object} MemoryQmdLimitsConfig
 * @property {number} [maxResults]
 * @property {number} [maxSnippetChars]
 * @property {number} [maxInjectedChars]
 * @property {number} [timeoutMs]
 */
