/**
 * Channel plugin contract type definition.
 * @typedef {object} ChannelConfigUiHint
 * @property {string} [label]
 * @property {string} [help]
 * @property {boolean} [advanced]
 * @property {boolean} [sensitive]
 * @property {string} [placeholder]
 * @property {unknown} [itemTemplate]
 * @typedef {object} ChannelConfigSchema
 * @property {Record<string, unknown>} schema
 * @property {Record<string, ChannelConfigUiHint>} [uiHints]
 * @typedef {object} ChannelPlugin
 * @property {import('./types.core.js').ChannelId} id
 * @property {import('./types.core.js').ChannelMeta} meta
 * @property {import('./types.core.js').ChannelCapabilities} capabilities
 * @property {{queue?: {debounceMs?: number}}} [defaults]
 * @property {{configPrefixes: string[], noopPrefixes?: string[]}} [reload]
 * @property {import('./onboarding-types.js').ChannelOnboardingAdapter} [onboarding]
 * @property {import('./types.adapters.js').ChannelConfigAdapter} config
 * @property {ChannelConfigSchema} [configSchema]
 * @property {import('./types.adapters.js').ChannelSetupAdapter} [setup]
 * @property {import('./types.adapters.js').ChannelPairingAdapter} [pairing]
 * @property {import('./types.adapters.js').ChannelSecurityAdapter} [security]
 * @property {import('./types.adapters.js').ChannelGroupAdapter} [groups]
 * @property {import('./types.core.js').ChannelMentionAdapter} [mentions]
 * @property {import('./types.adapters.js').ChannelOutboundAdapter} [outbound]
 * @property {import('./types.adapters.js').ChannelStatusAdapter} [status]
 * @property {string[]} [gatewayMethods]
 * @property {import('./types.adapters.js').ChannelGatewayAdapter} [gateway]
 * @property {import('./types.adapters.js').ChannelAuthAdapter} [auth]
 * @property {import('./types.adapters.js').ChannelElevatedAdapter} [elevated]
 * @property {import('./types.adapters.js').ChannelCommandAdapter} [commands]
 * @property {import('./types.core.js').ChannelStreamingAdapter} [streaming]
 * @property {import('./types.core.js').ChannelThreadingAdapter} [threading]
 * @property {import('./types.core.js').ChannelMessagingAdapter} [messaging]
 * @property {import('./types.core.js').ChannelAgentPromptAdapter} [agentPrompt]
 * @property {import('./types.adapters.js').ChannelDirectoryAdapter} [directory]
 * @property {import('./types.adapters.js').ChannelResolverAdapter} [resolver]
 * @property {import('./types.core.js').ChannelMessageActionAdapter} [actions]
 * @property {import('./types.adapters.js').ChannelHeartbeatAdapter} [heartbeat]
 * @property {import('./types.core.js').ChannelAgentToolFactory | import('./types.core.js').ChannelAgentTool[]} [agentTools]
 */

// This module is type-only; no runtime exports.
