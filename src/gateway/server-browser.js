/** @module gateway/server-browser -- Browser-based client support for the gateway. */
import { isTruthyEnvValue } from '../infra/env.js';
async function startBrowserControlServerIfEnabled() {
  if (isTruthyEnvValue(process.env.OPENCLAW_SKIP_BROWSER_CONTROL_SERVER)) {
    return null;
  }
  const override = process.env.OPENCLAW_BROWSER_CONTROL_MODULE?.trim();
  const mod = override ? await import(override) : await import('../browser/control-service.js');
  const start = typeof mod.startBrowserControlServiceFromConfig === 'function' ? mod.startBrowserControlServiceFromConfig : mod.startBrowserControlServerFromConfig;
  const stop = typeof mod.stopBrowserControlService === 'function' ? mod.stopBrowserControlService : mod.stopBrowserControlServer;
  if (!start) {
    return null;
  }
  await start();
  return { stop: stop ?? (async () => {
  }) };
}
export {
  startBrowserControlServerIfEnabled
};
