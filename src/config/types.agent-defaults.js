/**
 * Agent defaults configuration type definitions.
 *
 * Covers model selection, context pruning, compaction, CLI backends,
 * sandbox settings, heartbeat, and other per-agent default config.
 */

/**
 * @typedef {object} AgentModelEntryConfig
 * @property {string} [alias]
 * Provider-specific API parameters (e.g., GLM-4.7 thinking mode).
 * @property {{[key: string]: *}} [params]
 */

/**
 * @typedef {object} AgentModelListConfig
 * @property {string} [primary]
 * @property {string[]} [fallbacks]
 */

/**
 * @typedef {object} AgentContextPruningConfig
 * @property {"off" | "cache-ttl"} [mode]
 * TTL to consider cache expired (duration string, default unit: minutes).
 * @property {string} [ttl]
 * @property {number} [keepLastAssistants]
 * @property {number} [softTrimRatio]
 * @property {number} [hardClearRatio]
 * @property {number} [minPrunableToolChars]
 * @property {object} [tools]
 * @property {object} [softTrim]
 * @property {object} [hardClear]
 */

/**
 * @typedef {object} CliBackendConfig
 * CLI command to execute (absolute path or on PATH).
 * @property {string} command
 * Base args applied to every invocation.
 * @property {string[]} [args]
 * Output parsing mode (default: json).
 * @property {"json" | "text" | "jsonl"} [output]
 * Output parsing mode when resuming a CLI session.
 * @property {"json" | "text" | "jsonl"} [resumeOutput]
 * Prompt input mode (default: arg).
 * @property {"arg" | "stdin"} [input]
 * Max prompt length for arg mode (if exceeded, stdin is used).
 * @property {number} [maxPromptArgChars]
 * Extra env vars injected for this CLI.
 * @property {{[key: string]: string}} [env]
 * Env vars to remove before launching this CLI.
 * @property {string[]} [clearEnv]
 * Flag used to pass model id (e.g. --model).
 * @property {string} [modelArg]
 * Model aliases mapping (config model id → CLI model id).
 * @property {{[key: string]: string}} [modelAliases]
 * Flag used to pass session id (e.g. --session-id).
 * @property {string} [sessionArg]
 * Extra args used when resuming a session (use {sessionId} placeholder).
 * @property {string[]} [sessionArgs]
 * Alternate args to use when resuming a session (use {sessionId} placeholder).
 * @property {string[]} [resumeArgs]
 * When to pass session ids.
 * @property {"always" | "existing" | "none"} [sessionMode]
 * JSON fields to read session id from (in order).
 * @property {string[]} [sessionIdFields]
 * Flag used to pass system prompt.
 * @property {string} [systemPromptArg]
 * System prompt behavior (append vs replace).
 * @property {"append" | "replace"} [systemPromptMode]
 * When to send system prompt.
 * @property {"first" | "always" | "never"} [systemPromptWhen]
 * Flag used to pass image paths.
 * @property {string} [imageArg]
 * How to pass multiple images.
 * @property {"repeat" | "list"} [imageMode]
 * Serialize runs for this CLI.
 * @property {boolean} [serialize]
 */

/**
 * @typedef {object} AgentDefaultsConfig
 * @property
 */

/**
 * @typedef {"default" | "safeguard"} AgentCompactionMode
 */

/**
 * @typedef {object} AgentCompactionConfig
 * Compaction summarization mode.
 * @property {AgentCompactionMode} [mode]
 * Minimum reserve tokens enforced for Pi compaction (0 disables the floor).
 * @property {number} [reserveTokensFloor]
 * Max share of context window for history during safeguard pruning (0.1–0.9, default 0.5).
 * @property {number} [maxHistoryShare]
 * Pre-compaction memory flush (agentic turn). Default: enabled.
 * @property {AgentCompactionMemoryFlushConfig} [memoryFlush]
 */

/**
 * @typedef {object} AgentCompactionMemoryFlushConfig
 * Enable the pre-compaction memory flush (default: true).
 * @property {boolean} [enabled]
 * Run the memory flush when context is within this many tokens of the compaction threshold.
 * @property {number} [softThresholdTokens]
 * User prompt used for the memory flush turn (NO_REPLY is enforced if missing).
 * @property {string} [prompt]
 * System prompt appended for the memory flush turn.
 * @property {string} [systemPrompt]
 */
