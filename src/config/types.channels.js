/**
 * Channel aggregation type definitions.
 *
 * Defines the top-level channels config structure, channel defaults,
 * and heartbeat visibility settings per channel.
 */

/**
 * @typedef {object} ChannelHeartbeatVisibilityConfig
 * Show HEARTBEAT_OK acknowledgments in chat (default: false).
 * @property {boolean} [showOk]
 * Show heartbeat alerts with actual content (default: true).
 * @property {boolean} [showAlerts]
 * Emit indicator events for UI status display (default: true).
 * @property {boolean} [useIndicator]
 */

/**
 * @typedef {object} ChannelDefaultsConfig
 * @property {GroupPolicy} [groupPolicy]
 * Default heartbeat visibility for all channels.
 * @property {ChannelHeartbeatVisibilityConfig} [heartbeat]
 */

/**
 * @typedef {object} ChannelsConfig
 * @property {ChannelDefaultsConfig} [defaults]
 * @property {WhatsAppConfig} [whatsapp]
 * @property {TelegramConfig} [telegram]
 * @property {DiscordConfig} [discord]
 * @property {FeishuConfig} [feishu]
 * @property {GoogleChatConfig} [googlechat]
 * @property {SlackConfig} [slack]
 * @property {SignalConfig} [signal]
 * @property {IMessageConfig} [imessage]
 * @property {MSTeamsConfig} [msteams]
 * @property {*} [key]
 */
