/**
 * Sandbox information resolution for Pi embedded runner.
 * @param sandbox
 * @param execElevated
 * @module agents/pi-embedded-runner/sandbox-info
 */
function buildEmbeddedSandboxInfo(sandbox, execElevated) {
  if (!sandbox?.enabled) {
    return void 0;
  }
  const elevatedAllowed = Boolean(execElevated?.enabled && execElevated.allowed);
  return {
    enabled: true,
    workspaceDir: sandbox.workspaceDir,
    workspaceAccess: sandbox.workspaceAccess,
    agentWorkspaceMount: sandbox.workspaceAccess === 'ro' ? '/agent' : void 0,
    browserBridgeUrl: sandbox.browser?.bridgeUrl,
    browserNoVncUrl: sandbox.browser?.noVncUrl,
    hostBrowserAllowed: sandbox.browserAllowHostControl,
    ...elevatedAllowed ? {
      elevated: {
        allowed: true,
        defaultLevel: execElevated?.defaultLevel ?? 'off'
      }
    } : {}
  };
}
export {
  buildEmbeddedSandboxInfo
};
