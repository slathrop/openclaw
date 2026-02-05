/**
 * Core type definitions for the channel plugin system.
 * @typedef {import('../registry.js').ChatChannelId | (string & {})} ChannelId
 * @typedef {'explicit' | 'implicit' | 'heartbeat'} ChannelOutboundTargetMode
 * @typedef {import('@mariozechner/pi-agent-core').AgentTool} ChannelAgentTool
 * @typedef {(params: {cfg?: import('../../config/config.js').OpenClawConfig}) => ChannelAgentTool[]} ChannelAgentToolFactory
 * @typedef {object} ChannelSetupInput
 * @property {string} [name]
 * @property {string} [token]
 * @property {string} [tokenFile]
 * @property {string} [botToken]
 * @property {string} [appToken]
 * @property {string} [signalNumber]
 * @property {string} [cliPath]
 * @property {string} [dbPath]
 * @property {'imessage' | 'sms' | 'auto'} [service]
 * @property {string} [region]
 * @property {string} [authDir]
 * @property {string} [httpUrl]
 * @property {string} [httpHost]
 * @property {string} [httpPort]
 * @property {string} [webhookPath]
 * @property {string} [webhookUrl]
 * @property {string} [audienceType]
 * @property {string} [audience]
 * @property {boolean} [useEnv]
 * @property {string} [homeserver]
 * @property {string} [userId]
 * @property {string} [accessToken]
 * @property {string} [password]
 * @property {string} [deviceName]
 * @property {number} [initialSyncLimit]
 * @property {string} [ship]
 * @property {string} [url]
 * @property {string} [code]
 * @property {string[]} [groupChannels]
 * @property {string[]} [dmAllowlist]
 * @property {boolean} [autoDiscoverChannels]
 * @typedef {object} ChannelStatusIssue
 * @property {ChannelId} channel
 * @property {string} accountId
 * @property {'intent' | 'permissions' | 'config' | 'auth' | 'runtime'} kind
 * @property {string} message
 * @property {string} [fix]
 * @typedef {'linked' | 'not linked' | 'configured' | 'not configured' | 'enabled' | 'disabled'} ChannelAccountState
 * @typedef {object} ChannelHeartbeatDeps
 * @property {() => Promise<boolean>} [webAuthExists]
 * @property {() => boolean} [hasActiveWebListener]
 * @typedef {object} ChannelMeta
 * @property {ChannelId} id
 * @property {string} label
 * @property {string} selectionLabel
 * @property {string} docsPath
 * @property {string} [docsLabel]
 * @property {string} blurb
 * @property {number} [order]
 * @property {string[]} [aliases]
 * @property {string} [selectionDocsPrefix]
 * @property {boolean} [selectionDocsOmitLabel]
 * @property {string[]} [selectionExtras]
 * @property {string} [detailLabel]
 * @property {string} [systemImage]
 * @property {boolean} [showConfigured]
 * @property {boolean} [quickstartAllowFrom]
 * @property {boolean} [forceAccountBinding]
 * @property {boolean} [preferSessionLookupForAnnounceTarget]
 * @property {string[]} [preferOver]
 * @typedef {object} ChannelAccountSnapshot
 * @property {string} accountId
 * @property {string} [name]
 * @property {boolean} [enabled]
 * @property {boolean} [configured]
 * @property {boolean} [linked]
 * @property {boolean} [running]
 * @property {boolean} [connected]
 * @property {number} [reconnectAttempts]
 * @property {number | null} [lastConnectedAt]
 * @property {string | {at: number, status?: number, error?: string, loggedOut?: boolean} | null} [lastDisconnect]
 * @property {number | null} [lastMessageAt]
 * @property {number | null} [lastEventAt]
 * @property {string | null} [lastError]
 * @property {number | null} [lastStartAt]
 * @property {number | null} [lastStopAt]
 * @property {number | null} [lastInboundAt]
 * @property {number | null} [lastOutboundAt]
 * @property {string} [mode]
 * @property {string} [dmPolicy]
 * @property {string[]} [allowFrom]
 * @property {string} [tokenSource]
 * @property {string} [botTokenSource]
 * @property {string} [appTokenSource]
 * @property {string} [credentialSource]
 * @property {string} [audienceType]
 * @property {string} [audience]
 * @property {string} [webhookPath]
 * @property {string} [webhookUrl]
 * @property {string} [baseUrl]
 * @property {boolean} [allowUnmentionedGroups]
 * @property {string | null} [cliPath]
 * @property {string | null} [dbPath]
 * @property {number | null} [port]
 * @property {unknown} [probe]
 * @property {number | null} [lastProbeAt]
 * @property {unknown} [audit]
 * @property {unknown} [application]
 * @property {unknown} [bot]
 * @typedef {object} ChannelLogSink
 * @property {(msg: string) => void} info
 * @property {(msg: string) => void} warn
 * @property {(msg: string) => void} error
 * @property {(msg: string) => void} [debug]
 * @typedef {object} ChannelGroupContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {string | null} [groupId]
 * @property {string | null} [groupChannel] - Human label for channel-like group conversations
 * @property {string | null} [groupSpace]
 * @property {string | null} [accountId]
 * @property {string | null} [senderId]
 * @property {string | null} [senderName]
 * @property {string | null} [senderUsername]
 * @property {string | null} [senderE164]
 * @typedef {object} ChannelCapabilities
 * @property {Array<import('../chat-type.js').NormalizedChatType | 'thread'>} chatTypes
 * @property {boolean} [polls]
 * @property {boolean} [reactions]
 * @property {boolean} [edit]
 * @property {boolean} [unsend]
 * @property {boolean} [reply]
 * @property {boolean} [effects]
 * @property {boolean} [groupManagement]
 * @property {boolean} [threads]
 * @property {boolean} [media]
 * @property {boolean} [nativeCommands]
 * @property {boolean} [blockStreaming]
 * @typedef {object} ChannelSecurityDmPolicy
 * @property {string} policy
 * @property {Array<string | number> | null} [allowFrom]
 * @property {string} [policyPath]
 * @property {string} allowFromPath
 * @property {string} approveHint
 * @property {(raw: string) => string} [normalizeEntry]
 * @typedef {object} ChannelSecurityContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {string | null} [accountId]
 * @property {*} account
 * @typedef {object} ChannelMentionAdapter
 * @property {(params: {ctx: import('../../auto-reply/templating.js').MsgContext, cfg: import('../../config/config.js').OpenClawConfig | undefined, agentId?: string}) => string[]} [stripPatterns]
 * @property {(params: {text: string, ctx: import('../../auto-reply/templating.js').MsgContext, cfg: import('../../config/config.js').OpenClawConfig | undefined, agentId?: string}) => string} [stripMentions]
 * @typedef {object} ChannelStreamingAdapter
 * @property {{minChars: number, idleMs: number}} [blockStreamingCoalesceDefaults]
 * @typedef {object} ChannelThreadingAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, chatType?: string | null}) => 'off' | 'first' | 'all'} [resolveReplyToMode]
 * @property {boolean} [allowTagsWhenOff]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, context: ChannelThreadingContext, hasRepliedRef?: {value: boolean}}) => ChannelThreadingToolContext | undefined} [buildToolContext]
 * @typedef {object} ChannelThreadingContext
 * @property {string} [Channel]
 * @property {string} [From]
 * @property {string} [To]
 * @property {string} [ChatType]
 * @property {string} [ReplyToId]
 * @property {string} [ReplyToIdFull]
 * @property {string} [ThreadLabel]
 * @property {string | number} [MessageThreadId]
 * @typedef {object} ChannelThreadingToolContext
 * @property {string} [currentChannelId]
 * @property {ChannelId} [currentChannelProvider]
 * @property {string} [currentThreadTs]
 * @property {'off' | 'first' | 'all'} [replyToMode]
 * @property {{value: boolean}} [hasRepliedRef]
 * @property {boolean} [skipCrossContextDecoration] - When true, skip cross-context decoration
 * @typedef {object} ChannelMessagingAdapter
 * @property {(raw: string) => string | undefined} [normalizeTarget]
 * @property {{looksLikeId?: (raw: string, normalized?: string) => boolean, hint?: string}} [targetResolver]
 * @property {(params: {target: string, display?: string, kind?: ChannelDirectoryEntryKind}) => string} [formatTargetDisplay]
 *
 * @typedef {object} ChannelAgentPromptAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null}) => string[]} [messageToolHints]
 *
 * @typedef {'user' | 'group' | 'channel'} ChannelDirectoryEntryKind
 *
 * @typedef {object} ChannelDirectoryEntry
 * @property {ChannelDirectoryEntryKind} kind
 * @property {string} id
 * @property {string} [name]
 * @property {string} [handle]
 * @property {string} [avatarUrl]
 * @property {number} [rank]
 * @property {unknown} [raw]
 *
 * @typedef {import('./message-action-names.js').ChannelMessageActionName} ChannelMessageActionName
 *
 * @typedef {object} ChannelMessageActionContext
 * @property {ChannelId} channel
 * @property {ChannelMessageActionName} action
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {Record<string, unknown>} params
 * @property {string | null} [accountId]
 * @property {{url?: string, token?: string, timeoutMs?: number, clientName: import('../../utils/message-channel.js').GatewayClientName, clientDisplayName?: string, mode: import('../../utils/message-channel.js').GatewayClientMode}} [gateway]
 * @property {ChannelThreadingToolContext} [toolContext]
 * @property {boolean} [dryRun]
 *
 * @typedef {object} ChannelToolSend
 * @property {string} to
 * @property {string | null} [accountId]
 *
 * @typedef {object} ChannelMessageActionAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig}) => ChannelMessageActionName[]} [listActions]
 * @property {(params: {action: ChannelMessageActionName}) => boolean} [supportsAction]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig}) => boolean} [supportsButtons]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig}) => boolean} [supportsCards]
 * @property {(params: {args: Record<string, unknown>}) => ChannelToolSend | null} [extractToolSend]
 * @property {(ctx: ChannelMessageActionContext) => Promise<import('@mariozechner/pi-agent-core').AgentToolResult>} [handleAction]
 *
 * @typedef {object} ChannelPollResult
 * @property {string} messageId
 * @property {string} [toJid]
 * @property {string} [channelId]
 * @property {string} [conversationId]
 * @property {string} [pollId]
 *
 * @typedef {object} ChannelPollContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {string} to
 * @property {import('../../polls.js').PollInput} poll
 * @property {string | null} [accountId]
 */

// This module is type-only; no runtime exports.
