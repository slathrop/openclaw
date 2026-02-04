/**
 * Slack channel configuration type definitions.
 *
 * Covers DM, channel, slash command, thread, and multi-account settings.
 */

/**
 * @typedef {object} SlackDmConfig
 * If false, ignore all incoming Slack DMs. Default: true.
 * @property {boolean} [enabled]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [policy]
 * Allowlist for DM senders (ids).
 * @property {Array<string | number>} [allowFrom]
 * If true, allow group DMs (default: false).
 * @property {boolean} [groupEnabled]
 * Optional allowlist for group DM channels (ids or slugs).
 * @property {Array<string | number>} [groupChannels]
 * @deprecated Prefer channels.slack.replyToModeByChatType.direct.
 * @property {ReplyToMode} [replyToMode]
 */

/**
 * @typedef {object} SlackChannelConfig
 * If false, disable the bot in this channel. (Alias for allow: false.)
 * @property {boolean} [enabled]
 * Legacy channel allow toggle; prefer enabled.
 * @property {boolean} [allow]
 * Require mentioning the bot to trigger replies.
 * @property {boolean} [requireMention]
 * Optional tool policy overrides for this channel.
 * @property {GroupToolPolicyConfig} [tools]
 * @property {GroupToolPolicyBySenderConfig} [toolsBySender]
 * Allow bot-authored messages to trigger replies (default: false).
 * @property {boolean} [allowBots]
 * Allowlist of users that can invoke the bot in this channel.
 * @property {Array<string | number>} [users]
 * Optional skill filter for this channel.
 * @property {string[]} [skills]
 * Optional system prompt for this channel.
 * @property {string} [systemPrompt]
 */

/**
 * @typedef {"off" | "own" | "all" | "allowlist"} SlackReactionNotificationMode
 */

/**
 * @typedef {object} SlackActionConfig
 * @property {boolean} [reactions]
 * @property {boolean} [messages]
 * @property {boolean} [pins]
 * @property {boolean} [search]
 * @property {boolean} [permissions]
 * @property {boolean} [memberInfo]
 * @property {boolean} [channelInfo]
 * @property {boolean} [emojiList]
 */

/**
 * @typedef {object} SlackSlashCommandConfig
 * Enable handling for the configured slash command (default: false).
 * @property {boolean} [enabled]
 * Slash command name (default: "openclaw").
 * @property {string} [name]
 * Session key prefix for slash commands (default: "slack:slash").
 * @property {string} [sessionPrefix]
 * Reply ephemerally (default: true).
 * @property {boolean} [ephemeral]
 */

/**
 * @typedef {object} SlackThreadConfig
 * Scope for thread history context (thread|channel). Default: thread.
 * @property {"thread" | "channel"} [historyScope]
 * If true, thread sessions inherit the parent channel transcript. Default: false.
 * @property {boolean} [inheritParent]
 */

/**
 * @typedef {object} SlackAccountConfig
 * Optional display name for this account (used in CLI/UI lists).
 * @property {string} [name]
 * Slack connection mode (socket|http). Default: socket.
 * @property {"socket" | "http"} [mode]
 * Slack signing secret (required for HTTP mode).
 * @property {string} [signingSecret]
 * Slack Events API webhook path (default: /slack/events).
 * @property {string} [webhookPath]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Override native command registration for Slack (bool or "auto").
 * @property {ProviderCommandsConfig} [commands]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * If false, do not start this Slack account. Default: true.
 * @property {boolean} [enabled]
 * @property {string} [botToken]
 * @property {string} [appToken]
 * @property {string} [userToken]
 * If true, restrict user token to read operations only. Default: true.
 * @property {boolean} [userTokenReadOnly]
 * Allow bot-authored messages to trigger replies (default: false).
 * @property {boolean} [allowBots]
 * Default mention requirement for channel messages (default: true).
 * @property {boolean} [requireMention]
 * Controls how channel messages are handled: - "open": channels bypass allowlists; mention-gating applies - "disabled": block all channel messages - "allowlist": only allow channels present in channels.slack.channels
 * @property {GroupPolicy} [groupPolicy]
 * Max channel messages to keep as history context (0 disables).
 * @property {number} [historyLimit]
 * Max DM turns to keep as history context.
 * @property {number} [dmHistoryLimit]
 * Per-DM config overrides keyed by user ID.
 * @property {{[key: string]: DmConfig}} [dms]
 * @property {number} [textChunkLimit]
 * Chunking mode: "length" (default) splits by size; "newline" splits on every newline.
 * @property {"length" | "newline"} [chunkMode]
 * @property {boolean} [blockStreaming]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * @property {number} [mediaMaxMb]
 * Reaction notification mode (off|own|all|allowlist). Default: own.
 * @property {SlackReactionNotificationMode} [reactionNotifications]
 * Allowlist for reaction notifications when mode is allowlist.
 * @property {Array<string | number>} [reactionAllowlist]
 * Control reply threading when reply tags are present (off|first|all).
 * @property {ReplyToMode} [replyToMode]
 * Optional per-chat-type reply threading overrides. Example: { direct: "all", group: "first", channel: "off" }.
 * @property {{[key: string]: ReplyToMode}} [replyToModeByChatType]
 * Thread session behavior.
 * @property {SlackThreadConfig} [thread]
 * @property {SlackActionConfig} [actions]
 * @property {SlackSlashCommandConfig} [slashCommand]
 * @property {SlackDmConfig} [dm]
 * @property {{[key: string]: SlackChannelConfig}} [channels]
 * Heartbeat visibility settings for this channel.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 * Outbound response prefix override for this channel/account.
 * @property {string} [responsePrefix]
 */

/**
 * @typedef {object} SlackConfig
 * Optional per-account Slack configuration (multi-account).
 * @property {{[key: string]: SlackAccountConfig}} [accounts]
 */
