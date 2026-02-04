/**
 * Base/shared configuration type definitions.
 *
 * Provides foundational types used across multiple config modules:
 * reply modes, typing modes, session scopes, streaming, markdown,
 * logging, diagnostics, identity, and more.
 */

/**
 * @typedef {"text" | "command"} ReplyMode
 */

/**
 * @typedef {"never" | "instant" | "thinking" | "message"} TypingMode
 */

/**
 * @typedef {"per-sender" | "global"} SessionScope
 */

/**
 * @typedef {"main" | "per-peer" | "per-channel-peer" | "per-account-channel-peer"} DmScope
 */

/**
 * @typedef {"off" | "first" | "all"} ReplyToMode
 */

/**
 * @typedef {"open" | "disabled" | "allowlist"} GroupPolicy
 */

/**
 * @typedef {"pairing" | "allowlist" | "open" | "disabled"} DmPolicy
 */

/**
 * @typedef {object} OutboundRetryConfig
 * Max retry attempts for outbound requests (default: 3).
 * @property {number} [attempts]
 * Minimum retry delay in ms (default: 300-500ms depending on provider).
 * @property {number} [minDelayMs]
 * Maximum retry delay cap in ms (default: 30000).
 * @property {number} [maxDelayMs]
 * Jitter factor (0-1) applied to delays (default: 0.1).
 * @property {number} [jitter]
 */

/**
 * @typedef {object} BlockStreamingCoalesceConfig
 * @property {number} [minChars]
 * @property {number} [maxChars]
 * @property {number} [idleMs]
 */

/**
 * @typedef {object} BlockStreamingChunkConfig
 * @property {number} [minChars]
 * @property {number} [maxChars]
 * @property {"paragraph" | "newline" | "sentence"} [breakPreference]
 */

/**
 * @typedef {"off" | "bullets" | "code"} MarkdownTableMode
 */

/**
 * @typedef {object} MarkdownConfig
 * Table rendering mode (off|bullets|code).
 * @property {MarkdownTableMode} [tables]
 */

/**
 * @typedef {object} HumanDelayConfig
 * Delay style for block replies (off|natural|custom).
 * @property {"off" | "natural" | "custom"} [mode]
 * Minimum delay in milliseconds (default: 800).
 * @property {number} [minMs]
 * Maximum delay in milliseconds (default: 2500).
 * @property {number} [maxMs]
 */

/**
 * @typedef {"allow" | "deny"} SessionSendPolicyAction
 */

/**
 * @typedef {object} SessionSendPolicyMatch
 * @property {string} [channel]
 * @property {NormalizedChatType} [chatType]
 * @property {string} [keyPrefix]
 */

/**
 * @typedef {object} SessionSendPolicyRule
 * @property {SessionSendPolicyAction} action
 * @property {SessionSendPolicyMatch} [match]
 */

/**
 * @typedef {object} SessionSendPolicyConfig
 * @property {SessionSendPolicyAction} [default]
 * @property {SessionSendPolicyRule[]} [rules]
 */

/**
 * @typedef {"daily" | "idle"} SessionResetMode
 */

/**
 * @typedef {object} SessionResetConfig
 * @property {SessionResetMode} [mode]
 * Local hour (0-23) for the daily reset boundary.
 * @property {number} [atHour]
 * Sliding idle window (minutes). When set with daily mode, whichever expires first wins.
 * @property {number} [idleMinutes]
 */

/**
 * @typedef {object} SessionResetByTypeConfig
 * @property {SessionResetConfig} [dm]
 * @property {SessionResetConfig} [group]
 * @property {SessionResetConfig} [thread]
 */

/**
 * @typedef {object} SessionConfig
 * @property {SessionScope} [scope]
 * DM session scoping (default: "main").
 * @property {DmScope} [dmScope]
 * Map platform-prefixed identities (e.g. "telegram:123") to canonical DM peers.
 * @property {{[key: string]: string[]}} [identityLinks]
 * @property {string[]} [resetTriggers]
 * @property {number} [idleMinutes]
 * @property {SessionResetConfig} [reset]
 * @property {SessionResetByTypeConfig} [resetByType]
 * Channel-specific reset overrides (e.g. { discord: { mode: "idle", idleMinutes: 10080 } }).
 * @property {{[key: string]: SessionResetConfig}} [resetByChannel]
 * @property {string} [store]
 * @property {number} [typingIntervalSeconds]
 * @property {TypingMode} [typingMode]
 * @property {string} [mainKey]
 * @property {SessionSendPolicyConfig} [sendPolicy]
 * @property {object} [agentToAgent]
 */

/**
 * @typedef {object} LoggingConfig
 * @property {"silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace"} [level]
 * @property {string} [file]
 * @property {"silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace"} [consoleLevel]
 * @property {"pretty" | "compact" | "json"} [consoleStyle]
 * Redact sensitive tokens in tool summaries. Default: "tools".
 * @property {"off" | "tools"} [redactSensitive]
 * Regex patterns used to redact sensitive tokens (defaults apply when unset).
 * @property {string[]} [redactPatterns]
 */

/**
 * @typedef {object} DiagnosticsOtelConfig
 * @property {boolean} [enabled]
 * @property {string} [endpoint]
 * @property {"http/protobuf" | "grpc"} [protocol]
 * @property {{[key: string]: string}} [headers]
 * @property {string} [serviceName]
 * @property {boolean} [traces]
 * @property {boolean} [metrics]
 * @property {boolean} [logs]
 * Trace sample rate (0.0 - 1.0).
 * @property {number} [sampleRate]
 * Metric export interval (ms).
 * @property {number} [flushIntervalMs]
 */

/**
 * @typedef {object} DiagnosticsCacheTraceConfig
 * @property {boolean} [enabled]
 * @property {string} [filePath]
 * @property {boolean} [includeMessages]
 * @property {boolean} [includePrompt]
 * @property {boolean} [includeSystem]
 */

/**
 * @typedef {object} DiagnosticsConfig
 * @property {boolean} [enabled]
 * Optional ad-hoc diagnostics flags (e.g. "telegram.http").
 * @property {string[]} [flags]
 * @property {DiagnosticsOtelConfig} [otel]
 * @property {DiagnosticsCacheTraceConfig} [cacheTrace]
 */

/**
 * @typedef {object} WebReconnectConfig
 * @property {number} [initialMs]
 * @property {number} [maxMs]
 * @property {number} [factor]
 * @property {number} [jitter]
 * 0 = unlimited
 * @property {number} [maxAttempts]
 */

/**
 * @typedef {object} WebConfig
 * If false, do not start the WhatsApp web provider. Default: true.
 * @property {boolean} [enabled]
 * @property {number} [heartbeatSeconds]
 * @property {WebReconnectConfig} [reconnect]
 */

/**
 * Provider docking: allowlists keyed by provider id (and internal "webchat").
 * @typedef {{[key: string]: Array<string | number>}} AgentElevatedAllowFromConfig
 */

/**
 * @typedef {object} IdentityConfig
 * @property {string} [name]
 * @property {string} [theme]
 * @property {string} [emoji]
 * Avatar image: workspace-relative path, http(s) URL, or data URI.
 * @property {string} [avatar]
 */
