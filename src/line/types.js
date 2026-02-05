/**
 * LINE channel type definitions
 *
 * Configuration, account resolution, webhook context, and message types
 * for the LINE Messaging API integration
 */

/**
 * @typedef {"config" | "env" | "file" | "none"} LineTokenSource
 */

/**
 * @typedef {object} LineConfig
 * @property {boolean} [enabled]
 * @property {string} [channelAccessToken]
 * @property {string} [channelSecret]
 * @property {string} [tokenFile]
 * @property {string} [secretFile]
 * @property {string} [name]
 * @property {Array<string | number>} [allowFrom]
 * @property {Array<string | number>} [groupAllowFrom]
 * @property {"open" | "allowlist" | "pairing" | "disabled"} [dmPolicy]
 * @property {"open" | "allowlist" | "disabled"} [groupPolicy]
 * Outbound response prefix override for this channel/account
 * @property {string} [responsePrefix]
 * @property {number} [mediaMaxMb]
 * @property {string} [webhookPath]
 * @property {Record<string, LineAccountConfig>} [accounts]
 * @property {Record<string, LineGroupConfig>} [groups]
 */

/**
 * @typedef {object} LineAccountConfig
 * @property {boolean} [enabled]
 * @property {string} [channelAccessToken]
 * @property {string} [channelSecret]
 * @property {string} [tokenFile]
 * @property {string} [secretFile]
 * @property {string} [name]
 * @property {Array<string | number>} [allowFrom]
 * @property {Array<string | number>} [groupAllowFrom]
 * @property {"open" | "allowlist" | "pairing" | "disabled"} [dmPolicy]
 * @property {"open" | "allowlist" | "disabled"} [groupPolicy]
 * Outbound response prefix override for this account
 * @property {string} [responsePrefix]
 * @property {number} [mediaMaxMb]
 * @property {string} [webhookPath]
 * @property {Record<string, LineGroupConfig>} [groups]
 */

/**
 * @typedef {object} LineGroupConfig
 * @property {boolean} [enabled]
 * @property {Array<string | number>} [allowFrom]
 * @property {boolean} [requireMention]
 * @property {string} [systemPrompt]
 * @property {string[]} [skills]
 */

/**
 * @typedef {object} ResolvedLineAccount
 * @property {string} accountId
 * @property {string} [name]
 * @property {boolean} enabled
 * @property {string} channelAccessToken
 * @property {string} channelSecret
 * @property {LineTokenSource} tokenSource
 * @property {LineConfig & LineAccountConfig} config
 */

/**
 * @typedef {import("@line/bot-sdk").TextMessage | import("@line/bot-sdk").ImageMessage | import("@line/bot-sdk").VideoMessage | import("@line/bot-sdk").AudioMessage | import("@line/bot-sdk").StickerMessage | import("@line/bot-sdk").LocationMessage} LineMessageType
 */

/**
 * @typedef {object} LineWebhookContext
 * @property {import("@line/bot-sdk").WebhookEvent} event
 * @property {string} [replyToken]
 * @property {string} [userId]
 * @property {string} [groupId]
 * @property {string} [roomId]
 */

/**
 * @typedef {object} LineSendResult
 * @property {string} messageId
 * @property {string} chatId
 */

/**
 * @typedef {object} LineProbeResult
 * @property {boolean} ok
 * @property {{displayName?: string, userId?: string, basicId?: string, pictureUrl?: string}} [bot]
 * @property {string} [error]
 */

/**
 * @typedef {object} LineFlexMessagePayload
 * @property {string} altText
 * @property {unknown} contents
 */

/**
 * @typedef {{type: "confirm", text: string, confirmLabel: string, confirmData: string, cancelLabel: string, cancelData: string, altText?: string} | {type: "buttons", title: string, text: string, actions: Array<{type: "message" | "uri" | "postback", label: string, data?: string, uri?: string}>, thumbnailImageUrl?: string, altText?: string} | {type: "carousel", columns: Array<{title?: string, text: string, thumbnailImageUrl?: string, actions: Array<{type: "message" | "uri" | "postback", label: string, data?: string, uri?: string}>}>, altText?: string}} LineTemplateMessagePayload
 */

/**
 * @typedef {object} LineChannelData
 * @property {string[]} [quickReplies]
 * @property {{title: string, address: string, latitude: number, longitude: number}} [location]
 * @property {LineFlexMessagePayload} [flexMessage]
 * @property {LineTemplateMessagePayload} [templateMessage]
 */
