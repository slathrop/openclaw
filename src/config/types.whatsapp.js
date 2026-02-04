/**
 * WhatsApp channel configuration type definitions.
 *
 * Covers DM, group, ack reactions, and multi-account settings.
 */

/**
 * @typedef {object} WhatsAppActionConfig
 * @property {boolean} [reactions]
 * @property {boolean} [sendMessage]
 * @property {boolean} [polls]
 */

/**
 * @typedef {object} WhatsAppConfig
 * Optional per-account WhatsApp configuration (multi-account).
 * @property {{[key: string]: WhatsAppAccountConfig}} [accounts]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * Send read receipts for incoming messages (default true).
 * @property {boolean} [sendReadReceipts]
 * Inbound message prefix (WhatsApp only). Default: `[{agents.list[].identity.name}]` (or `[openclaw]`) when allowFrom is empty, else `""`.
 * @property {string} [messagePrefix]
 * Per-channel outbound response prefix override.  When set, this takes precedence over the global `messages.responsePrefix`. Use `""` to explicitly disable a global prefix for this channel. Use `"auto"` to derive `[{identity.name}]` from the routed agent.
 * @property {string} [responsePrefix]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [dmPolicy]
 * Same-phone setup (bot uses your personal WhatsApp number).
 * @property {boolean} [selfChatMode]
 * Optional allowlist for WhatsApp direct chats (E.164).
 * @property {string[]} [allowFrom]
 * Optional allowlist for WhatsApp group senders (E.164).
 * @property {string[]} [groupAllowFrom]
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
 * Maximum media file size in MB. Default: 50.
 * @property {number} [mediaMaxMb]
 * Disable block streaming for this account.
 * @property {boolean} [blockStreaming]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * Per-action tool gating (default: true for all).
 * @property {WhatsAppActionConfig} [actions]
 * @property {Record<
    string,
    {
      requireMention?: boolean;
      tools?: GroupToolPolicyConfig;
      toolsBySender?: GroupToolPolicyBySenderConfig;
    }
  >} [groups]
 * Acknowledgment reaction sent immediately upon message receipt.
 * @property {*} [ackReaction]
 * Debounce window (ms) for batching rapid consecutive messages from the same sender (0 to disable).
 * @property {number} [debounceMs]
 * Heartbeat visibility settings for this channel.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 */

/**
 * @typedef {object} WhatsAppAccountConfig
 * Optional display name for this account (used in CLI/UI lists).
 * @property {string} [name]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * If false, do not start this WhatsApp account provider. Default: true.
 * @property {boolean} [enabled]
 * Send read receipts for incoming messages (default true).
 * @property {boolean} [sendReadReceipts]
 * Inbound message prefix override for this account (WhatsApp only).
 * @property {string} [messagePrefix]
 * Per-account outbound response prefix override (takes precedence over channel and global).
 * @property {string} [responsePrefix]
 * Override auth directory (Baileys multi-file auth state).
 * @property {string} [authDir]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [dmPolicy]
 * Same-phone setup for this account (bot uses your personal WhatsApp number).
 * @property {boolean} [selfChatMode]
 * @property {string[]} [allowFrom]
 * @property {string[]} [groupAllowFrom]
 * @property {GroupPolicy} [groupPolicy]
 * Max group messages to keep as history context (0 disables).
 * @property {number} [historyLimit]
 * Max DM turns to keep as history context.
 * @property {number} [dmHistoryLimit]
 * Per-DM config overrides keyed by user ID.
 * @property {{[key: string]: DmConfig}} [dms]
 * @property {number} [textChunkLimit]
 * Chunking mode: "length" (default) splits by size; "newline" splits on every newline.
 * @property {"length" | "newline"} [chunkMode]
 * @property {number} [mediaMaxMb]
 * @property {boolean} [blockStreaming]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * @property {Record<
    string,
    {
      requireMention?: boolean;
      tools?: GroupToolPolicyConfig;
      toolsBySender?: GroupToolPolicyBySenderConfig;
    }
  >} [groups]
 * Acknowledgment reaction sent immediately upon message receipt.
 * @property {*} [ackReaction]
 * Debounce window (ms) for batching rapid consecutive messages from the same sender (0 to disable).
 * @property {number} [debounceMs]
 * Heartbeat visibility settings for this account.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 */
