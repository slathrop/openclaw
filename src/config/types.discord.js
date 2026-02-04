/**
 * Discord channel configuration type definitions.
 *
 * Covers DM, guild, action, intent, approval, and multi-account settings.
 */

/**
 * @typedef {object} DiscordDmConfig
 * If false, ignore all incoming Discord DMs. Default: true.
 * @property {boolean} [enabled]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [policy]
 * Allowlist for DM senders (ids or names).
 * @property {Array<string | number>} [allowFrom]
 * If true, allow group DMs (default: false).
 * @property {boolean} [groupEnabled]
 * Optional allowlist for group DM channels (ids or slugs).
 * @property {Array<string | number>} [groupChannels]
 */

/**
 * @typedef {object} DiscordGuildChannelConfig
 * @property {boolean} [allow]
 * @property {boolean} [requireMention]
 * Optional tool policy overrides for this channel.
 * @property {GroupToolPolicyConfig} [tools]
 * @property {GroupToolPolicyBySenderConfig} [toolsBySender]
 * If specified, only load these skills for this channel. Omit = all skills; empty = no skills.
 * @property {string[]} [skills]
 * If false, disable the bot for this channel.
 * @property {boolean} [enabled]
 * Optional allowlist for channel senders (ids or names).
 * @property {Array<string | number>} [users]
 * Optional system prompt snippet for this channel.
 * @property {string} [systemPrompt]
 * If false, omit thread starter context for this channel (default: true).
 * @property {boolean} [includeThreadStarter]
 */

/**
 * @typedef {"off" | "own" | "all" | "allowlist"} DiscordReactionNotificationMode
 */

/**
 * @typedef {object} DiscordGuildEntry
 * @property {string} [slug]
 * @property {boolean} [requireMention]
 * Optional tool policy overrides for this guild (used when channel override is missing).
 * @property {GroupToolPolicyConfig} [tools]
 * @property {GroupToolPolicyBySenderConfig} [toolsBySender]
 * Reaction notification mode (off|own|all|allowlist). Default: own.
 * @property {DiscordReactionNotificationMode} [reactionNotifications]
 * @property {Array<string | number>} [users]
 * @property {{[key: string]: DiscordGuildChannelConfig}} [channels]
 */

/**
 * @typedef {object} DiscordActionConfig
 * @property {boolean} [reactions]
 * @property {boolean} [stickers]
 * @property {boolean} [polls]
 * @property {boolean} [permissions]
 * @property {boolean} [messages]
 * @property {boolean} [threads]
 * @property {boolean} [pins]
 * @property {boolean} [search]
 * @property {boolean} [memberInfo]
 * @property {boolean} [roleInfo]
 * @property {boolean} [roles]
 * @property {boolean} [channelInfo]
 * @property {boolean} [voiceStatus]
 * @property {boolean} [events]
 * @property {boolean} [moderation]
 * @property {boolean} [emojiUploads]
 * @property {boolean} [stickerUploads]
 * @property {boolean} [channels]
 * Enable bot presence/activity changes (default: false).
 * @property {boolean} [presence]
 */

/**
 * @typedef {object} DiscordIntentsConfig
 * Enable Guild Presences privileged intent (requires Portal opt-in). Default: false.
 * @property {boolean} [presence]
 * Enable Guild Members privileged intent (requires Portal opt-in). Default: false.
 * @property {boolean} [guildMembers]
 */

/**
 * @typedef {object} DiscordExecApprovalConfig
 * Enable exec approval forwarding to Discord DMs. Default: false.
 * @property {boolean} [enabled]
 * Discord user IDs to receive approval prompts. Required if enabled.
 * @property {Array<string | number>} [approvers]
 * Only forward approvals for these agent IDs. Omit = all agents.
 * @property {string[]} [agentFilter]
 * Only forward approvals matching these session key patterns (substring or regex).
 * @property {string[]} [sessionFilter]
 */

/**
 * @typedef {object} DiscordAccountConfig
 * Optional display name for this account (used in CLI/UI lists).
 * @property {string} [name]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Override native command registration for Discord (bool or "auto").
 * @property {ProviderCommandsConfig} [commands]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * If false, do not start this Discord account. Default: true.
 * @property {boolean} [enabled]
 * @property {string} [token]
 * Allow bot-authored messages to trigger replies (default: false).
 * @property {boolean} [allowBots]
 * Controls how guild channel messages are handled: - "open": guild channels bypass allowlists; mention-gating applies - "disabled": block all guild channel messages - "allowlist": only allow channels present in discord.guilds. .channels
 * @property {GroupPolicy} [groupPolicy]
 * Outbound text chunk size (chars). Default: 2000.
 * @property {number} [textChunkLimit]
 * Chunking mode: "length" (default) splits by size; "newline" splits on every newline.
 * @property {"length" | "newline"} [chunkMode]
 * Disable block streaming for this account.
 * @property {boolean} [blockStreaming]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * Soft max line count per Discord message. Discord clients can clip/collapse very tall messages; splitting by lines keeps replies readable in-channel. Default: 17.
 * @property {number} [maxLinesPerMessage]
 * @property {number} [mediaMaxMb]
 * @property {number} [historyLimit]
 * Max DM turns to keep as history context.
 * @property {number} [dmHistoryLimit]
 * Per-DM config overrides keyed by user ID.
 * @property {{[key: string]: DmConfig}} [dms]
 * Retry policy for outbound Discord API calls.
 * @property {OutboundRetryConfig} [retry]
 * Per-action tool gating (default: true for all).
 * @property {DiscordActionConfig} [actions]
 * Control reply threading when reply tags are present (off|first|all).
 * @property {ReplyToMode} [replyToMode]
 * @property {DiscordDmConfig} [dm]
 * New per-guild config keyed by guild id or slug.
 * @property {{[key: string]: DiscordGuildEntry}} [guilds]
 * Heartbeat visibility settings for this channel.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 * Exec approval forwarding configuration.
 * @property {DiscordExecApprovalConfig} [execApprovals]
 * Privileged Gateway Intents (must also be enabled in Discord Developer Portal).
 * @property {DiscordIntentsConfig} [intents]
 * PluralKit identity resolution for proxied messages.
 * @property {DiscordPluralKitConfig} [pluralkit]
 * Outbound response prefix override for this channel/account.
 * @property {string} [responsePrefix]
 */

/**
 * @typedef {object} DiscordConfig
 * Optional per-account Discord configuration (multi-account).
 * @property {{[key: string]: DiscordAccountConfig}} [accounts]
 */
