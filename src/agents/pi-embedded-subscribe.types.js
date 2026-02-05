/**
 * @module pi-embedded-subscribe.types
 * Type definitions for the embedded Pi session subscription system.
 *
 * Defines the parameters and callback shape for subscribing to embedded Pi agent
 * sessions, including block reply chunking, reasoning streams, and tool output.
 */

/**
 * @typedef {'markdown' | 'plain'} ToolResultFormat
 */

/**
 * @typedef {object} SubscribeEmbeddedPiSessionParams
 * @property {import('@mariozechner/pi-coding-agent').AgentSession} session
 * @property {string} runId
 * @property {import('../auto-reply/thinking.js').VerboseLevel} [verboseLevel]
 * @property {import('../auto-reply/thinking.js').ReasoningLevel} [reasoningMode]
 * @property {ToolResultFormat} [toolResultFormat]
 * @property {() => boolean} [shouldEmitToolResult]
 * @property {() => boolean} [shouldEmitToolOutput]
 * @property {(payload: {text?: string, mediaUrls?: string[]}) => void | Promise<void>} [onToolResult]
 * @property {(payload: {text?: string, mediaUrls?: string[]}) => void | Promise<void>} [onReasoningStream]
 * @property {(payload: {text?: string, mediaUrls?: string[], audioAsVoice?: boolean, replyToId?: string, replyToTag?: boolean, replyToCurrent?: boolean}) => void | Promise<void>} [onBlockReply]
 * @property {() => void | Promise<void>} [onBlockReplyFlush]
 * @property {'text_end' | 'message_end'} [blockReplyBreak]
 * @property {import('./pi-embedded-block-chunker.js').BlockReplyChunking} [blockReplyChunking]
 * @property {(payload: {text?: string, mediaUrls?: string[]}) => void | Promise<void>} [onPartialReply]
 * @property {() => void | Promise<void>} [onAssistantMessageStart]
 * @property {(evt: {stream: string, data: Record<string, unknown>}) => void | Promise<void>} [onAgentEvent]
 * @property {boolean} [enforceFinalTag]
 */

/**
 * @typedef {import('./pi-embedded-block-chunker.js').BlockReplyChunking} BlockReplyChunking
 */
