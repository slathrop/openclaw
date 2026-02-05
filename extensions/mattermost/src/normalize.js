function normalizeMattermostMessagingTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('channel:')) {
    const id = trimmed.slice('channel:'.length).trim();
    return id ? `channel:${id}` : void 0;
  }
  if (lower.startsWith('group:')) {
    const id = trimmed.slice('group:'.length).trim();
    return id ? `channel:${id}` : void 0;
  }
  if (lower.startsWith('user:')) {
    const id = trimmed.slice('user:'.length).trim();
    return id ? `user:${id}` : void 0;
  }
  if (lower.startsWith('mattermost:')) {
    const id = trimmed.slice('mattermost:'.length).trim();
    return id ? `user:${id}` : void 0;
  }
  if (trimmed.startsWith('@')) {
    const id = trimmed.slice(1).trim();
    return id ? `@${id}` : void 0;
  }
  if (trimmed.startsWith('#')) {
    const id = trimmed.slice(1).trim();
    return id ? `channel:${id}` : void 0;
  }
  return `channel:${trimmed}`;
}
function looksLikeMattermostTargetId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(user|channel|group|mattermost):/i.test(trimmed)) {
    return true;
  }
  if (/^[@#]/.test(trimmed)) {
    return true;
  }
  return /^[a-z0-9]{8,}$/i.test(trimmed);
}
export {
  looksLikeMattermostTargetId,
  normalizeMattermostMessagingTarget
};
