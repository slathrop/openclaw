/**
 * Telegram bot type definitions (JSDoc only, no runtime exports)
 * @typedef {object} TelegramContext
 * @property {import("@grammyjs/types").Message} message
 * @property {import("@grammyjs/types").UserFromGetMe} [me]
 * @property {() => Promise<{file_path?: string}>} getFile
 * @typedef {'off' | 'partial' | 'block'} TelegramStreamMode
 * @typedef {object} StickerMetadata
 * @property {string} [emoji] - Emoji associated with the sticker
 * @property {string} [setName] - Name of the sticker set the sticker belongs to
 * @property {string} [fileId] - Telegram file_id for sending the sticker back
 * @property {string} [fileUniqueId] - Stable file_unique_id for cache deduplication
 * @property {string} [cachedDescription] - Cached description from previous vision processing
 */
