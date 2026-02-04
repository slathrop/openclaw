/**
 * Signal channel configuration type definitions.
 *
 * Covers DM, group, reaction, CLI daemon, and multi-account settings.
 */

/**
 * @typedef {"off" | "own" | "all" | "allowlist"} SignalReactionNotificationMode
 */

/**
 * @typedef {"off" | "ack" | "minimal" | "extensive"} SignalReactionLevel
 */

/**
 * @typedef {object} SignalAccountConfig
 * Optional display name for this account (used in CLI/UI lists).
 * @property {string} [name]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * If false, do not start this Signal account. Default: true.
 * @property {boolean} [enabled]
 * Optional explicit E.164 account for signal-cli.
 * @property {string} [account]
 * Optional full base URL for signal-cli HTTP daemon.
 * @property {string} [httpUrl]
 * HTTP host for signal-cli daemon (default 127.0.0.1).
 * @property {string} [httpHost]
 * HTTP port for signal-cli daemon (default 8080).
 * @property {number} [httpPort]
 * signal-cli binary path (default: signal-cli).
 * @property {string} [cliPath]
 * Auto-start signal-cli daemon (default: true if httpUrl not set).
 * @property {boolean} [autoStart]
 * Max time to wait for signal-cli daemon startup (ms, cap 120000).
 * @property {number} [startupTimeoutMs]
 * @property {"on-start" | "manual"} [receiveMode]
 * @property {boolean} [ignoreAttachments]
 * @property {boolean} [ignoreStories]
 * @property {boolean} [sendReadReceipts]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [dmPolicy]
 * @property {Array<string | number>} [allowFrom]
 * Optional allowlist for Signal group senders (E.164).
 * @property {Array<string | number>} [groupAllowFrom]
 * Controls how group messages are handled: - "open": groups bypass allowFrom, no extra gating - "disabled": block all group messages - "allowlist": only allow group messages from senders in groupAllowFrom/allowFrom
 * @property {GroupPolicy} [groupPolicy]
 * Max group messages to keep as history context (0 disables).
 * @property {number} [historyLimit]
 * Max DM turns to keep as history context.
 * @property {number} [dmHistoryLimit]
 * Per-DM config overrides keyed by user ID.
 * @property {{[key: string]: DmConfig}} [dms]
 * Outbound text chunk size (chars). Default: 4000.
 * @property {number} [textChunkLimit]
 * Chunking mode: "length" (default) splits by size; "newline" splits on every newline.
 * @property {"length" | "newline"} [chunkMode]
 * @property {boolean} [blockStreaming]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * @property {number} [mediaMaxMb]
 * Reaction notification mode (off|own|all|allowlist). Default: own.
 * @property {SignalReactionNotificationMode} [reactionNotifications]
 * Allowlist for reaction notifications when mode is allowlist.
 * @property {Array<string | number>} [reactionAllowlist]
 * Action toggles for message tool capabilities.
 * @property {object} [actions]
 * Controls agent reaction behavior: - "off": No reactions - "ack": Only automatic ack reactions (👀 when processing) - "minimal": Agent can react sparingly (default) - "extensive": Agent can react liberally
 * @property {SignalReactionLevel} [reactionLevel]
 * Heartbeat visibility settings for this channel.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 * Outbound response prefix override for this channel/account.
 * @property {string} [responsePrefix]
 */

/**
 * @typedef {object} SignalConfig
 * Optional per-account Signal configuration (multi-account).
 * @property {{[key: string]: SignalAccountConfig}} [accounts]
 */
