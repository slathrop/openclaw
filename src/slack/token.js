function normalizeSlackToken(raw) {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : void 0;
}
function resolveSlackBotToken(raw) {
  return normalizeSlackToken(raw);
}
function resolveSlackAppToken(raw) {
  return normalizeSlackToken(raw);
}
export {
  normalizeSlackToken,
  resolveSlackAppToken,
  resolveSlackBotToken
};
