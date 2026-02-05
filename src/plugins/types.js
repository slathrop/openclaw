/** @module plugins/types - Type definitions for the plugin system. */

/**
 * @typedef {object} PluginLogger
 * @property {Function} [debug] - Debug log.
 * @property {Function} info - Info log.
 * @property {Function} warn - Warning log.
 * @property {Function} error - Error log.
 */

/**
 * @typedef {object} PluginConfigUiHint
 * @property {string} [label] - Display label.
 * @property {string} [help] - Help text.
 * @property {boolean} [advanced] - Whether this is an advanced setting.
 * @property {boolean} [sensitive] - Whether the value is sensitive.
 * @property {string} [placeholder] - Input placeholder.
 */

/** @typedef {'memory'} PluginKind */

/**
 * @typedef {object} PluginConfigValidation
 * @property {boolean} ok - Whether validation passed.
 * @property {*} [value] - Validated value (when ok).
 * @property {string[]} [errors] - Validation errors (when not ok).
 */

/**
 * @typedef {object} OpenClawPluginConfigSchema
 * @property {Function} [safeParse] - Zod-compatible safeParse.
 * @property {Function} [parse] - Strict parse.
 * @property {Function} [validate] - Custom validation.
 * @property {{[key: string]: PluginConfigUiHint}} [uiHints] - UI hints per field.
 * @property {{[key: string]: *}} [jsonSchema] - JSON Schema definition.
 */

/**
 * @typedef {object} OpenClawPluginToolContext
 * @property {*} [config] - OpenClaw config.
 * @property {string} [workspaceDir] - Workspace directory.
 * @property {string} [agentDir] - Agent directory.
 * @property {string} [agentId] - Agent identifier.
 * @property {string} [sessionKey] - Session key.
 * @property {string} [messageChannel] - Message channel.
 * @property {string} [agentAccountId] - Agent account ID.
 * @property {boolean} [sandboxed] - Whether agent is sandboxed.
 */

/**
 * @typedef {Function} OpenClawPluginToolFactory
 * @param {OpenClawPluginToolContext} ctx - Tool context.
 * @returns {*} Tool instance(s) or null.
 */

/**
 * @typedef {object} OpenClawPluginToolOptions
 * @property {string} [name] - Single tool name.
 * @property {string[]} [names] - Multiple tool names.
 * @property {boolean} [optional] - Whether tool is optional.
 */

/**
 * @typedef {object} OpenClawPluginHookOptions
 * @property {*} [entry] - Hook entry.
 * @property {string} [name] - Hook name.
 * @property {string} [description] - Hook description.
 * @property {boolean} [register] - Whether to register.
 */

/**
 * @typedef {'oauth' | 'api_key' | 'token' | 'device_code' | 'custom'} ProviderAuthKind
 */

/**
 * @typedef {object} ProviderAuthResult
 * @property {Array<{profileId: string, credential: *}>} profiles - Auth profiles.
 * @property {*} [configPatch] - Config patch to apply.
 * @property {string} [defaultModel] - Default model name.
 * @property {string[]} [notes] - Notes for the user.
 */

/**
 * @typedef {object} ProviderAuthContext
 * @property {*} config - OpenClaw config.
 * @property {string} [agentDir] - Agent directory.
 * @property {string} [workspaceDir] - Workspace directory.
 * @property {*} prompter - Wizard prompter.
 * @property {*} runtime - Runtime environment.
 * @property {boolean} isRemote - Whether running remotely.
 * @property {Function} openUrl - URL opener.
 * @property {object} oauth - OAuth helpers.
 */

/**
 * @typedef {object} ProviderAuthMethod
 * @property {string} id - Method identifier.
 * @property {string} label - Display label.
 * @property {string} [hint] - Hint text.
 * @property {ProviderAuthKind} kind - Auth kind.
 * @property {Function} run - Run authentication.
 */

/**
 * @typedef {object} ProviderPlugin
 * @property {string} id - Provider identifier.
 * @property {string} label - Display label.
 * @property {string} [docsPath] - Documentation path.
 * @property {string[]} [aliases] - Provider aliases.
 * @property {string[]} [envVars] - Environment variables.
 * @property {*} [models] - Model provider config.
 * @property {ProviderAuthMethod[]} auth - Auth methods.
 * @property {Function} [formatApiKey] - API key formatter.
 * @property {Function} [refreshOAuth] - OAuth refresh handler.
 */

/**
 * @typedef {object} OpenClawPluginGatewayMethod
 * @property {string} method - Method name.
 * @property {Function} handler - Request handler.
 */

/**
 * @typedef {object} PluginCommandContext
 * @property {string} [senderId] - Sender identifier.
 * @property {string} channel - Channel name.
 * @property {boolean} isAuthorizedSender - Whether sender is authorized.
 * @property {string} [args] - Command arguments.
 * @property {string} commandBody - Full command body.
 * @property {*} config - OpenClaw config.
 */

/** @typedef {*} PluginCommandResult */

