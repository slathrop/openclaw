function normalizeAllowEntry(value) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed === '*') {
    return '*';
  }
  return trimmed.replace(/^line:(?:user:)?/i, '');
}
const normalizeAllowFrom = (list) => {
  const entries = (list ?? []).map((value) => normalizeAllowEntry(value)).filter(Boolean);
  const hasWildcard = entries.includes('*');
  return {
    entries,
    hasWildcard,
    hasEntries: entries.length > 0
  };
};
const normalizeAllowFromWithStore = (params) => {
  const combined = [...params.allowFrom ?? [], ...params.storeAllowFrom ?? []];
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
    return false;
  }
  if (allow.hasWildcard) {
    return true;
  }
  if (!senderId) {
    return false;
  }
  return allow.entries.includes(senderId);
};
export {
  firstDefined,
  isSenderAllowed,
  normalizeAllowFrom,
  normalizeAllowFromWithStore
};
