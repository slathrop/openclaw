/**
 * @module pi-embedded-runner/run/types
 * Type definitions for embedded Pi agent run attempt parameters and results.
 */

/**
 * @typedef {object} EmbeddedRunAttemptParams
 * @property {string} sessionId
 * @property {string} [sessionKey]
 * @property {string} [messageChannel]
 * @property {string} [messageProvider]
 * @property {string} [agentAccountId]
 * @property {string} [messageTo]
 * @property {string|number} [messageThreadId]
 * @property {string|null} [groupId] - Group id for channel-level tool policy resolution.
 * @property {string|null} [groupChannel] - Group channel label (e.g. #general).
 * @property {string|null} [groupSpace] - Group space label (e.g. guild/team id).
 * @property {string|null} [spawnedBy] - Parent session key for subagent policy inheritance.
 * @property {string|null} [senderId]
 * @property {string|null} [senderName]
 * @property {string|null} [senderUsername]
 * @property {string|null} [senderE164]
 * @property {string} [currentChannelId]
 * @property {string} [currentThreadTs]
 * @property {"off"|"first"|"all"} [replyToMode]
 * @property {{value: boolean}} [hasRepliedRef]
 * @property {string} sessionFile
 * @property {string} workspaceDir
 * @property {string} [agentDir]
 * @property {object} [config]
 * @property {object} [skillsSnapshot]
 * @property {string} prompt
 * @property {Array<*>} [images]
 * @property {Array<ClientToolDefinition>} [clientTools] - Optional client-provided tools.
 * @property {boolean} [disableTools] - Disable built-in tools for this run.
 * @property {string} provider
 * @property {string} modelId
 * @property {*} model
 * @property {*} authStorage
 * @property {*} modelRegistry
 * @property {*} thinkLevel
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
 * @property {boolean} [requireExplicitMessageTarget]
 * @property {boolean} [disableMessageTool]
 * @property {string} [extraSystemPrompt]
 * @property {object} [streamParams]
 * @property {string[]} [ownerNumbers]
 * @property {boolean} [enforceFinalTag]
 */

/**
 * @typedef {object} EmbeddedRunAttemptResult
 * @property {boolean} aborted
 * @property {boolean} timedOut
 * @property {*} promptError
 * @property {string} sessionIdUsed
 * @property {object} [systemPromptReport]
 * @property {Array<*>} messagesSnapshot
 * @property {string[]} assistantTexts
 * @property {Array<{toolName: string, meta?: string}>} toolMetas
 * @property {*} lastAssistant
 * @property {object} [lastToolError]
 * @property {boolean} didSendViaMessagingTool
 * @property {string[]} messagingToolSentTexts
 * @property {Array<*>} messagingToolSentTargets
 * @property {boolean} cloudCodeAssistFormatError
 * @property {object} [clientToolCall] - Client tool call detected.
 */
