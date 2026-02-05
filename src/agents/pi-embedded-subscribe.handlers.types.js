/**
 * @module pi-embedded-subscribe.handlers.types
 * Type definitions for embedded Pi subscription handler state and context.
 *
 * Defines the mutable state tracked during an embedded Pi agent session
 * subscription, the context object passed to event handlers, and the
 * event union consumed by the handler dispatch.
 */

/**
 * @typedef {object} EmbeddedSubscribeLogger
 * @property {(message: string) => void} debug
 * @property {(message: string) => void} warn
 */

/**
 * @typedef {object} ToolErrorSummary
 * @property {string} toolName
 * @property {string} [meta]
 * @property {string} [error]
 */

/**
 * @typedef {object} EmbeddedPiSubscribeState
 * @property {string[]} assistantTexts
 * @property {Array<{toolName?: string, meta?: string}>} toolMetas
 * @property {Map<string, string | undefined>} toolMetaById
 * @property {Set<string>} toolSummaryById
 * @property {ToolErrorSummary} [lastToolError]
 * @property {'text_end' | 'message_end'} blockReplyBreak
 * @property {import('../auto-reply/thinking.js').ReasoningLevel} reasoningMode
 * @property {boolean} includeReasoning
 * @property {boolean} shouldEmitPartialReplies
 * @property {boolean} streamReasoning
 * @property {string} deltaBuffer
 * @property {string} blockBuffer
 * @property {{thinking: boolean, final: boolean, inlineCode: import('../markdown/code-spans.js').InlineCodeState}} blockState
 * @property {{thinking: boolean, final: boolean, inlineCode: import('../markdown/code-spans.js').InlineCodeState}} partialBlockState
 * @property {string} [lastStreamedAssistant]
 * @property {string} [lastStreamedAssistantCleaned]
 * @property {boolean} emittedAssistantUpdate
 * @property {string} [lastStreamedReasoning]
 * @property {string} [lastBlockReplyText]
 * @property {number} assistantMessageIndex
 * @property {number} lastAssistantTextMessageIndex
 * @property {string} [lastAssistantTextNormalized]
 * @property {string} [lastAssistantTextTrimmed]
 * @property {number} assistantTextBaseline
 * @property {boolean} suppressBlockChunks
 * @property {string} [lastReasoningSent]
 * @property {boolean} compactionInFlight
 * @property {number} pendingCompactionRetry
 * @property {() => void} [compactionRetryResolve]
 * @property {Promise<void> | null} compactionRetryPromise
 * @property {string[]} messagingToolSentTexts
 * @property {string[]} messagingToolSentTextsNormalized
 * @property {import('./pi-embedded-messaging.js').MessagingToolSend[]} messagingToolSentTargets
 * @property {Map<string, string>} pendingMessagingTexts
 * @property {Map<string, import('./pi-embedded-messaging.js').MessagingToolSend>} pendingMessagingTargets
 */

/**
 * @typedef {object} EmbeddedPiSubscribeContext
 * @property {import('./pi-embedded-subscribe.types.js').SubscribeEmbeddedPiSessionParams} params
 * @property {EmbeddedPiSubscribeState} state
 * @property {EmbeddedSubscribeLogger} log
 * @property {import('./pi-embedded-block-chunker.js').BlockReplyChunking} [blockChunking]
 * @property {import('./pi-embedded-block-chunker.js').EmbeddedBlockChunker | null} blockChunker
 * @property {() => boolean} shouldEmitToolResult
 * @property {() => boolean} shouldEmitToolOutput
 * @property {(toolName?: string, meta?: string) => void} emitToolSummary
 * @property {(toolName?: string, meta?: string, output?: string) => void} emitToolOutput
 * @property {(text: string, state: {thinking: boolean, final: boolean, inlineCode?: import('../markdown/code-spans.js').InlineCodeState}) => string} stripBlockTags
 * @property {(text: string) => void} emitBlockChunk
 * @property {() => void} flushBlockReplyBuffer
 * @property {(text: string) => void} emitReasoningStream
 * @property {(text: string, options?: {final?: boolean}) => import('../auto-reply/reply/reply-directives.js').ReplyDirectiveParseResult | null} consumeReplyDirectives
 * @property {(text: string, options?: {final?: boolean}) => import('../auto-reply/reply/reply-directives.js').ReplyDirectiveParseResult | null} consumePartialReplyDirectives
 * @property {(nextAssistantTextBaseline: number) => void} resetAssistantMessageState
 * @property {() => void} resetForCompactionRetry
 * @property {(args: {text: string, addedDuringMessage: boolean, chunkerHasBuffered: boolean}) => void} finalizeAssistantTexts
 * @property {() => void} trimMessagingToolSent
 * @property {() => void} ensureCompactionPromise
 * @property {() => void} noteCompactionRetry
 * @property {() => void} resolveCompactionRetry
 * @property {() => void} maybeResolveCompactionWait
 */

/**
 * @typedef {import('@mariozechner/pi-agent-core').AgentEvent | {type: string, [k: string]: unknown} | {type: 'message_start', message: import('@mariozechner/pi-agent-core').AgentMessage}} EmbeddedPiSubscribeEvent
 */
