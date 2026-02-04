/**
 * Tool configuration type definitions.
 *
 * Covers media understanding, links, exec, tool policies, profiles,
 * memory search, web search/fetch, elevated mode, and sandbox tools.
 */

/**
 * @typedef {object} MediaUnderstandingScopeMatch
 * @property {string} [channel]
 * @property {NormalizedChatType} [chatType]
 * @property {string} [keyPrefix]
 */

/**
 * @typedef {object} MediaUnderstandingScopeRule
 * @property {SessionSendPolicyAction} action
 * @property {MediaUnderstandingScopeMatch} [match]
 */

/**
 * @typedef {object} MediaUnderstandingScopeConfig
 * @property {SessionSendPolicyAction} [default]
 * @property {MediaUnderstandingScopeRule[]} [rules]
 */

/**
 * @typedef {"image" | "audio" | "video"} MediaUnderstandingCapability
 */

/**
 * @typedef {object} MediaUnderstandingAttachmentsConfig
 * Select the first matching attachment or process multiple.
 * @property {"first" | "all"} [mode]
 * Max number of attachments to process (default: 1).
 * @property {number} [maxAttachments]
 * Attachment ordering preference.
 * @property {"first" | "last" | "path" | "url"} [prefer]
 */

/**
 * @typedef {object} MediaUnderstandingModelConfig
 * provider API id (e.g. openai, google).
 * @property {string} [provider]
 * Model id for provider-based understanding.
 * @property {string} [model]
 * Optional capability tags for shared model lists.
 * @property {MediaUnderstandingCapability[]} [capabilities]
 * Use a CLI command instead of provider API.
 * @property {"provider" | "cli"} [type]
 * CLI binary (required when type=cli).
 * @property {string} [command]
 * CLI args (template-enabled).
 * @property {string[]} [args]
 * Optional prompt override for this model entry.
 * @property {string} [prompt]
 * Optional max output characters for this model entry.
 * @property {number} [maxChars]
 * Optional max bytes for this model entry.
 * @property {number} [maxBytes]
 * Optional timeout override (seconds) for this model entry.
 * @property {number} [timeoutSeconds]
 * Optional language hint for audio transcription.
 * @property {string} [language]
 * Optional provider-specific query params (merged into requests).
 * @property {{[key: string]: {[key: string]: string | number | boolean}}} [providerOptions]
 * @deprecated Use providerOptions.deepgram instead.
 * @property {object} [deepgram]
 * Optional base URL override for provider requests.
 * @property {string} [baseUrl]
 * Optional headers merged into provider requests.
 * @property {{[key: string]: string}} [headers]
 * Auth profile id to use for this provider.
 * @property {string} [profile]
 * Preferred profile id if multiple are available.
 * @property {string} [preferredProfile]
 */

/**
 * @typedef {object} MediaUnderstandingConfig
 * Enable media understanding when models are configured.
 * @property {boolean} [enabled]
 * Optional scope gating for understanding.
 * @property {MediaUnderstandingScopeConfig} [scope]
 * Default max bytes to send.
 * @property {number} [maxBytes]
 * Default max output characters.
 * @property {number} [maxChars]
 * Default prompt.
 * @property {string} [prompt]
 * Default timeout (seconds).
 * @property {number} [timeoutSeconds]
 * Default language hint (audio).
 * @property {string} [language]
 * Optional provider-specific query params (merged into requests).
 * @property {{[key: string]: {[key: string]: string | number | boolean}}} [providerOptions]
 * @deprecated Use providerOptions.deepgram instead.
 * @property {object} [deepgram]
 * Optional base URL override for provider requests.
 * @property {string} [baseUrl]
 * Optional headers merged into provider requests.
 * @property {{[key: string]: string}} [headers]
 * Attachment selection policy.
 * @property {MediaUnderstandingAttachmentsConfig} [attachments]
 * Ordered model list (fallbacks in order).
 * @property {MediaUnderstandingModelConfig[]} [models]
 */

/**
 * @typedef {object} LinkModelConfig
 * Use a CLI command for link processing.
 * @property {"cli"} [type]
 * CLI binary (required when type=cli).
 * @property {string} command
 * CLI args (template-enabled).
 * @property {string[]} [args]
 * Optional timeout override (seconds) for this model entry.
 * @property {number} [timeoutSeconds]
 */

/**
 * @typedef {object} LinkToolsConfig
 * Enable link understanding when models are configured.
 * @property {boolean} [enabled]
 * Optional scope gating for understanding.
 * @property {MediaUnderstandingScopeConfig} [scope]
 * Max number of links to process per message.
 * @property {number} [maxLinks]
 * Default timeout (seconds).
 * @property {number} [timeoutSeconds]
 * Ordered model list (fallbacks in order).
 * @property {LinkModelConfig[]} [models]
 */

/**
 * @typedef {object} MediaToolsConfig
 * Shared model list applied across image/audio/video.
 * @property {MediaUnderstandingModelConfig[]} [models]
 * Max concurrent media understanding runs.
 * @property {number} [concurrency]
 * @property {MediaUnderstandingConfig} [image]
 * @property {MediaUnderstandingConfig} [audio]
 * @property {MediaUnderstandingConfig} [video]
 */

