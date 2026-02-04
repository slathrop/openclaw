/**
 * Google Chat channel configuration type definitions.
 *
 * Covers DM, space, service account, and multi-account settings.
 */

/**
 * @typedef {object} GoogleChatDmConfig
 * If false, ignore all incoming Google Chat DMs. Default: true.
 * @property {boolean} [enabled]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [policy]
 * Allowlist for DM senders (user ids or emails).
 * @property {Array<string | number>} [allowFrom]
 */

/**
 * @typedef {object} GoogleChatGroupConfig
 * If false, disable the bot in this space. (Alias for allow: false.)
 * @property {boolean} [enabled]
 * Legacy allow toggle; prefer enabled.
 * @property {boolean} [allow]
 * Require mentioning the bot to trigger replies.
 * @property {boolean} [requireMention]
 * Allowlist of users that can invoke the bot in this space.
 * @property {Array<string | number>} [users]
 * Optional system prompt for this space.
 * @property {string} [systemPrompt]
 */

/**
 * @typedef {object} GoogleChatActionConfig
 * @property {boolean} [reactions]
 */

/**
 * @typedef {object} GoogleChatAccountConfig
 * Optional display name for this account (used in CLI/UI lists).
 * @property {string} [name]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * If false, do not start this Google Chat account. Default: true.
 * @property {boolean} [enabled]
 * Allow bot-authored messages to trigger replies (default: false).
 * @property {boolean} [allowBots]
 * Default mention requirement for space messages (default: true).
 * @property {boolean} [requireMention]
 * Controls how space messages are handled: - "open": spaces bypass allowlists; mention-gating applies - "disabled": block all space messages - "allowlist": only allow spaces present in channels.googlechat.groups
 * @property {GroupPolicy} [groupPolicy]
 * Optional allowlist for space senders (user ids or emails).
 * @property {Array<string | number>} [groupAllowFrom]
 * Per-space configuration keyed by space id or name.
 * @property {{[key: string]: GoogleChatGroupConfig}} [groups]
 * Service account JSON (inline string or object).
 * @property {string | {[key: string]: *}} [serviceAccount]
 * Service account JSON file path.
 * @property {string} [serviceAccountFile]
 * Webhook audience type (app-url or project-number).
 * @property {"app-url" | "project-number"} [audienceType]
 * Audience value (app URL or project number).
 * @property {string} [audience]
 * Google Chat webhook path (default: /googlechat).
 * @property {string} [webhookPath]
 * Google Chat webhook URL (used to derive the path).
 * @property {string} [webhookUrl]
 * Optional bot user resource name (users/...).
 * @property {string} [botUser]
 * Max space messages to keep as history context (0 disables).
 * @property {number} [historyLimit]
 * Max DM turns to keep as history context.
 * @property {number} [dmHistoryLimit]
 * Per-DM config overrides keyed by user id.
 * @property {{[key: string]: DmConfig}} [dms]
 * Outbound text chunk size (chars). Default: 4000.
 * @property {number} [textChunkLimit]
 * Chunking mode: "length" (default) splits by size; "newline" splits on every newline.
 * @property {"length" | "newline"} [chunkMode]
 * @property {boolean} [blockStreaming]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * @property {number} [mediaMaxMb]
 * Control reply threading when reply tags are present (off|first|all).
 * @property {ReplyToMode} [replyToMode]
 * Per-action tool gating (default: true for all).
 * @property {GoogleChatActionConfig} [actions]
 * @property {GoogleChatDmConfig} [dm]
 * Typing indicator mode (default: "message"). - "none": No indicator - "message": Send "_<name> is typing..._" then edit with response - "reaction": React with 👀 to user message, remove on reply NOTE: Reaction mode requires user OAuth (not supported with service account auth). If configured, falls back to message mode with a warning.
 * @property {"none" | "message" | "reaction"} [typingIndicator]
 * Outbound response prefix override for this channel/account.
 * @property {string} [responsePrefix]
 */

/**
 * @typedef {object} GoogleChatConfig
 * Optional per-account Google Chat configuration (multi-account).
 * @property {{[key: string]: GoogleChatAccountConfig}} [accounts]
 * Optional default account id when multiple accounts are configured.
 * @property {string} [defaultAccount]
 */
