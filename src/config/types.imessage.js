/**
 * iMessage channel configuration type definitions.
 *
 * Covers DM, group, remote host, and multi-account settings.
 */

/**
 * @typedef {object} IMessageAccountConfig
 * Optional display name for this account (used in CLI/UI lists).
 * @property {string} [name]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * If false, do not start this iMessage account. Default: true.
 * @property {boolean} [enabled]
 * imsg CLI binary path (default: imsg).
 * @property {string} [cliPath]
 * Optional Messages db path override.
 * @property {string} [dbPath]
 * Remote host for SCP when attachments live on a different machine (e.g., openclaw@192.168.64.3).
 * @property {string} [remoteHost]
 * Optional default send service (imessage|sms|auto).
 * @property {"imessage" | "sms" | "auto"} [service]
 * Optional default region (used when sending SMS).
 * @property {string} [region]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [dmPolicy]
 * Optional allowlist for inbound handles or chat_id targets.
 * @property {Array<string | number>} [allowFrom]
 * Optional allowlist for group senders or chat_id targets.
 * @property {Array<string | number>} [groupAllowFrom]
 * Controls how group messages are handled: - "open": groups bypass allowFrom; mention-gating applies - "disabled": block all group messages entirely - "allowlist": only allow group messages from senders in groupAllowFrom/allowFrom
 * @property {GroupPolicy} [groupPolicy]
 * Max group messages to keep as history context (0 disables).
 * @property {number} [historyLimit]
 * Max DM turns to keep as history context.
 * @property {number} [dmHistoryLimit]
 * Per-DM config overrides keyed by user ID.
 * @property {{[key: string]: DmConfig}} [dms]
 * Include attachments + reactions in watch payloads.
 * @property {boolean} [includeAttachments]
 * Max outbound media size in MB.
 * @property {number} [mediaMaxMb]
 * Timeout for probe/RPC operations in milliseconds (default: 10000).
 * @property {number} [probeTimeoutMs]
 * Outbound text chunk size (chars). Default: 4000.
 * @property {number} [textChunkLimit]
 * Chunking mode: "length" (default) splits by size; "newline" splits on every newline.
 * @property {"length" | "newline"} [chunkMode]
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
 * Heartbeat visibility settings for this channel.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 * Outbound response prefix override for this channel/account.
 * @property {string} [responsePrefix]
 */

/**
 * @typedef {object} IMessageConfig
 * Optional per-account iMessage configuration (multi-account).
 * @property {{[key: string]: IMessageAccountConfig}} [accounts]
 */
