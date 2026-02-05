const normalizeAllowFrom = (list) => {
  const entries = (list ?? []).map((value) => String(value).trim()).filter(Boolean);
  const hasWildcard = entries.includes('*');
  const normalized = entries.filter((value) => value !== '*').map((value) => value.replace(/^(feishu|lark):/i, ''));
  const normalizedLower = normalized.map((value) => value.toLowerCase());
  return {
    entries: normalized,
    entriesLower: normalizedLower,
    hasWildcard,
    hasEntries: entries.length > 0
  };
};
const normalizeAllowFromWithStore = (params) => {
  const combined = [...params.allowFrom ?? [], ...params.storeAllowFrom ?? []].map((value) => String(value).trim()).filter(Boolean);
  return normalizeAllowFrom(combined);
};
const firstDefined = (...values) => {
  for (const value of values) {
    if (typeof value !== 'undefined') {
      return value;
    }
  }
  return void 0;
};
const isSenderAllowed = (params) => {
  const { allow, senderId } = params;
  if (!allow.hasEntries) {
    return true;
  }
  if (allow.hasWildcard) {
    return true;
  }
  if (senderId && allow.entries.includes(senderId)) {
    return true;
  }
  if (senderId && allow.entriesLower.includes(senderId.toLowerCase())) {
    return true;
  }
  return false;
};
const resolveSenderAllowMatch = (params) => {
  const { allow, senderId } = params;
  if (allow.hasWildcard) {
    return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
  }
  if (!allow.hasEntries) {
    return { allowed: false };
  }
  if (senderId && allow.entries.includes(senderId)) {
    return { allowed: true, matchKey: senderId, matchSource: 'id' };
  }
  if (senderId && allow.entriesLower.includes(senderId.toLowerCase())) {
    return { allowed: true, matchKey: senderId.toLowerCase(), matchSource: 'id' };
  }
  return { allowed: false };
};
export {
  firstDefined,
  isSenderAllowed,
  normalizeAllowFrom,
  normalizeAllowFromWithStore,
  resolveSenderAllowMatch
};
