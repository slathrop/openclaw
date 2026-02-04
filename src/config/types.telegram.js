/**
 * Telegram channel configuration type definitions.
 *
 * Covers DM, group, topic, action, webhook, and multi-account settings.
 */

/**
 * @typedef {object} TelegramActionConfig
 * @property {boolean} [reactions]
 * @property {boolean} [sendMessage]
 * @property {boolean} [deleteMessage]
 * @property {boolean} [editMessage]
 * Enable sticker actions (send and search).
 * @property {boolean} [sticker]
 */

/**
 * @typedef {object} TelegramNetworkConfig
 * @property
 */

/**
 * @typedef {"off" | "dm" | "group" | "all" | "allowlist"} TelegramInlineButtonsScope
 */

/**
 * @typedef {string[] | object} TelegramCapabilitiesConfig
 */

/**
 * Custom command definition for Telegram bot menu.
 * @typedef {object} TelegramCustomCommand
 * Command name (without leading /).
 * @property {string} command
 * Description shown in Telegram command menu.
 * @property {string} description
 */

/**
 * @typedef {object} TelegramAccountConfig
 * Optional display name for this account (used in CLI/UI lists).
 * @property {string} [name]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {TelegramCapabilitiesConfig} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Override native command registration for Telegram (bool or "auto").
 * @property {ProviderCommandsConfig} [commands]
 * Custom commands to register in Telegram's command menu (merged with native).
 * @property {TelegramCustomCommand[]} [customCommands]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * Controls how Telegram direct chats (DMs) are handled: - "pairing" (default): unknown senders get a pairing code; owner must approve - "allowlist": only allow senders in allowFrom (or paired allow store) - "open": allow all inbound DMs (requires allowFrom to include " ") - "disabled": ignore all inbound DMs
 * @property {DmPolicy} [dmPolicy]
 * If false, do not start this Telegram account. Default: true.
 * @property {boolean} [enabled]
 * @property {string} [botToken]
 * Path to file containing bot token (for secret managers like agenix).
 * @property {string} [tokenFile]
 * Control reply threading when reply tags are present (off|first|all).
 * @property {ReplyToMode} [replyToMode]
 * @property {{[key: string]: TelegramGroupConfig}} [groups]
 * @property {Array<string | number>} [allowFrom]
 * Optional allowlist for Telegram group senders (user ids or usernames).
 * @property {Array<string | number>} [groupAllowFrom]
 * Controls how group messages are handled: - "open": groups bypass allowFrom, only mention-gating applies - "disabled": block all group messages entirely - "allowlist": only allow group messages from senders in groupAllowFrom/allowFrom
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
 * Disable block streaming for this account.
 * @property {boolean} [blockStreaming]
 * Chunking config for draft streaming in `streamMode: "block"`.
 * @property {BlockStreamingChunkConfig} [draftChunk]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * Draft streaming mode for Telegram (off|partial|block). Default: partial.
 * @property {"off" | "partial" | "block"} [streamMode]
 * @property {number} [mediaMaxMb]
 * Telegram API client timeout in seconds (grammY ApiClientOptions).
 * @property {number} [timeoutSeconds]
 * Retry policy for outbound Telegram API calls.
 * @property {OutboundRetryConfig} [retry]
 * Network transport overrides for Telegram.
 * @property {TelegramNetworkConfig} [network]
 * @property {string} [proxy]
 * @property {string} [webhookUrl]
 * @property {string} [webhookSecret]
 * @property {string} [webhookPath]
 * Per-action tool gating (default: true for all).
 * @property {TelegramActionConfig} [actions]
 * Controls which user reactions trigger notifications: - "off" (default): ignore all reactions - "own": notify when users react to bot messages - "all": notify agent of all reactions
 * @property {"off" | "own" | "all"} [reactionNotifications]
 * Controls agent's reaction capability: - "off": agent cannot react - "ack" (default): bot sends acknowledgment reactions (👀 while processing) - "minimal": agent can react sparingly (guideline: 1 per 5-10 exchanges) - "extensive": agent can react liberally when appropriate
 * @property {"off" | "ack" | "minimal" | "extensive"} [reactionLevel]
 * Heartbeat visibility settings for this channel.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 * Controls whether link previews are shown in outbound messages. Default: true.
 * @property {boolean} [linkPreview]
 * Per-channel outbound response prefix override.  When set, this takes precedence over the global `messages.responsePrefix`. Use `""` to explicitly disable a global prefix for this channel. Use `"auto"` to derive `[{identity.name}]` from the routed agent.
 * @property {string} [responsePrefix]
 */

/**
 * @typedef {object} TelegramTopicConfig
 * @property {boolean} [requireMention]
 * If specified, only load these skills for this topic. Omit = all skills; empty = no skills.
 * @property {string[]} [skills]
 * If false, disable the bot for this topic.
 * @property {boolean} [enabled]
 * Optional allowlist for topic senders (ids or usernames).
 * @property {Array<string | number>} [allowFrom]
 * Optional system prompt snippet for this topic.
 * @property {string} [systemPrompt]
 */

/**
 * @typedef {object} TelegramGroupConfig
 * @property {boolean} [requireMention]
 * Optional tool policy overrides for this group.
 * @property {GroupToolPolicyConfig} [tools]
 * @property {GroupToolPolicyBySenderConfig} [toolsBySender]
 * If specified, only load these skills for this group (when no topic). Omit = all skills; empty = no skills.
 * @property {string[]} [skills]
 * Per-topic configuration (key is message_thread_id as string)
 * @property {{[key: string]: TelegramTopicConfig}} [topics]
 * If false, disable the bot for this group (and its topics).
 * @property {boolean} [enabled]
 * Optional allowlist for group senders (ids or usernames).
 * @property {Array<string | number>} [allowFrom]
 * Optional system prompt snippet for this group.
 * @property {string} [systemPrompt]
 */

/**
 * @typedef {object} TelegramConfig
 * Optional per-account Telegram configuration (multi-account).
 * @property {{[key: string]: TelegramAccountConfig}} [accounts]
 */
