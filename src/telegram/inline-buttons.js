const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { listTelegramAccountIds, resolveTelegramAccount } from './accounts.js';
import { parseTelegramTarget } from './targets.js';
const DEFAULT_INLINE_BUTTONS_SCOPE = 'allowlist';
function normalizeInlineButtonsScope(value) {
  if (typeof value !== 'string') {
    return void 0;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'off' || trimmed === 'dm' || trimmed === 'group' || trimmed === 'all' || trimmed === 'allowlist') {
    return trimmed;
  }
  return void 0;
}
__name(normalizeInlineButtonsScope, 'normalizeInlineButtonsScope');
function resolveInlineButtonsScopeFromCapabilities(capabilities) {
  if (!capabilities) {
    return DEFAULT_INLINE_BUTTONS_SCOPE;
  }
  if (Array.isArray(capabilities)) {
    const enabled = capabilities.some(
      (entry) => String(entry).trim().toLowerCase() === 'inlinebuttons'
    );
    return enabled ? 'all' : 'off';
  }
  if (typeof capabilities === 'object') {
    const inlineButtons = capabilities.inlineButtons;
    return normalizeInlineButtonsScope(inlineButtons) ?? DEFAULT_INLINE_BUTTONS_SCOPE;
  }
  return DEFAULT_INLINE_BUTTONS_SCOPE;
}
__name(resolveInlineButtonsScopeFromCapabilities, 'resolveInlineButtonsScopeFromCapabilities');
function resolveTelegramInlineButtonsScope(params) {
  const account = resolveTelegramAccount({ cfg: params.cfg, accountId: params.accountId });
  return resolveInlineButtonsScopeFromCapabilities(account.config.capabilities);
}
__name(resolveTelegramInlineButtonsScope, 'resolveTelegramInlineButtonsScope');
function isTelegramInlineButtonsEnabled(params) {
  if (params.accountId) {
    return resolveTelegramInlineButtonsScope(params) !== 'off';
  }
  const accountIds = listTelegramAccountIds(params.cfg);
  if (accountIds.length === 0) {
    return resolveTelegramInlineButtonsScope(params) !== 'off';
  }
  return accountIds.some(
    (accountId) => resolveTelegramInlineButtonsScope({ cfg: params.cfg, accountId }) !== 'off'
  );
}
__name(isTelegramInlineButtonsEnabled, 'isTelegramInlineButtonsEnabled');
function resolveTelegramTargetChatType(target) {
  if (!target.trim()) {
    return 'unknown';
  }
  const parsed = parseTelegramTarget(target);
  const chatId = parsed.chatId.trim();
  if (!chatId) {
    return 'unknown';
  }
  if (/^-?\d+$/.test(chatId)) {
    return chatId.startsWith('-') ? 'group' : 'direct';
  }
  return 'unknown';
}
__name(resolveTelegramTargetChatType, 'resolveTelegramTargetChatType');
export {
  isTelegramInlineButtonsEnabled,
  resolveTelegramInlineButtonsScope,
  resolveTelegramTargetChatType
};
