import { normalizeWhatsAppTarget } from '../../../whatsapp/normalize.js';
function normalizeWhatsAppMessagingTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  return normalizeWhatsAppTarget(trimmed) ?? void 0;
}
function looksLikeWhatsAppTargetId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^whatsapp:/i.test(trimmed)) {
    return true;
  }
  if (trimmed.includes('@')) {
    return true;
  }
  return /^\+?\d{3,}$/.test(trimmed);
}
export {
  looksLikeWhatsAppTargetId,
  normalizeWhatsAppMessagingTarget
};
