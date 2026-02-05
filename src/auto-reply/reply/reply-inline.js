const INLINE_SIMPLE_COMMAND_ALIASES = /* @__PURE__ */ new Map([
  ['/help', '/help'],
  ['/commands', '/commands'],
  ['/whoami', '/whoami'],
  ['/id', '/whoami']
]);
const INLINE_SIMPLE_COMMAND_RE = /(?:^|\s)\/(help|commands|whoami|id)(?=$|\s|:)/i;
const INLINE_STATUS_RE = /(?:^|\s)\/status(?=$|\s|:)(?:\s*:\s*)?/gi;
function extractInlineSimpleCommand(body) {
  if (!body) {
    return null;
  }
  const match = body.match(INLINE_SIMPLE_COMMAND_RE);
  if (!match || match.index === void 0) {
    return null;
  }
  const alias = `/${match[1].toLowerCase()}`;
  const command = INLINE_SIMPLE_COMMAND_ALIASES.get(alias);
  if (!command) {
    return null;
  }
  const cleaned = body.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
  return { command, cleaned };
}
function stripInlineStatus(body) {
  const trimmed = body.trim();
  if (!trimmed) {
    return { cleaned: '', didStrip: false };
  }
  const cleaned = trimmed.replace(INLINE_STATUS_RE, ' ').replace(/\s+/g, ' ').trim();
  return { cleaned, didStrip: cleaned !== trimmed };
}
export {
  extractInlineSimpleCommand,
  stripInlineStatus
};
