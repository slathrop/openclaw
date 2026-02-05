/**
 * WhatsApp target normalization (JID, LID, group, E.164)
 */
import { normalizeE164 } from '../utils.js';

const WHATSAPP_USER_JID_RE = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/i;
const WHATSAPP_LID_RE = /^(\d+)@lid$/i;

/**
 * Strip "whatsapp:" prefixes from a target value
 * @param {string} value
 * @returns {string}
 */
function stripWhatsAppTargetPrefixes(value) {
  let candidate = value.trim();
  for (;;) {
    const before = candidate;
    candidate = candidate.replace(/^whatsapp:/i, '').trim();
    if (candidate === before) {
      return candidate;
    }
  }
}

/**
 * Check if value looks like a WhatsApp group JID (e.g. "120363401234567890@g.us")
 * @param {string} value
 * @returns {boolean}
 */
export function isWhatsAppGroupJid(value) {
  const candidate = stripWhatsAppTargetPrefixes(value);
  const lower = candidate.toLowerCase();
  if (!lower.endsWith('@g.us')) {
    return false;
  }
  const localPart = candidate.slice(0, candidate.length - '@g.us'.length);
  if (!localPart || localPart.includes('@')) {
    return false;
  }
  return /^[0-9]+(-[0-9]+)*$/.test(localPart);
}

/**
 * Check if value looks like a WhatsApp user target (e.g. "41796666864:0@s.whatsapp.net" or "123@lid")
 * @param {string} value
 * @returns {boolean}
 */
export function isWhatsAppUserTarget(value) {
  const candidate = stripWhatsAppTargetPrefixes(value);
  return WHATSAPP_USER_JID_RE.test(candidate) || WHATSAPP_LID_RE.test(candidate);
}

/**
 * Extract the phone number from a WhatsApp user JID.
 * "41796666864:0@s.whatsapp.net" -> "41796666864"
 * "123456@lid" -> "123456"
 * @param {string} jid
 * @returns {string | null}
 */
function extractUserJidPhone(jid) {
  const userMatch = jid.match(WHATSAPP_USER_JID_RE);
  if (userMatch) {
    return userMatch[1];
  }
  const lidMatch = jid.match(WHATSAPP_LID_RE);
  if (lidMatch) {
    return lidMatch[1];
  }
  return null;
}

/**
 * Normalize a WhatsApp target to a canonical form
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeWhatsAppTarget(value) {
  const candidate = stripWhatsAppTargetPrefixes(value);
  if (!candidate) {
    return null;
  }
  if (isWhatsAppGroupJid(candidate)) {
    const localPart = candidate.slice(0, candidate.length - '@g.us'.length);
    return `${localPart}@g.us`;
  }
  // Handle user JIDs (e.g. "41796666864:0@s.whatsapp.net")
  if (isWhatsAppUserTarget(candidate)) {
    const phone = extractUserJidPhone(candidate);
    if (!phone) {
      return null;
    }
    const normalized = normalizeE164(phone);
    return normalized.length > 1 ? normalized : null;
  }
  // If the caller passed a JID-ish string that we don't understand, fail fast.
  // Otherwise normalizeE164 would happily treat "group:120@g.us" as a phone number.
  if (candidate.includes('@')) {
    return null;
  }
  const normalized = normalizeE164(candidate);
  return normalized.length > 1 ? normalized : null;
}
