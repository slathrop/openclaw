/**
 * Feishu (Lark) channel configuration type definitions.
 *
 * Covers DM, group, streaming card, and multi-account settings.
 */

/**
 * @typedef {object} FeishuGroupConfig
 * @property {boolean} [requireMention]
 * Optional tool policy overrides for this group.
 * @property {GroupToolPolicyConfig} [tools]
 * @property {GroupToolPolicyBySenderConfig} [toolsBySender]
 * If specified, only load these skills for this group. Omit = all skills; empty = no skills.
 * @property {string[]} [skills]
 * If false, disable the bot for this group.
 * @property {boolean} [enabled]
 * Optional allowlist for group senders (open_ids).
 * @property {Array<string | number>} [allowFrom]
 * Optional system prompt snippet for this group.
 * @property {string} [systemPrompt]
 */

/**
 * @typedef {object} FeishuAccountConfig
 * @property
 */

/**
 * @typedef {object} FeishuConfig
 * Optional per-account Feishu configuration (multi-account).
 * @property {{[key: string]: FeishuAccountConfig}} [accounts]
 * Top-level app ID (alternative to accounts).
 * @property {string} [appId]
 * Top-level app secret (alternative to accounts).
 * @property {string} [appSecret]
 * Top-level app secret file (alternative to accounts).
 * @property {string} [appSecretFile]
 */
