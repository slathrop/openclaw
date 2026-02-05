/**
 * Onboarding type definitions for the channel plugin system.
 * @typedef {object} SetupChannelsOptions
 * @property {boolean} [allowDisable]
 * @property {boolean} [allowSignalInstall]
 * @property {(selection: import('./types.core.js').ChannelId[]) => void} [onSelection]
 * @property {Partial<Record<import('./types.core.js').ChannelId, string>>} [accountIds]
 * @property {(channel: import('./types.core.js').ChannelId, accountId: string) => void} [onAccountId]
 * @property {boolean} [promptAccountIds]
 * @property {string} [whatsappAccountId]
 * @property {boolean} [promptWhatsAppAccountId]
 * @property {(accountId: string) => void} [onWhatsAppAccountId]
 * @property {import('./types.core.js').ChannelId[]} [forceAllowFromChannels]
 * @property {boolean} [skipStatusNote]
 * @property {boolean} [skipDmPolicyPrompt]
 * @property {boolean} [skipConfirm]
 * @property {boolean} [quickstartDefaults]
 * @property {import('./types.core.js').ChannelId[]} [initialSelection]
 * @typedef {object} PromptAccountIdParams
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {import('../../wizard/prompts.js').WizardPrompter} prompter
 * @property {string} label
 * @property {string} [currentId]
 * @property {(cfg: import('../../config/config.js').OpenClawConfig) => string[]} listAccountIds
 * @property {string} defaultAccountId
 * @typedef {(params: PromptAccountIdParams) => Promise<string>} PromptAccountId
 * @typedef {object} ChannelOnboardingStatus
 * @property {import('./types.core.js').ChannelId} channel
 * @property {boolean} configured
 * @property {string[]} statusLines
 * @property {string} [selectionHint]
 * @property {number} [quickstartScore]
 * @typedef {object} ChannelOnboardingStatusContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {SetupChannelsOptions} [options]
 * @property {Partial<Record<import('./types.core.js').ChannelId, string>>} accountOverrides
 * @typedef {object} ChannelOnboardingConfigureContext
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {import('../../runtime.js').RuntimeEnv} runtime
 * @property {import('../../wizard/prompts.js').WizardPrompter} prompter
 * @property {SetupChannelsOptions} [options]
 * @property {Partial<Record<import('./types.core.js').ChannelId, string>>} accountOverrides
 * @property {boolean} shouldPromptAccountIds
 * @property {boolean} forceAllowFrom
 * @typedef {object} ChannelOnboardingResult
 * @property {import('../../config/config.js').OpenClawConfig} cfg
 * @property {string} [accountId]
 * @typedef {object} ChannelOnboardingDmPolicy
 * @property {string} label
 * @property {import('./types.core.js').ChannelId} channel
 * @property {string} policyKey
 * @property {string} allowFromKey
 * @property {(cfg: import('../../config/config.js').OpenClawConfig) => import('../../config/types.js').DmPolicy} getCurrent
 * @property {(cfg: import('../../config/config.js').OpenClawConfig, policy: import('../../config/types.js').DmPolicy) => import('../../config/config.js').OpenClawConfig} setPolicy
 * @property {(params: {cfg: import('../../config/config.js').OpenClawConfig, prompter: import('../../wizard/prompts.js').WizardPrompter, accountId?: string}) => Promise<import('../../config/config.js').OpenClawConfig>} [promptAllowFrom]
 * @typedef {object} ChannelOnboardingAdapter
 * @property {import('./types.core.js').ChannelId} channel
 * @property {(ctx: ChannelOnboardingStatusContext) => Promise<ChannelOnboardingStatus>} getStatus
 * @property {(ctx: ChannelOnboardingConfigureContext) => Promise<ChannelOnboardingResult>} configure
 * @property {ChannelOnboardingDmPolicy} [dmPolicy]
 * @property {(accountId: string, options?: SetupChannelsOptions) => void} [onAccountRecorded]
 * @property {(cfg: import('../../config/config.js').OpenClawConfig) => import('../../config/config.js').OpenClawConfig} [disable]
 */

// This module is type-only; no runtime exports.
