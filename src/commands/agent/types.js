/**
 * Type definitions for agent command options
 * @module commands/agent/types
 */

/**
 * @typedef {object} ImageContent
 * @property {'image'} type
 * @property {string} data
 * @property {string} mimeType
 */

/**
 * @typedef {object} AgentStreamParams
 * @property {number} [temperature] - Provider stream params override (best-effort)
 * @property {number} [maxTokens]
 */

/**
 * @typedef {object} AgentRunContext
 * @property {string} [messageChannel]
 * @property {string} [accountId]
 * @property {string|null} [groupId]
 * @property {string|null} [groupChannel]
 * @property {string|null} [groupSpace]
 * @property {string} [currentChannelId]
 * @property {string} [currentThreadTs]
 * @property {'off'|'first'|'all'} [replyToMode]
 * @property {{value: boolean}} [hasRepliedRef]
 */

/**
 * @typedef {object} AgentCommandOpts
 * @property {string} message
 * @property {ImageContent[]} [images] - Optional image attachments for multimodal messages
 * @property {Array<*>} [clientTools] - Optional client-provided tools
 * @property {string} [agentId] - Agent id override (must exist in config)
 * @property {string} [to]
 * @property {string} [sessionId]
 * @property {string} [sessionKey]
 * @property {string} [thinking]
 * @property {string} [thinkingOnce]
 * @property {string} [verbose]
 * @property {boolean} [json]
 * @property {string} [timeout]
 * @property {boolean} [deliver]
 * @property {string} [replyTo] - Override delivery target
 * @property {string} [replyChannel] - Override delivery channel
 * @property {string} [replyAccountId] - Override delivery account id
 * @property {string|number} [threadId] - Override delivery thread/topic id
 * @property {string} [messageChannel] - Message channel context
 * @property {string} [channel] - Delivery channel
 * @property {string} [accountId] - Account ID for multi-account channel routing
 * @property {AgentRunContext} [runContext] - Context for embedded run routing
 * @property {string|null} [groupId] - Group id for channel-level tool policy resolution
 * @property {string|null} [groupChannel] - Group channel label
 * @property {string|null} [groupSpace] - Group space label
 * @property {string|null} [spawnedBy] - Parent session key for subagent policy inheritance
 * @property {string} [deliveryTargetMode]
 * @property {boolean} [bestEffortDeliver]
 * @property {AbortSignal} [abortSignal]
 * @property {string} [lane]
 * @property {string} [runId]
 * @property {string} [extraSystemPrompt]
 * @property {AgentStreamParams} [streamParams] - Per-call stream param overrides
 */

export {};
