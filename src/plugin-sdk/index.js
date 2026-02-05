import { CHANNEL_MESSAGE_ACTION_NAMES } from '../channels/plugins/message-action-names.js';
import {
  BLUEBUBBLES_ACTIONS,
  BLUEBUBBLES_ACTION_NAMES,
  BLUEBUBBLES_GROUP_ACTIONS
} from '../channels/plugins/bluebubbles-actions.js';
import { normalizePluginHttpPath } from '../plugins/http-path.js';
import { registerPluginHttpRoute } from '../plugins/http-registry.js';
import { emptyPluginConfigSchema } from '../plugins/config-schema.js';
import { getChatChannelMeta } from '../channels/registry.js';
import {
  DiscordConfigSchema,
  GoogleChatConfigSchema,
  IMessageConfigSchema,
  MSTeamsConfigSchema,
  SignalConfigSchema,
  SlackConfigSchema,
  TelegramConfigSchema
} from '../config/zod-schema.providers-core.js';
import { WhatsAppConfigSchema } from '../config/zod-schema.providers-whatsapp.js';
import {
  BlockStreamingCoalesceSchema,
  DmConfigSchema,
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  MarkdownTableModeSchema,
  normalizeAllowFrom,
  requireOpenAllowFrom
} from '../config/zod-schema.core.js';
import { ToolPolicySchema } from '../config/zod-schema.agent-runtime.js';
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../routing/session-key.js';
import { resolveAckReaction } from '../agents/identity.js';
import { SILENT_REPLY_TOKEN, isSilentReplyText } from '../auto-reply/tokens.js';
import { resolveToolsBySender } from '../config/group-policy.js';
import {
  buildPendingHistoryContextFromMap,
  clearHistoryEntries,
  clearHistoryEntriesIfEnabled,
  DEFAULT_GROUP_HISTORY_LIMIT,
  recordPendingHistoryEntry,
  recordPendingHistoryEntryIfEnabled
} from '../auto-reply/reply/history.js';
import { mergeAllowlist, summarizeMapping } from '../channels/allowlists/resolve-utils.js';
import {
  resolveMentionGating,
  resolveMentionGatingWithBypass
} from '../channels/mention-gating.js';
import {
  removeAckReactionAfterReply,
  shouldAckReaction,
  shouldAckReactionForWhatsApp
} from '../channels/ack-reactions.js';
import { createTypingCallbacks } from '../channels/typing.js';
import { createReplyPrefixContext, createReplyPrefixOptions } from '../channels/reply-prefix.js';
import { logAckFailure, logInboundDrop, logTypingFailure } from '../channels/logging.js';
import { resolveChannelMediaMaxBytes } from '../channels/plugins/media-limits.js';
import { formatLocationText, toLocationContext } from '../channels/location.js';
import { resolveControlCommandGate } from '../channels/command-gating.js';
import {
  resolveBlueBubblesGroupRequireMention,
  resolveDiscordGroupRequireMention,
  resolveGoogleChatGroupRequireMention,
  resolveIMessageGroupRequireMention,
  resolveSlackGroupRequireMention,
  resolveTelegramGroupRequireMention,
  resolveWhatsAppGroupRequireMention,
  resolveBlueBubblesGroupToolPolicy,
  resolveDiscordGroupToolPolicy,
  resolveGoogleChatGroupToolPolicy,
  resolveIMessageGroupToolPolicy,
  resolveSlackGroupToolPolicy,
  resolveTelegramGroupToolPolicy,
  resolveWhatsAppGroupToolPolicy
} from '../channels/plugins/group-mentions.js';
import { recordInboundSession } from '../channels/session.js';
import {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatch,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision
} from '../channels/plugins/channel-config.js';
import {
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  listWhatsAppDirectoryGroupsFromConfig,
  listWhatsAppDirectoryPeersFromConfig
} from '../channels/plugins/directory-config.js';
import { formatAllowlistMatchMeta } from '../channels/plugins/allowlist-match.js';
import { optionalStringEnum, stringEnum } from '../agents/schema/typebox.js';
import { buildChannelConfigSchema } from '../channels/plugins/config-schema.js';
import {
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection
} from '../channels/plugins/config-helpers.js';
import {
  applyAccountNameToChannelSection,
  migrateBaseNameToDefaultAccount
} from '../channels/plugins/setup-helpers.js';
import { formatPairingApproveHint } from '../channels/plugins/helpers.js';
import { PAIRING_APPROVED_MESSAGE } from '../channels/plugins/pairing-message.js';
import { addWildcardAllowFrom, promptAccountId } from '../channels/plugins/onboarding/helpers.js';
import { promptChannelAccessConfig } from '../channels/plugins/onboarding/channel-access.js';
import {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam
} from '../agents/tools/common.js';
import { formatDocsLink } from '../terminal/links.js';
import { normalizeE164 } from '../utils.js';
import { missingTargetError } from '../infra/outbound/target-errors.js';
import { registerLogTransport } from '../logging/logger.js';
import {
  emitDiagnosticEvent,
  isDiagnosticsEnabled,
  onDiagnosticEvent
} from '../infra/diagnostic-events.js';
import { detectMime, extensionForMime, getFileExtension } from '../media/mime.js';
import { extractOriginalFilename } from '../media/store.js';
import {
  listDiscordAccountIds,
  resolveDefaultDiscordAccountId,
  resolveDiscordAccount
} from '../discord/accounts.js';
import { collectDiscordAuditChannelIds } from '../discord/audit.js';
import { discordOnboardingAdapter } from '../channels/plugins/onboarding/discord.js';
import {
  looksLikeDiscordTargetId,
  normalizeDiscordMessagingTarget
} from '../channels/plugins/normalize/discord.js';
import { collectDiscordStatusIssues } from '../channels/plugins/status-issues/discord.js';
import {
  listIMessageAccountIds,
  resolveDefaultIMessageAccountId,
  resolveIMessageAccount
} from '../imessage/accounts.js';
import { imessageOnboardingAdapter } from '../channels/plugins/onboarding/imessage.js';
import {
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget
} from '../channels/plugins/normalize/imessage.js';
import {
  listEnabledSlackAccounts,
  listSlackAccountIds,
  resolveDefaultSlackAccountId,
  resolveSlackAccount,
  resolveSlackReplyToMode
} from '../slack/accounts.js';
import { slackOnboardingAdapter } from '../channels/plugins/onboarding/slack.js';
import {
  looksLikeSlackTargetId,
  normalizeSlackMessagingTarget
} from '../channels/plugins/normalize/slack.js';
import { buildSlackThreadingToolContext } from '../slack/threading-tool-context.js';
import {
  listTelegramAccountIds,
  resolveDefaultTelegramAccountId,
  resolveTelegramAccount
} from '../telegram/accounts.js';
import { telegramOnboardingAdapter } from '../channels/plugins/onboarding/telegram.js';
import {
  looksLikeTelegramTargetId,
  normalizeTelegramMessagingTarget
} from '../channels/plugins/normalize/telegram.js';
import { collectTelegramStatusIssues } from '../channels/plugins/status-issues/telegram.js';
import {
  listSignalAccountIds,
  resolveDefaultSignalAccountId,
  resolveSignalAccount
} from '../signal/accounts.js';
import { signalOnboardingAdapter } from '../channels/plugins/onboarding/signal.js';
import {
  looksLikeSignalTargetId,
  normalizeSignalMessagingTarget
} from '../channels/plugins/normalize/signal.js';
import {
  listWhatsAppAccountIds,
  resolveDefaultWhatsAppAccountId,
  resolveWhatsAppAccount
} from '../web/accounts.js';
import { isWhatsAppGroupJid, normalizeWhatsAppTarget } from '../whatsapp/normalize.js';
import { whatsappOnboardingAdapter } from '../channels/plugins/onboarding/whatsapp.js';
import { resolveWhatsAppHeartbeatRecipients } from '../channels/plugins/whatsapp-heartbeat.js';
import {
  looksLikeWhatsAppTargetId,
  normalizeWhatsAppMessagingTarget
} from '../channels/plugins/normalize/whatsapp.js';
import { collectWhatsAppStatusIssues } from '../channels/plugins/status-issues/whatsapp.js';
import { collectBlueBubblesStatusIssues } from '../channels/plugins/status-issues/bluebubbles.js';
import {
  listLineAccountIds,
  normalizeAccountId as normalizeAccountId2,
  resolveDefaultLineAccountId,
  resolveLineAccount
} from '../line/accounts.js';
import { LineConfigSchema } from '../line/config-schema.js';
import {
  createInfoCard,
  createListCard,
  createImageCard,
  createActionCard,
  createReceiptCard
} from '../line/flex-templates.js';
import {
  processLineMessage,
  hasMarkdownToConvert,
  stripMarkdown
} from '../line/markdown-to-line.js';
import {
  listFeishuAccountIds,
  resolveDefaultFeishuAccountId,
  resolveFeishuAccount
} from '../feishu/accounts.js';
import {
  resolveFeishuConfig,
  resolveFeishuGroupEnabled,
  resolveFeishuGroupRequireMention
} from '../feishu/config.js';
import { feishuOutbound } from '../channels/plugins/outbound/feishu.js';
import { normalizeFeishuTarget } from '../channels/plugins/normalize/feishu.js';
import { probeFeishu } from '../feishu/probe.js';
import { monitorFeishuProvider } from '../feishu/monitor.js';
import { loadWebMedia } from '../web/media.js';
export {
  BLUEBUBBLES_ACTIONS,
  BLUEBUBBLES_ACTION_NAMES,
  BLUEBUBBLES_GROUP_ACTIONS,
  BlockStreamingCoalesceSchema,
  CHANNEL_MESSAGE_ACTION_NAMES,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_GROUP_HISTORY_LIMIT,
  DiscordConfigSchema,
  DmConfigSchema,
  DmPolicySchema,
  GoogleChatConfigSchema,
  GroupPolicySchema,
  IMessageConfigSchema,
  LineConfigSchema,
  MSTeamsConfigSchema,
  MarkdownConfigSchema,
  MarkdownTableModeSchema,
  PAIRING_APPROVED_MESSAGE,
  SILENT_REPLY_TOKEN,
  SignalConfigSchema,
  SlackConfigSchema,
  TelegramConfigSchema,
  ToolPolicySchema,
  WhatsAppConfigSchema,
  addWildcardAllowFrom,
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  buildChannelKeyCandidates,
  buildPendingHistoryContextFromMap,
  buildSlackThreadingToolContext,
  clearHistoryEntries,
  clearHistoryEntriesIfEnabled,
  collectBlueBubblesStatusIssues,
  collectDiscordAuditChannelIds,
  collectDiscordStatusIssues,
  collectTelegramStatusIssues,
  collectWhatsAppStatusIssues,
  createActionCard,
  createActionGate,
  createImageCard,
  createInfoCard,
  createListCard,
  createReceiptCard,
  createReplyPrefixContext,
  createReplyPrefixOptions,
  createTypingCallbacks,
  deleteAccountFromConfigSection,
  detectMime,
  discordOnboardingAdapter,
  emitDiagnosticEvent,
  emptyPluginConfigSchema,
  extensionForMime,
  extractOriginalFilename,
  feishuOutbound,
  formatAllowlistMatchMeta,
  formatDocsLink,
  formatLocationText,
  formatPairingApproveHint,
  getChatChannelMeta,
  getFileExtension,
  hasMarkdownToConvert,
  imessageOnboardingAdapter,
  isDiagnosticsEnabled,
  isSilentReplyText,
  isWhatsAppGroupJid,
  jsonResult,
  listDiscordAccountIds,
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  listEnabledSlackAccounts,
  listFeishuAccountIds,
  listIMessageAccountIds,
  listLineAccountIds,
  listSignalAccountIds,
  listSlackAccountIds,
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
  listTelegramAccountIds,
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  listWhatsAppAccountIds,
  listWhatsAppDirectoryGroupsFromConfig,
  listWhatsAppDirectoryPeersFromConfig,
  loadWebMedia,
  logAckFailure,
  logInboundDrop,
  logTypingFailure,
  looksLikeDiscordTargetId,
  looksLikeIMessageTargetId,
  looksLikeSignalTargetId,
  looksLikeSlackTargetId,
  looksLikeTelegramTargetId,
  looksLikeWhatsAppTargetId,
  mergeAllowlist,
  migrateBaseNameToDefaultAccount,
  missingTargetError,
  monitorFeishuProvider,
  normalizeAccountId,
  normalizeAllowFrom,
  normalizeChannelSlug,
  normalizeDiscordMessagingTarget,
  normalizeE164,
  normalizeFeishuTarget,
  normalizeIMessageMessagingTarget,
  normalizeAccountId2 as normalizeLineAccountId,
  normalizePluginHttpPath,
  normalizeSignalMessagingTarget,
  normalizeSlackMessagingTarget,
  normalizeTelegramMessagingTarget,
  normalizeWhatsAppMessagingTarget,
  normalizeWhatsAppTarget,
  onDiagnosticEvent,
  optionalStringEnum,
  probeFeishu,
  processLineMessage,
  promptAccountId,
  promptChannelAccessConfig,
  readNumberParam,
  readReactionParams,
  readStringParam,
  recordInboundSession,
  recordPendingHistoryEntry,
  recordPendingHistoryEntryIfEnabled,
  registerLogTransport,
  registerPluginHttpRoute,
  removeAckReactionAfterReply,
  requireOpenAllowFrom,
  resolveAckReaction,
  resolveBlueBubblesGroupRequireMention,
  resolveBlueBubblesGroupToolPolicy,
  resolveChannelEntryMatch,
  resolveChannelEntryMatchWithFallback,
  resolveChannelMediaMaxBytes,
  resolveControlCommandGate,
  resolveDefaultDiscordAccountId,
  resolveDefaultFeishuAccountId,
  resolveDefaultIMessageAccountId,
  resolveDefaultLineAccountId,
  resolveDefaultSignalAccountId,
  resolveDefaultSlackAccountId,
  resolveDefaultTelegramAccountId,
  resolveDefaultWhatsAppAccountId,
  resolveDiscordAccount,
  resolveDiscordGroupRequireMention,
  resolveDiscordGroupToolPolicy,
  resolveFeishuAccount,
  resolveFeishuConfig,
  resolveFeishuGroupEnabled,
  resolveFeishuGroupRequireMention,
  resolveGoogleChatGroupRequireMention,
  resolveGoogleChatGroupToolPolicy,
  resolveIMessageAccount,
  resolveIMessageGroupRequireMention,
  resolveIMessageGroupToolPolicy,
  resolveLineAccount,
  resolveMentionGating,
  resolveMentionGatingWithBypass,
  resolveNestedAllowlistDecision,
  resolveSignalAccount,
  resolveSlackAccount,
  resolveSlackGroupRequireMention,
  resolveSlackGroupToolPolicy,
  resolveSlackReplyToMode,
  resolveTelegramAccount,
  resolveTelegramGroupRequireMention,
  resolveTelegramGroupToolPolicy,
  resolveToolsBySender,
  resolveWhatsAppAccount,
  resolveWhatsAppGroupRequireMention,
  resolveWhatsAppGroupToolPolicy,
  resolveWhatsAppHeartbeatRecipients,
  setAccountEnabledInConfigSection,
  shouldAckReaction,
  shouldAckReactionForWhatsApp,
  signalOnboardingAdapter,
  slackOnboardingAdapter,
  stringEnum,
  stripMarkdown,
  summarizeMapping,
  telegramOnboardingAdapter,
  toLocationContext,
  whatsappOnboardingAdapter
};
