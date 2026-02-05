const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const normalizeAllowFrom = /* @__PURE__ */ __name((list) => {
  const entries = (list ?? []).map((value) => String(value).trim()).filter(Boolean);
  const hasWildcard = entries.includes('*');
  const normalized = entries.filter((value) => value !== '*').map((value) => value.replace(/^(telegram|tg):/i, ''));
  const normalizedLower = normalized.map((value) => value.toLowerCase());
  return {
    entries: normalized,
    entriesLower: normalizedLower,
    hasWildcard,
    hasEntries: entries.length > 0
  };
}, 'normalizeAllowFrom');
const normalizeAllowFromWithStore = /* @__PURE__ */ __name((params) => {
  const combined = [...params.allowFrom ?? [], ...params.storeAllowFrom ?? []].map((value) => String(value).trim()).filter(Boolean);
  return normalizeAllowFrom(combined);
}, 'normalizeAllowFromWithStore');
const firstDefined = /* @__PURE__ */ __name((...values) => {
  for (const value of values) {
    if (typeof value !== 'undefined') {
      return value;
    }
  }
  return void 0;
}, 'firstDefined');
const isSenderAllowed = /* @__PURE__ */ __name((params) => {
  const { allow, senderId, senderUsername } = params;
  if (!allow.hasEntries) {
    return true;
  }
  if (allow.hasWildcard) {
    return true;
  }
  if (senderId && allow.entries.includes(senderId)) {
    return true;
  }
  const username = senderUsername?.toLowerCase();
  if (!username) {
    return false;
  }
  return allow.entriesLower.some((entry) => entry === username || entry === `@${username}`);
}, 'isSenderAllowed');
const resolveSenderAllowMatch = /* @__PURE__ */ __name((params) => {
  const { allow, senderId, senderUsername } = params;
  if (allow.hasWildcard) {
    return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
  }
  if (!allow.hasEntries) {
    return { allowed: false };
  }
  if (senderId && allow.entries.includes(senderId)) {
    return { allowed: true, matchKey: senderId, matchSource: 'id' };
  }
  const username = senderUsername?.toLowerCase();
  if (!username) {
    return { allowed: false };
  }
  const entry = allow.entriesLower.find(
    (candidate) => candidate === username || candidate === `@${username}`
  );
  if (entry) {
    return { allowed: true, matchKey: entry, matchSource: 'username' };
  }
  return { allowed: false };
}, 'resolveSenderAllowMatch');
export {
  firstDefined,
  isSenderAllowed,
  normalizeAllowFrom,
  normalizeAllowFromWithStore,
  resolveSenderAllowMatch
};