/**
 * @typedef {Function} PluginCommandHandler
 * @param {PluginCommandContext} ctx - Command context.
 * @returns {PluginCommandResult | Promise<PluginCommandResult>} Result.
 */

/**
 * @typedef {object} OpenClawPluginCommandDefinition
 * @property {string} name - Command name without leading slash.
 * @property {string} description - Command description.
 * @property {boolean} [acceptsArgs] - Whether command accepts arguments.
 * @property {boolean} [requireAuth] - Whether auth is required (default: true).
 * @property {PluginCommandHandler} handler - Handler function.
 */

/**
 * @typedef {Function} OpenClawPluginHttpHandler
 * @param {*} req - HTTP request.
 * @param {*} res - HTTP response.
 * @returns {Promise<boolean> | boolean} Whether handled.
 */

/**
 * @typedef {Function} OpenClawPluginHttpRouteHandler
 * @param {*} req - HTTP request.
 * @param {*} res - HTTP response.
 * @returns {Promise<void> | void}
 */

/**
 * @typedef {object} OpenClawPluginCliContext
 * @property {*} program - Commander program.
 * @property {*} config - OpenClaw config.
 * @property {string} [workspaceDir] - Workspace directory.
 * @property {PluginLogger} logger - Logger.
 */

/** @typedef {Function} OpenClawPluginCliRegistrar */

/**
 * @typedef {object} OpenClawPluginServiceContext
 * @property {*} config - OpenClaw config.
 * @property {string} [workspaceDir] - Workspace directory.
 * @property {string} stateDir - State directory.
 * @property {PluginLogger} logger - Logger.
 */

/**
 * @typedef {object} OpenClawPluginService
 * @property {string} id - Service identifier.
 * @property {Function} start - Start the service.
 * @property {Function} [stop] - Stop the service.
 */

/**
 * @typedef {object} OpenClawPluginChannelRegistration
 * @property {*} plugin - Channel plugin.
 * @property {*} [dock] - Channel dock.
 */

/**
 * @typedef {object} OpenClawPluginDefinition
 * @property {string} [id] - Plugin identifier.
 * @property {string} [name] - Plugin name.
 * @property {string} [description] - Plugin description.
 * @property {string} [version] - Plugin version.
 * @property {PluginKind} [kind] - Plugin kind.
 * @property {OpenClawPluginConfigSchema} [configSchema] - Config schema.
 * @property {Function} [register] - Registration callback.
 * @property {Function} [activate] - Activation callback.
 */

/**
 * @typedef {OpenClawPluginDefinition | Function} OpenClawPluginModule
 */

/**
 * @typedef {object} OpenClawPluginApi
 * @property {string} id - Plugin ID.
 * @property {string} name - Plugin name.
 * @property {string} [version] - Plugin version.
 * @property {string} [description] - Plugin description.
 * @property {string} source - Plugin source path.
 * @property {*} config - OpenClaw config.
 * @property {{[key: string]: *}} [pluginConfig] - Plugin-specific config.
 * @property {*} runtime - Plugin runtime.
 * @property {PluginLogger} logger - Logger.
 * @property {Function} registerTool - Register a tool.
 * @property {Function} registerHook - Register a hook.
 * @property {Function} registerHttpHandler - Register HTTP handler.
 * @property {Function} registerHttpRoute - Register HTTP route.
 * @property {Function} registerChannel - Register a channel.
 * @property {Function} registerGatewayMethod - Register gateway method.
 * @property {Function} registerCli - Register CLI commands.
 * @property {Function} registerService - Register a service.
 * @property {Function} registerProvider - Register a provider.
 * @property {Function} registerCommand - Register a command.
 * @property {Function} resolvePath - Resolve a path.
 * @property {Function} on - Register lifecycle hook handler.
 */

/** @typedef {'bundled' | 'global' | 'workspace' | 'config'} PluginOrigin */

/**
 * @typedef {object} PluginDiagnostic
 * @property {'warn' | 'error'} level - Diagnostic level.
 * @property {string} message - Diagnostic message.
 * @property {string} [pluginId] - Plugin identifier.
 * @property {string} [source] - Source path.
 */

/**
 * @typedef {'before_agent_start' | 'agent_end' | 'before_compaction' | 'after_compaction' | 'message_received' | 'message_sending' | 'message_sent' | 'before_tool_call' | 'after_tool_call' | 'tool_result_persist' | 'session_start' | 'session_end' | 'gateway_start' | 'gateway_stop'} PluginHookName
 */

/**
 * @typedef {object} PluginHookAgentContext
 * @property {string} [agentId] - Agent identifier.
 * @property {string} [sessionKey] - Session key.
 * @property {string} [workspaceDir] - Workspace directory.
 * @property {string} [messageProvider] - Message provider.
 */

/**
 * @typedef {object} PluginHookBeforeAgentStartEvent
 * @property {string} prompt - System prompt.
 * @property {Array} [messages] - Messages.
 */

