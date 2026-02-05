/**
 * Adapter type definitions for the channel plugin system.
 * @typedef {object} ChannelSetupAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string}) => string} [resolveAccountId]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId: string, name?: string}) => import('../../config/config.js').OpenClawConfig} [applyAccountName]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId: string, input: import('./types.core.js').ChannelSetupInput}) => import('../../config/config.js').OpenClawConfig} applyAccountConfig
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId: string, input: import('./types.core.js').ChannelSetupInput}) => string | null} [validateInput]
 * @typedef {object} ChannelConfigAdapter
 * @property {(cfg: import('../../config/config.js').OpenClawConfig) => string[]} listAccountIds
 * @property {(cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null) => *} resolveAccount
 * @property {(cfg: import('../../config/config.js').OpenClawConfig) => string} [defaultAccountId]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId: string, enabled: boolean}) => import('../../config/config.js').OpenClawConfig} [setAccountEnabled]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId: string}) => import('../../config/config.js').OpenClawConfig} [deleteAccount]
 * @property {(account: *, cfg: import('../../config/config.js').OpenClawConfig) => boolean} [isEnabled]
 * @property {(account: *, cfg: import('../../config/config.js').OpenClawConfig) => string} [disabledReason]
 * @property {(account: *, cfg: import('../../config/config.js').OpenClawConfig) => boolean | Promise<boolean>} [isConfigured]
 * @property {(account: *, cfg: import('../../config/config.js').OpenClawConfig) => string} [unconfiguredReason]
 * @property {(account: *, cfg: import('../../config/config.js').OpenClawConfig) => import('./types.core.js').ChannelAccountSnapshot} [describeAccount]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null}) => string[] | undefined} [resolveAllowFrom]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, allowFrom: Array<string | number>}) => string[]} [formatAllowFrom]
 * @typedef {object} ChannelGroupAdapter
 * @property {(params: import('./types.core.js').ChannelGroupContext) => boolean | undefined} [resolveRequireMention]
 * @property {(params: import('./types.core.js').ChannelGroupContext) => string | undefined} [resolveGroupIntroHint]
 * @property {(params: import('./types.core.js').ChannelGroupContext) => import('../../config/types.tools.js').GroupToolPolicyConfig | undefined} [resolveToolPolicy]
 * @typedef {object} ChannelOutboundContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {string} to
 * @property {string} text
 * @property {string} [mediaUrl]
 * @property {boolean} [gifPlayback]
 * @property {string | null} [replyToId]
 * @property {string | number | null} [threadId]
 * @property {string | null} [accountId]
 * @property {import('../../infra/outbound/deliver.js').OutboundSendDeps} [deps]
 * @typedef {ChannelOutboundContext & {payload: import('../../auto-reply/types.js').ReplyPayload}} ChannelOutboundPayloadContext
 * @typedef {object} ChannelOutboundAdapter
 * @property {'direct' | 'gateway' | 'hybrid'} deliveryMode
 * @property {((text: string, limit: number) => string[]) | null} [chunker]
 * @property {'text' | 'markdown'} [chunkerMode]
 * @property {number} [textChunkLimit]
 * @property {number} [pollMaxOptions]
 * @property {(params: {cfg?: import('../../config/config.js').OpenClawConfig, to?: string, allowFrom?: string[], accountId?: string | null, mode?: import('./types.core.js').ChannelOutboundTargetMode}) => {ok: true, to: string} | {ok: false, error: Error}} [resolveTarget]
 * @property {(ctx: ChannelOutboundPayloadContext) => Promise<import('../../infra/outbound/deliver.js').OutboundDeliveryResult>} [sendPayload]
 * @property {(ctx: ChannelOutboundContext) => Promise<import('../../infra/outbound/deliver.js').OutboundDeliveryResult>} [sendText]
 * @property {(ctx: ChannelOutboundContext) => Promise<import('../../infra/outbound/deliver.js').OutboundDeliveryResult>} [sendMedia]
 * @property {(ctx: import('./types.core.js').ChannelPollContext) => Promise<import('./types.core.js').ChannelPollResult>} [sendPoll]
 * @typedef {object} ChannelStatusAdapter
 * @property {import('./types.core.js').ChannelAccountSnapshot} [defaultRuntime]
 * @property {(params: {account: *, cfg: import('../../config/config.js').OpenClawConfig, defaultAccountId: string, snapshot: import('./types.core.js').ChannelAccountSnapshot}) => Record<string, unknown> | Promise<Record<string, unknown>>} [buildChannelSummary]
 * @property {(params: {account: *, timeoutMs: number, cfg: import('../../config/config.js').OpenClawConfig}) => Promise<*>} [probeAccount]
 * @property {(params: {account: *, timeoutMs: number, cfg: import('../../config/config.js').OpenClawConfig, probe?: *}) => Promise<*>} [auditAccount]
 * @property {(params: {account: *, cfg: import('../../config/config.js').OpenClawConfig, runtime?: import('./types.core.js').ChannelAccountSnapshot, probe?: *, audit?: *}) => import('./types.core.js').ChannelAccountSnapshot | Promise<import('./types.core.js').ChannelAccountSnapshot>} [buildAccountSnapshot]
 * @property {(params: {account: *, cfg: import('../../config/config.js').OpenClawConfig, runtime: import('../../runtime.js').RuntimeEnv, includeChannelPrefix?: boolean}) => void} [logSelfId]
 * @property {(params: {account: *, cfg: import('../../config/config.js').OpenClawConfig, configured: boolean, enabled: boolean}) => import('./types.core.js').ChannelAccountState} [resolveAccountState]
 * @property {(accounts: import('./types.core.js').ChannelAccountSnapshot[]) => import('./types.core.js').ChannelStatusIssue[]} [collectStatusIssues]
 * @typedef {object} ChannelGatewayContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {string} accountId
 * @property {*} account
 * @property {import('../../runtime.js').RuntimeEnv} runtime
 * @property {AbortSignal} abortSignal
 * @property {import('./types.core.js').ChannelLogSink} [log]
 * @property {() => import('./types.core.js').ChannelAccountSnapshot} getStatus
 * @property {(next: import('./types.core.js').ChannelAccountSnapshot) => void} setStatus
 * @typedef {object} ChannelLogoutResult
 * @property {boolean} cleared
 * @property {boolean} [loggedOut]
 * @typedef {object} ChannelLoginWithQrStartResult
 * @property {string} [qrDataUrl]
 * @property {string} message
 * @typedef {object} ChannelLoginWithQrWaitResult
 * @property {boolean} connected
 * @property {string} message
 * @typedef {object} ChannelLogoutContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {string} accountId
 * @property {*} account
 * @property {import('../../runtime.js').RuntimeEnv} runtime
 * @property {import('./types.core.js').ChannelLogSink} [log]
 * @typedef {object} ChannelPairingAdapter
 * @property {string} idLabel
 * @property {(entry: string) => string} [normalizeAllowEntry]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, id: string, runtime?: import('../../runtime.js').RuntimeEnv}) => Promise<void>} [notifyApproval]
 * @typedef {object} ChannelGatewayAdapter
 * @property {(ctx: ChannelGatewayContext) => Promise<unknown>} [startAccount]
 * @property {(ctx: ChannelGatewayContext) => Promise<void>} [stopAccount]
 * @property {(params: {accountId?: string, force?: boolean, timeoutMs?: number, verbose?: boolean}) => Promise<ChannelLoginWithQrStartResult>} [loginWithQrStart]
 * @property {(params: {accountId?: string, timeoutMs?: number}) => Promise<ChannelLoginWithQrWaitResult>} [loginWithQrWait]
 * @property {(ctx: ChannelLogoutContext) => Promise<ChannelLogoutResult>} [logoutAccount]
 * @typedef {object} ChannelAuthAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, runtime: import('../../runtime.js').RuntimeEnv, verbose?: boolean, channelInput?: string | null}) => Promise<void>} [login]
 * @typedef {object} ChannelHeartbeatAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, deps?: import('./types.core.js').ChannelHeartbeatDeps}) => Promise<{ok: boolean, reason: string}>} [checkReady]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, opts?: {to?: string, all?: boolean}}) => {recipients: string[], source: string}} [resolveRecipients]
 * @typedef {object} ChannelDirectoryAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, runtime: import('../../runtime.js').RuntimeEnv}) => Promise<import('./types.core.js').ChannelDirectoryEntry | null>} [self]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, query?: string | null, limit?: number | null, runtime: import('../../runtime.js').RuntimeEnv}) => Promise<import('./types.core.js').ChannelDirectoryEntry[]>} [listPeers]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, query?: string | null, limit?: number | null, runtime: import('../../runtime.js').RuntimeEnv}) => Promise<import('./types.core.js').ChannelDirectoryEntry[]>} [listPeersLive]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, query?: string | null, limit?: number | null, runtime: import('../../runtime.js').RuntimeEnv}) => Promise<import('./types.core.js').ChannelDirectoryEntry[]>} [listGroups]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, query?: string | null, limit?: number | null, runtime: import('../../runtime.js').RuntimeEnv}) => Promise<import('./types.core.js').ChannelDirectoryEntry[]>} [listGroupsLive]
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, groupId: string, limit?: number | null, runtime: import('../../runtime.js').RuntimeEnv}) => Promise<import('./types.core.js').ChannelDirectoryEntry[]>} [listGroupMembers]
 * @typedef {'user' | 'group'} ChannelResolveKind
 * @typedef {object} ChannelResolveResult
 * @property {string} input
 * @property {boolean} resolved
 * @property {string} [id]
 * @property {string} [name]
 * @property {string} [note]
 * @typedef {object} ChannelResolverAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null, inputs: string[], kind: ChannelResolveKind, runtime: import('../../runtime.js').RuntimeEnv}) => Promise<ChannelResolveResult[]>} resolveTargets
 * @typedef {object} ChannelElevatedAdapter
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, accountId?: string | null}) => Array<string | number> | undefined} [allowFromFallback]
 *
 * @typedef {object} ChannelCommandAdapter
 * @property {boolean} [enforceOwnerForCommands]
 * @property {boolean} [skipWhenConfigEmpty]
 *
 * @typedef {object} ChannelSecurityAdapter
 * @property {(ctx: import('./types.core.js').ChannelSecurityContext) => import('./types.core.js').ChannelSecurityDmPolicy | null} [resolveDmPolicy]
 * @property {(ctx: import('./types.core.js').ChannelSecurityContext) => Promise<string[]> | string[]} [collectWarnings]
 */

// This module is type-only; no runtime exports.