/**
 * @typedef {"minimal" | "coding" | "messaging" | "full"} ToolProfileId
 */

/**
 * @typedef {object} ToolPolicyConfig
 * @property {string[]} [allow]
 * Additional allowlist entries merged into the effective allowlist.  Intended for additive configuration (e.g., "also allow lobster") without forcing users to replace/duplicate an existing allowlist or profile.
 * @property {string[]} [alsoAllow]
 * @property {string[]} [deny]
 * @property {ToolProfileId} [profile]
 */

/**
 * @typedef {object} GroupToolPolicyConfig
 * @property {string[]} [allow]
 * Additional allowlist entries merged into allow.
 * @property {string[]} [alsoAllow]
 * @property {string[]} [deny]
 */

/**
 * @typedef {{[key: string]: GroupToolPolicyConfig}} GroupToolPolicyBySenderConfig
 */

/**
 * @typedef {object} ExecToolConfig
 * Exec host routing (default: sandbox).
 * @property {"sandbox" | "gateway" | "node"} [host]
 * Exec security mode (default: deny).
 * @property {"deny" | "allowlist" | "full"} [security]
 * Exec ask mode (default: on-miss).
 * @property {"off" | "on-miss" | "always"} [ask]
 * Default node binding for exec.host=node (node id/name).
 * @property {string} [node]
 * Directories to prepend to PATH when running exec (gateway/sandbox).
 * @property {string[]} [pathPrepend]
 * Safe stdin-only binaries that can run without allowlist entries.
 * @property {string[]} [safeBins]
 * Default time (ms) before an exec command auto-backgrounds.
 * @property {number} [backgroundMs]
 * Default timeout (seconds) before auto-killing exec commands.
 * @property {number} [timeoutSec]
 * Emit a running notice (ms) when approval-backed exec runs long (default: 10000, 0 = off).
 * @property {number} [approvalRunningNoticeMs]
 * How long to keep finished sessions in memory (ms).
 * @property {number} [cleanupMs]
 * Emit a system event and heartbeat when a backgrounded exec exits.
 * @property {boolean} [notifyOnExit]
 * apply_patch subtool configuration (experimental).
 * @property {object} [applyPatch]
 */

/**
 * @typedef {object} AgentToolsConfig
 * Base tool profile applied before allow/deny lists.
 * @property {ToolProfileId} [profile]
 * @property {string[]} [allow]
 * Additional allowlist entries merged into allow and/or profile allowlist.
 * @property {string[]} [alsoAllow]
 * @property {string[]} [deny]
 * Optional tool policy overrides keyed by provider id or "provider/model".
 * @property {{[key: string]: ToolPolicyConfig}} [byProvider]
 * Per-agent elevated exec gate (can only further restrict global tools.elevated).
 * @property {object} [elevated]
 * Exec tool defaults for this agent.
 * @property {ExecToolConfig} [exec]
 * @property {object} [sandbox]
 */

/**
 * @typedef {object} MemorySearchConfig
 * Enable vector memory search (default: true).
 * @property {boolean} [enabled]
 * Sources to index and search (default: ["memory"]).
 * @property {Array<"memory" | "sessions">} [sources]
 * Extra paths to include in memory search (directories or .md files).
 * @property {string[]} [extraPaths]
 * Experimental memory search settings.
 * @property {object} [experimental]
 * Embedding provider mode.
 * @property {"openai" | "gemini" | "local"} [provider]
 * @property {object} [remote]
 * Fallback behavior when embeddings fail.
 * @property {"openai" | "gemini" | "local" | "none"} [fallback]
 * Embedding model id (remote) or alias (local).
 * @property {string} [model]
 * Local embedding settings (node-llama-cpp).
 * @property {object} [local]
 * Index storage configuration.
 * @property {object} [store]
 * Chunking configuration.
 * @property {object} [chunking]
 * Sync behavior.
 * @property {object} [sync]
 * Query behavior.
 * @property {object} [query]
 * Index cache behavior.
 * @property {object} [cache]
 */

/**
 * @typedef {object} ToolsConfig
 * Base tool profile applied before allow/deny lists.
 * @property {ToolProfileId} [profile]
 * @property {string[]} [allow]
 * Additional allowlist entries merged into allow and/or profile allowlist.
 * @property {string[]} [alsoAllow]
 * @property {string[]} [deny]
 * Optional tool policy overrides keyed by provider id or "provider/model".
 * @property {{[key: string]: ToolPolicyConfig}} [byProvider]
 * @property {*} [web]
 * @property {MediaToolsConfig} [media]
 * @property {LinkToolsConfig} [links]
 * Message tool configuration.
 * @property {object} [message]
 * @property {object} [agentToAgent]
 * Elevated exec permissions for the host machine.
 * @property {object} [elevated]
 * Exec tool defaults.
 * @property {ExecToolConfig} [exec]
 * Sub-agent tool policy defaults (deny wins).
 * @property {*} [subagents]
 * Sandbox tool policy defaults (deny wins).
 * @property {object} [sandbox]
 */
