/**
 * Type definitions for status command output
 * @module commands/status.types
 */

/**
 * @typedef {object} SessionStatus
 * @property {string} [agentId]
 * @property {string} key
 * @property {'direct'|'group'|'global'|'unknown'} kind
 * @property {string} [sessionId]
 * @property {number|null} updatedAt
 * @property {number|null} age
 * @property {string} [thinkingLevel]
 * @property {string} [verboseLevel]
 * @property {string} [reasoningLevel]
 * @property {string} [elevatedLevel]
 * @property {boolean} [systemSent]
 * @property {boolean} [abortedLastRun]
 * @property {number} [inputTokens]
 * @property {number} [outputTokens]
 * @property {number|null} totalTokens
 * @property {number|null} remainingTokens
 * @property {number|null} percentUsed
 * @property {string|null} model
 * @property {number|null} contextTokens
 * @property {string[]} flags
 */

/**
 * @typedef {object} HeartbeatStatus
 * @property {string} agentId
 * @property {boolean} enabled
 * @property {string} every
 * @property {number|null} everyMs
 */

/**
 * @typedef {object} StatusSummary
 * @property {{id: string, label: string, linked: boolean, authAgeMs: number|null}} [linkChannel]
 * @property {{defaultAgentId: string, agents: HeartbeatStatus[]}} heartbeat
 * @property {string[]} channelSummary
 * @property {string[]} queuedSystemEvents
 * @property {{paths: string[], count: number, defaults: {model: string|null, contextTokens: number|null}, recent: SessionStatus[], byAgent: Array<{agentId: string, path: string, count: number, recent: SessionStatus[]}>}} sessions
 */

export {};
