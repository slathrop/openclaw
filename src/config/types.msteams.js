/**
 * MS Teams channel configuration type definitions.
 *
 * Covers webhook, DM, team/channel, reply style, and SharePoint settings.
 */

/**
 * @typedef {object} MSTeamsWebhookConfig
 * Port for the webhook server. Default: 3978.
 * @property {number} [port]
 * Path for the messages endpoint. Default: /api/messages.
 * @property {string} [path]
 */

/**
 * Reply style for MS Teams messages.
 * @typedef {"thread" | "top-level"} MSTeamsReplyStyle
 */

/**
 * Channel-level config for MS Teams.
 * @typedef {object} MSTeamsChannelConfig
 * Require @mention to respond. Default: true.
 * @property {boolean} [requireMention]
 * Optional tool policy overrides for this channel.
 * @property {GroupToolPolicyConfig} [tools]
 * @property {GroupToolPolicyBySenderConfig} [toolsBySender]
 * Reply style: "thread" replies to the message, "top-level" posts a new message.
 * @property {MSTeamsReplyStyle} [replyStyle]
 */

/**
 * Team-level config for MS Teams.
 * @typedef {object} MSTeamsTeamConfig
 * Default requireMention for channels in this team.
 * @property {boolean} [requireMention]
 * Default tool policy for channels in this team.
 * @property {GroupToolPolicyConfig} [tools]
 * @property {GroupToolPolicyBySenderConfig} [toolsBySender]
 * Default reply style for channels in this team.
 * @property {MSTeamsReplyStyle} [replyStyle]
 * Per-channel overrides. Key is conversation ID (e.g., "19:...@thread.tacv2").
 * @property {{[key: string]: MSTeamsChannelConfig}} [channels]
 */

/**
 * @typedef {object} MSTeamsConfig
 * If false, do not start the MS Teams provider. Default: true.
 * @property {boolean} [enabled]
 * Optional provider capability tags used for agent/runtime guidance.
 * @property {string[]} [capabilities]
 * Markdown formatting overrides (tables).
 * @property {MarkdownConfig} [markdown]
 * Allow channel-initiated config writes (default: true).
 * @property {boolean} [configWrites]
 * Azure Bot App ID (from Azure Bot registration).
 * @property {string} [appId]
 * Azure Bot App Password / Client Secret.
 * @property {string} [appPassword]
 * Azure AD Tenant ID (for single-tenant bots).
 * @property {string} [tenantId]
 * Webhook server configuration.
 * @property {MSTeamsWebhookConfig} [webhook]
 * Direct message access policy (default: pairing).
 * @property {DmPolicy} [dmPolicy]
 * Allowlist for DM senders (AAD object IDs or UPNs).
 * @property {Array<string>} [allowFrom]
 * Optional allowlist for group/channel senders (AAD object IDs or UPNs).
 * @property {Array<string>} [groupAllowFrom]
 * Controls how group/channel messages are handled: - "open": groups bypass allowFrom; mention-gating applies - "disabled": block all group messages - "allowlist": only allow group messages from senders in groupAllowFrom/allowFrom
 * @property {GroupPolicy} [groupPolicy]
 * Outbound text chunk size (chars). Default: 4000.
 * @property {number} [textChunkLimit]
 * Chunking mode: "length" (default) splits by size; "newline" splits on every newline.
 * @property {"length" | "newline"} [chunkMode]
 * Merge streamed block replies before sending.
 * @property {BlockStreamingCoalesceConfig} [blockStreamingCoalesce]
 * Allowed host suffixes for inbound attachment downloads. Use [" "] to allow any host (not recommended).
 * @property {Array<string>} [mediaAllowHosts]
 * Allowed host suffixes for attaching Authorization headers to inbound media retries. Use specific hosts only; avoid multi-tenant suffixes.
 * @property {Array<string>} [mediaAuthAllowHosts]
 * Default: require @mention to respond in channels/groups.
 * @property {boolean} [requireMention]
 * Max group/channel messages to keep as history context (0 disables).
 * @property {number} [historyLimit]
 * Max DM turns to keep as history context.
 * @property {number} [dmHistoryLimit]
 * Per-DM config overrides keyed by user ID.
 * @property {{[key: string]: DmConfig}} [dms]
 * Default reply style: "thread" replies to the message, "top-level" posts a new message.
 * @property {MSTeamsReplyStyle} [replyStyle]
 * Per-team config. Key is team ID (from the /team/ URL path segment).
 * @property {{[key: string]: MSTeamsTeamConfig}} [teams]
 * Max media size in MB (default: 100MB for OneDrive upload support).
 * @property {number} [mediaMaxMb]
 * SharePoint site ID for file uploads in group chats/channels (e.g., "contoso.sharepoint.com,guid1,guid2").
 * @property {string} [sharePointSiteId]
 * Heartbeat visibility settings for this channel.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 * Outbound response prefix override for this channel/account.
 * @property {string} [responsePrefix]
 */
