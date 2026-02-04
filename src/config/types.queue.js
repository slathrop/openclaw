/**
 * Message queue mode type definitions.
 *
 * Defines queue processing strategies and per-channel overrides.
 */

/**
 * @typedef {"steer" | "followup" | "collect" | "steer-backlog" | "steer+backlog" | "queue" | "interrupt"} QueueMode
 */

/**
 * @typedef {"old" | "new" | "summarize"} QueueDropPolicy
 */

/**
 * @typedef {object} QueueModeByProvider
 * @property {QueueMode} [whatsapp]
 * @property {QueueMode} [telegram]
 * @property {QueueMode} [discord]
 * @property {QueueMode} [googlechat]
 * @property {QueueMode} [slack]
 * @property {QueueMode} [signal]
 * @property {QueueMode} [imessage]
 * @property {QueueMode} [msteams]
 * @property {QueueMode} [webchat]
 */
