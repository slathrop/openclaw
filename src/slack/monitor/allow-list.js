function normalizeSlackSlug(raw) {
  const trimmed = raw?.trim().toLowerCase() ?? '';
  if (!trimmed) {
    return '';
  }
  const dashed = trimmed.replace(/\s+/g, '-');
  const cleaned = dashed.replace(/[^a-z0-9#@._+-]+/g, '-');
  return cleaned.replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
}
function normalizeAllowList(list) {
  return (list ?? []).map((entry) => String(entry).trim()).filter(Boolean);
}
function normalizeAllowListLower(list) {
  return normalizeAllowList(list).map((entry) => entry.toLowerCase());
}
function resolveSlackAllowListMatch(params) {
  const allowList = params.allowList;
  if (allowList.length === 0) {
    return { allowed: false };
  }
  if (allowList.includes('*')) {
    return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
  }
  const id = params.id?.toLowerCase();
  const name = params.name?.toLowerCase();
  const slug = normalizeSlackSlug(name);
  const candidates = [
    { value: id, source: 'id' },
    { value: id ? `slack:${id}` : void 0, source: 'prefixed-id' },
    { value: id ? `user:${id}` : void 0, source: 'prefixed-user' },
    { value: name, source: 'name' },
    { value: name ? `slack:${name}` : void 0, source: 'prefixed-name' },
    { value: slug, source: 'slug' }
  ];
  for (const candidate of candidates) {
    if (!candidate.value) {
      continue;
    }
    if (allowList.includes(candidate.value)) {
      return {
        allowed: true,
        matchKey: candidate.value,
        matchSource: candidate.source
      };
    }
  }
  return { allowed: false };
}
function allowListMatches(params) {
  return resolveSlackAllowListMatch(params).allowed;
}
function resolveSlackUserAllowed(params) {
  const allowList = normalizeAllowListLower(params.allowList);
  if (allowList.length === 0) {
    return true;
  }
  return allowListMatches({
    allowList,
    id: params.userId,
    name: params.userName
  });
}
export {
  allowListMatches,
  normalizeAllowList,
  normalizeAllowListLower,
  normalizeSlackSlug,
  resolveSlackAllowListMatch,
  resolveSlackUserAllowed
};
