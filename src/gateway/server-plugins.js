/** @module gateway/server-plugins -- Plugin lifecycle management for the gateway. */
import { loadOpenClawPlugins } from '../plugins/loader.js';
function loadGatewayPlugins(params) {
  const pluginRegistry = loadOpenClawPlugins({
    config: params.cfg,
    workspaceDir: params.workspaceDir,
    logger: {
      info: (msg) => params.log.info(msg),
      warn: (msg) => params.log.warn(msg),
      error: (msg) => params.log.error(msg),
      debug: (msg) => params.log.debug(msg)
    },
    coreGatewayHandlers: params.coreGatewayHandlers
  });
  const pluginMethods = Object.keys(pluginRegistry.gatewayHandlers);
  const gatewayMethods = Array.from(/* @__PURE__ */ new Set([...params.baseMethods, ...pluginMethods]));
  if (pluginRegistry.diagnostics.length > 0) {
    for (const diag of pluginRegistry.diagnostics) {
      const details = [
        diag.pluginId ? `plugin=${diag.pluginId}` : null,
        diag.source ? `source=${diag.source}` : null
      ].filter((entry) => Boolean(entry)).join(', ');
      const message = details ? `[plugins] ${diag.message} (${details})` : `[plugins] ${diag.message}`;
      if (diag.level === 'error') {
        params.log.error(message);
      } else {
        params.log.info(message);
      }
    }
  }
  return { pluginRegistry, gatewayMethods };
}
export {
  loadGatewayPlugins
};
