/**
 * @module pi-embedded-runner/run/params
 * Type definitions for RunEmbeddedPiAgent parameters.
 */

/**
 * Simplified tool definition for client-provided tools (OpenResponses hosted tools).
 * @typedef {object} ClientToolDefinition
 * @property {"function"} type
 * @property {object} function
 * @property {string} function.name
 * @property {string} [function.description]
 * @property {Record<string, *>} [function.parameters]
 */

/**
 * @typedef {object} RunEmbeddedPiAgentParams
 * @property {string} sessionId
 * @property {string} [sessionKey]
 * @property {string} [messageChannel]
 * @property {string} [messageProvider]
 * @property {string} [agentAccountId]
 * @property {string} [messageTo] - Delivery target for topic/thread routing.
 * @property {string|number} [messageThreadId] - Thread/topic identifier.
 * @property {string|null} [groupId] - Group id for channel-level tool policy resolution.
 * @property {string|null} [groupChannel] - Group channel label.
 * @property {string|null} [groupSpace] - Group space label.
 * @property {string|null} [spawnedBy] - Parent session key for subagent policy inheritance.
 * @property {string|null} [senderId]
 * @property {string|null} [senderName]
 * @property {string|null} [senderUsername]
 * @property {string|null} [senderE164]
 * @property {string} [currentChannelId]
 * @property {string} [currentThreadTs]
 * @property {"off"|"first"|"all"} [replyToMode]
 * @property {{value: boolean}} [hasRepliedRef]
 * @property {boolean} [requireExplicitMessageTarget]
 * @property {boolean} [disableMessageTool]
 * @property {string} sessionFile
 * @property {string} workspaceDir
 * @property {string} [agentDir]
 * @property {object} [config]
 * @property {object} [skillsSnapshot]
 * @property {string} prompt
 * @property {Array<*>} [images]
 * @property {Array<ClientToolDefinition>} [clientTools]
 * @property {boolean} [disableTools]
 * @property {string} [provider]
 * @property {string} [model]
 * @property {string} [authProfileId]
 * @property {"auto"|"user"} [authProfileIdSource]
 * @property {*} [thinkLevel]
 * @property {*} [verboseLevel]
 * @property {*} [reasoningLevel]
 * @property {*} [toolResultFormat]
 * @property {object} [execOverrides]
 * @property {object} [bashElevated]
 * @property {number} timeoutMs
 * @property {string} runId
 * @property {AbortSignal} [abortSignal]
 * @property {Function} [shouldEmitToolResult]
 * @property {Function} [shouldEmitToolOutput]
 * @property {Function} [onPartialReply]
 * @property {Function} [onAssistantMessageStart]
 * @property {Function} [onBlockReply]
 * @property {Function} [onBlockReplyFlush]
 * @property {"text_end"|"message_end"} [blockReplyBreak]
 * @property {*} [blockReplyChunking]
 * @property {Function} [onReasoningStream]
 * @property {Function} [onToolResult]
 * @property {Function} [onAgentEvent]
 * @property {string} [lane]
 * @property {Function} [enqueue]
 * @property {string} [extraSystemPrompt]
 * @property {object} [streamParams]
 * @property {string[]} [ownerNumbers]
 * @property {boolean} [enforceFinalTag]
 */