/**
 * @typedef {object} PluginHookBeforeAgentStartResult
 * @property {string} [systemPrompt] - Modified system prompt.
 * @property {string} [prependContext] - Context to prepend.
 */

/**
 * @typedef {object} PluginHookAgentEndEvent
 * @property {Array} messages - Messages.
 * @property {boolean} success - Whether agent succeeded.
 * @property {string} [error] - Error message.
 * @property {number} [durationMs] - Duration in milliseconds.
 */

/**
 * @typedef {object} PluginHookBeforeCompactionEvent
 * @property {number} messageCount - Message count.
 * @property {number} [tokenCount] - Token count.
 */

/**
 * @typedef {object} PluginHookAfterCompactionEvent
 * @property {number} messageCount - Message count.
 * @property {number} [tokenCount] - Token count.
 * @property {number} compactedCount - Compacted count.
 */

/**
 * @typedef {object} PluginHookMessageContext
 * @property {string} channelId - Channel identifier.
 * @property {string} [accountId] - Account identifier.
 * @property {string} [conversationId] - Conversation identifier.
 */

/**
 * @typedef {object} PluginHookMessageReceivedEvent
 * @property {string} from - Sender.
 * @property {string} content - Message content.
 * @property {number} [timestamp] - Timestamp.
 * @property {{[key: string]: *}} [metadata] - Metadata.
 */

/**
 * @typedef {object} PluginHookMessageSendingEvent
 * @property {string} to - Recipient.
 * @property {string} content - Message content.
 * @property {{[key: string]: *}} [metadata] - Metadata.
 */

/**
 * @typedef {object} PluginHookMessageSendingResult
 * @property {string} [content] - Modified content.
 * @property {boolean} [cancel] - Whether to cancel sending.
 */

/**
 * @typedef {object} PluginHookMessageSentEvent
 * @property {string} to - Recipient.
 * @property {string} content - Message content.
 * @property {boolean} success - Whether send succeeded.
 * @property {string} [error] - Error message.
 */

/**
 * @typedef {object} PluginHookToolContext
 * @property {string} [agentId] - Agent identifier.
 * @property {string} [sessionKey] - Session key.
 * @property {string} toolName - Tool name.
 */

/**
 * @typedef {object} PluginHookBeforeToolCallEvent
 * @property {string} toolName - Tool name.
 * @property {{[key: string]: *}} params - Tool parameters.
 */

/**
 * @typedef {object} PluginHookBeforeToolCallResult
 * @property {{[key: string]: *}} [params] - Modified parameters.
 * @property {boolean} [block] - Whether to block the call.
 * @property {string} [blockReason] - Block reason.
 */

/**
 * @typedef {object} PluginHookAfterToolCallEvent
 * @property {string} toolName - Tool name.
 * @property {{[key: string]: *}} params - Tool parameters.
 * @property {*} [result] - Tool result.
 * @property {string} [error] - Error message.
 * @property {number} [durationMs] - Duration in milliseconds.
 */

/**
 * @typedef {object} PluginHookToolResultPersistContext
 * @property {string} [agentId] - Agent identifier.
 * @property {string} [sessionKey] - Session key.
 * @property {string} [toolName] - Tool name.
 * @property {string} [toolCallId] - Tool call identifier.
 */

/**
 * @typedef {object} PluginHookToolResultPersistEvent
 * @property {string} [toolName] - Tool name.
 * @property {string} [toolCallId] - Tool call identifier.
 * @property {*} message - Agent message to persist.
 * @property {boolean} [isSynthetic] - Whether synthesized by guard/repair.
 */

/**
 * @typedef {object} PluginHookToolResultPersistResult
 * @property {*} [message] - Modified message.
 */

/**
 * @typedef {object} PluginHookSessionContext
 * @property {string} [agentId] - Agent identifier.
 * @property {string} sessionId - Session identifier.
 */

/**
 * @typedef {object} PluginHookSessionStartEvent
 * @property {string} sessionId - Session identifier.
 * @property {string} [resumedFrom] - Resumed from session.
 */

/**
 * @typedef {object} PluginHookSessionEndEvent
 * @property {string} sessionId - Session identifier.
 * @property {number} messageCount - Message count.
 * @property {number} [durationMs] - Duration in milliseconds.
 */

/**
 * @typedef {object} PluginHookGatewayContext
 * @property {number} [port] - Gateway port.
 */

/**
 * @typedef {object} PluginHookGatewayStartEvent
 * @property {number} port - Gateway port.
 */

/**
 * @typedef {object} PluginHookGatewayStopEvent
 * @property {string} [reason] - Stop reason.
 */

/**
 * @typedef {{[key: string]: Function}} PluginHookHandlerMap
 */

/**
 * @typedef {object} PluginHookRegistration
 * @property {string} pluginId - Plugin identifier.
 * @property {PluginHookName} hookName - Hook name.
 * @property {Function} handler - Hook handler.
 * @property {number} [priority] - Handler priority.
 * @property {string} source - Source path.
 */
