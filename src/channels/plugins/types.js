/**
 * Channel plugin types barrel.
 * Re-exports all type definitions from core, adapters, and plugin modules,
 * plus the runtime CHANNEL_MESSAGE_ACTION_NAMES constant.
 * @typedef {import('./message-action-names.js').ChannelMessageActionName} ChannelMessageActionName
 *
 * Re-exported from types.adapters.js:
 * @typedef {import('./types.adapters.js').ChannelAuthAdapter} ChannelAuthAdapter
 * @typedef {import('./types.adapters.js').ChannelCommandAdapter} ChannelCommandAdapter
 * @typedef {import('./types.adapters.js').ChannelConfigAdapter} ChannelConfigAdapter
 * @typedef {import('./types.adapters.js').ChannelDirectoryAdapter} ChannelDirectoryAdapter
 * @typedef {import('./types.adapters.js').ChannelResolveKind} ChannelResolveKind
 * @typedef {import('./types.adapters.js').ChannelResolveResult} ChannelResolveResult
 * @typedef {import('./types.adapters.js').ChannelResolverAdapter} ChannelResolverAdapter
 * @typedef {import('./types.adapters.js').ChannelElevatedAdapter} ChannelElevatedAdapter
 * @typedef {import('./types.adapters.js').ChannelGatewayAdapter} ChannelGatewayAdapter
 * @typedef {import('./types.adapters.js').ChannelGatewayContext} ChannelGatewayContext
 * @typedef {import('./types.adapters.js').ChannelGroupAdapter} ChannelGroupAdapter
 * @typedef {import('./types.adapters.js').ChannelHeartbeatAdapter} ChannelHeartbeatAdapter
 * @typedef {import('./types.adapters.js').ChannelLoginWithQrStartResult} ChannelLoginWithQrStartResult
 * @typedef {import('./types.adapters.js').ChannelLoginWithQrWaitResult} ChannelLoginWithQrWaitResult
 * @typedef {import('./types.adapters.js').ChannelLogoutContext} ChannelLogoutContext
 * @typedef {import('./types.adapters.js').ChannelLogoutResult} ChannelLogoutResult
 * @typedef {import('./types.adapters.js').ChannelOutboundAdapter} ChannelOutboundAdapter
 * @typedef {import('./types.adapters.js').ChannelOutboundContext} ChannelOutboundContext
 * @typedef {import('./types.adapters.js').ChannelPairingAdapter} ChannelPairingAdapter
 * @typedef {import('./types.adapters.js').ChannelSecurityAdapter} ChannelSecurityAdapter
 * @typedef {import('./types.adapters.js').ChannelSetupAdapter} ChannelSetupAdapter
 * @typedef {import('./types.adapters.js').ChannelStatusAdapter} ChannelStatusAdapter
 *
 * Re-exported from types.core.js:
 * @typedef {import('./types.core.js').ChannelAccountSnapshot} ChannelAccountSnapshot
 * @typedef {import('./types.core.js').ChannelAccountState} ChannelAccountState
 * @typedef {import('./types.core.js').ChannelAgentPromptAdapter} ChannelAgentPromptAdapter
 * @typedef {import('./types.core.js').ChannelAgentTool} ChannelAgentTool
 * @typedef {import('./types.core.js').ChannelAgentToolFactory} ChannelAgentToolFactory
 * @typedef {import('./types.core.js').ChannelCapabilities} ChannelCapabilities
 * @typedef {import('./types.core.js').ChannelDirectoryEntry} ChannelDirectoryEntry
 * @typedef {import('./types.core.js').ChannelDirectoryEntryKind} ChannelDirectoryEntryKind
 * @typedef {import('./types.core.js').ChannelGroupContext} ChannelGroupContext
 * @typedef {import('./types.core.js').ChannelHeartbeatDeps} ChannelHeartbeatDeps
 * @typedef {import('./types.core.js').ChannelId} ChannelId
 * @typedef {import('./types.core.js').ChannelLogSink} ChannelLogSink
 * @typedef {import('./types.core.js').ChannelMentionAdapter} ChannelMentionAdapter
 * @typedef {import('./types.core.js').ChannelMessageActionAdapter} ChannelMessageActionAdapter
 * @typedef {import('./types.core.js').ChannelMessageActionContext} ChannelMessageActionContext
 * @typedef {import('./types.core.js').ChannelMessagingAdapter} ChannelMessagingAdapter
 * @typedef {import('./types.core.js').ChannelMeta} ChannelMeta
 * @typedef {import('./types.core.js').ChannelOutboundTargetMode} ChannelOutboundTargetMode
 * @typedef {import('./types.core.js').ChannelPollContext} ChannelPollContext
 * @typedef {import('./types.core.js').ChannelPollResult} ChannelPollResult
 * @typedef {import('./types.core.js').ChannelSecurityContext} ChannelSecurityContext
 * @typedef {import('./types.core.js').ChannelSecurityDmPolicy} ChannelSecurityDmPolicy
 * @typedef {import('./types.core.js').ChannelSetupInput} ChannelSetupInput
 * @typedef {import('./types.core.js').ChannelStatusIssue} ChannelStatusIssue
 * @typedef {import('./types.core.js').ChannelStreamingAdapter} ChannelStreamingAdapter
 * @typedef {import('./types.core.js').ChannelThreadingAdapter} ChannelThreadingAdapter
 * @typedef {import('./types.core.js').ChannelThreadingContext} ChannelThreadingContext
 * @typedef {import('./types.core.js').ChannelThreadingToolContext} ChannelThreadingToolContext
 * @typedef {import('./types.core.js').ChannelToolSend} ChannelToolSend
 *
 * Re-exported from types.plugin.js:
 * @typedef {import('./types.plugin.js').ChannelPlugin} ChannelPlugin
 */

// Runtime re-export (must be preserved)
export { CHANNEL_MESSAGE_ACTION_NAMES } from './message-action-names.js';
