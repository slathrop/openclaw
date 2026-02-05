import { normalizeIMessageHandle } from '../../../imessage/targets.js';
const SERVICE_PREFIXES = ['imessage:', 'sms:', 'auto:'];
const CHAT_TARGET_PREFIX_RE = /^(chat_id:|chatid:|chat:|chat_guid:|chatguid:|guid:|chat_identifier:|chatidentifier:|chatident:)/i;
function normalizeIMessageMessagingTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  const lower = trimmed.toLowerCase();
  for (const prefix of SERVICE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const remainder = trimmed.slice(prefix.length).trim();
      const normalizedHandle = normalizeIMessageHandle(remainder);
      if (!normalizedHandle) {
        return void 0;
      }
      if (CHAT_TARGET_PREFIX_RE.test(normalizedHandle)) {
        return normalizedHandle;
      }
      return `${prefix}${normalizedHandle}`;
    }
  }
  const normalized = normalizeIMessageHandle(trimmed);
  return normalized || void 0;
}
function looksLikeIMessageTargetId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(imessage:|sms:|auto:)/i.test(trimmed)) {
    return true;
  }
  if (CHAT_TARGET_PREFIX_RE.test(trimmed)) {
    return true;
  }
  if (trimmed.includes('@')) {
    return true;
  }
  return /^\+?\d{3,}$/.test(trimmed);
}
export {
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget
};
