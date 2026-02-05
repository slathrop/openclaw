const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function normalizeSlackToken(raw) {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : void 0;
}
__name(normalizeSlackToken, 'normalizeSlackToken');
function resolveSlackBotToken(raw) {
  return normalizeSlackToken(raw);
}
__name(resolveSlackBotToken, 'resolveSlackBotToken');
function resolveSlackAppToken(raw) {
  return normalizeSlackToken(raw);
}
__name(resolveSlackAppToken, 'resolveSlackAppToken');
export {
  normalizeSlackToken,
  resolveSlackAppToken,
  resolveSlackBotToken
};
