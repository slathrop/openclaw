const MAX_ASSISTANT_NAME = 50;
const MAX_ASSISTANT_AVATAR = 200;
const DEFAULT_ASSISTANT_NAME = 'Assistant';
const DEFAULT_ASSISTANT_AVATAR = 'A';
function coerceIdentityValue(value, maxLength) {
  if (typeof value !== 'string') {
    return void 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return void 0;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}
function normalizeAssistantIdentity(input) {
  const name = coerceIdentityValue(input?.name, MAX_ASSISTANT_NAME) ?? DEFAULT_ASSISTANT_NAME;
  const avatar = coerceIdentityValue(input?.avatar ?? void 0, MAX_ASSISTANT_AVATAR) ?? null;
  const agentId = typeof input?.agentId === 'string' && input.agentId.trim() ? input.agentId.trim() : null;
  return { agentId, name, avatar };
}
function resolveInjectedAssistantIdentity() {
  if (typeof window === 'undefined') {
    return normalizeAssistantIdentity({});
  }
  return normalizeAssistantIdentity({
    name: window.__OPENCLAW_ASSISTANT_NAME__,
    avatar: window.__OPENCLAW_ASSISTANT_AVATAR__
  });
}
export {
  DEFAULT_ASSISTANT_AVATAR,
  DEFAULT_ASSISTANT_NAME,
  normalizeAssistantIdentity,
  resolveInjectedAssistantIdentity
};
