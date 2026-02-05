/**
 * Web inbound type definitions.
 * @typedef {object} WebListenerCloseReason
 * @property {number} [status]
 * @property {boolean} isLoggedOut
 * @property {unknown} [error]
 * @typedef {object} WebInboundMessage
 * @property {string} [id]
 * @property {string} from - conversation id: E.164 for direct chats, group JID for groups
 * @property {string} conversationId - alias for clarity (same as from)
 * @property {string} to
 * @property {string} accountId
 * @property {string} body
 * @property {string} [pushName]
 * @property {number} [timestamp]
 * @property {'direct' | 'group'} chatType
 * @property {string} chatId
 * @property {string} [senderJid]
 * @property {string} [senderE164]
 * @property {string} [senderName]
 * @property {string} [replyToId]
 * @property {string} [replyToBody]
 * @property {string} [replyToSender]
 * @property {string} [replyToSenderJid]
 * @property {string} [replyToSenderE164]
 * @property {string} [groupSubject]
 * @property {string[]} [groupParticipants]
 * @property {string[]} [mentionedJids]
 * @property {string | null} [selfJid]
 * @property {string | null} [selfE164]
 * @property {import('../../channels/location.js').NormalizedLocation} [location]
 * @property {() => Promise<void>} sendComposing
 * @property {(text: string) => Promise<void>} reply
 * @property {(payload: import('@whiskeysockets/baileys').AnyMessageContent) => Promise<void>} sendMedia
 * @property {string} [mediaPath]
 * @property {string} [mediaType]
 * @property {string} [mediaUrl]
 * @property {boolean} [wasMentioned]
 */

// This module is type-only; no runtime exports.
