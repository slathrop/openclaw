/**
 * @param platform
 * @module gateway/server-mobile-nodes -- Mobile node connection management.
 */
const isMobilePlatform = (platform) => {
  const p = typeof platform === 'string' ? platform.trim().toLowerCase() : '';
  if (!p) {
    return false;
  }
  return p.startsWith('ios') || p.startsWith('ipados') || p.startsWith('android');
};
function hasConnectedMobileNode(registry) {
  const connected = registry.listConnected();
  return connected.some((n) => isMobilePlatform(n.platform));
}
export {
  hasConnectedMobileNode
};
