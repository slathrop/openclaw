/**
 * @param match
 * @module SECURITY: Allowlist matching for sender authorization
 */
function formatAllowlistMatchMeta(match) {
  return `matchKey=${match?.matchKey ?? 'none'} matchSource=${match?.matchSource ?? 'none'}`;
}
export {
  formatAllowlistMatchMeta
};
