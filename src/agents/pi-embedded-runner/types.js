/**
 * @module pi-embedded-runner/types
 * Type definitions for embedded Pi agent runner results and metadata.
 */

/**
 * @typedef {object} EmbeddedPiAgentMeta
 * @property {string} sessionId
 * @property {string} provider
 * @property {string} model
 * @property {object} [usage]
 * @property {number} [usage.input]
 * @property {number} [usage.output]
 * @property {number} [usage.cacheRead]
 * @property {number} [usage.cacheWrite]
 * @property {number} [usage.total]
 */

/**
 * @typedef {object} EmbeddedPiRunMeta
 * @property {number} durationMs
 * @property {EmbeddedPiAgentMeta} [agentMeta]
 * @property {boolean} [aborted]
 * @property {object} [systemPromptReport]
 * @property {object} [error]
 * @property {"context_overflow" | "compaction_failure" | "role_ordering" | "image_size"} [error.kind]
 * @property {string} [error.message]
 * @property {string} [stopReason] - Stop reason for the agent run (e.g., "completed", "tool_calls").
 * @property {Array<{id: string, name: string, arguments: string}>} [pendingToolCalls] - Pending tool calls when stopReason is "tool_calls".
 */

/**
 * @typedef {object} EmbeddedPiRunResult
 * @property {Array<{text?: string, mediaUrl?: string, mediaUrls?: string[], replyToId?: string, isError?: boolean}>} [payloads]
 * @property {EmbeddedPiRunMeta} meta
 * @property {boolean} [didSendViaMessagingTool] - True if a messaging tool sent a message.
 * @property {string[]} [messagingToolSentTexts] - Texts sent via messaging tools.
 * @property {Array<*>} [messagingToolSentTargets] - Messaging tool targets that sent a message.
 */

/**
 * @typedef {object} EmbeddedPiCompactResult
 * @property {boolean} ok
 * @property {boolean} compacted
 * @property {string} [reason]
 * @property {object} [result]
 * @property {string} [result.summary]
 * @property {string} [result.firstKeptEntryId]
 * @property {number} [result.tokensBefore]
 * @property {number} [result.tokensAfter]
 * @property {*} [result.details]
 */

/**
 * @typedef {object} EmbeddedSandboxInfo
 * @property {boolean} enabled
 * @property {string} [workspaceDir]
 * @property {"none" | "ro" | "rw"} [workspaceAccess]
 * @property {string} [agentWorkspaceMount]
 * @property {string} [browserBridgeUrl]
 * @property {string} [browserNoVncUrl]
 * @property {boolean} [hostBrowserAllowed]
 * @property {object} [elevated]
 * @property {boolean} [elevated.allowed]
 * @property {"on" | "off" | "ask" | "full"} [elevated.defaultLevel]
 */
