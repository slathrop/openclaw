import express from 'express';
import { loadConfig } from '../config/config.js';
import { createSubsystemLogger } from '../logging/subsystem.js';
import { resolveBrowserConfig, resolveProfile } from './config.js';
import { ensureChromeExtensionRelayServer } from './extension-relay.js';
import { registerBrowserRoutes } from './routes/index.js';
import { createBrowserRouteContext } from './server-context.js';
let state = null;
const log = createSubsystemLogger('browser');
const logServer = log.child('server');
async function startBrowserControlServerFromConfig() {
  if (state) {
    return state;
  }
  const cfg = loadConfig();
  const resolved = resolveBrowserConfig(cfg.browser, cfg);
  if (!resolved.enabled) {
    return null;
  }
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const ctx = createBrowserRouteContext({
    getState: () => state
  });
  registerBrowserRoutes(app, ctx);
  const port = resolved.controlPort;
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(port, '127.0.0.1', () => resolve(s));
    s.once('error', reject);
  }).catch((err) => {
    logServer.error(`openclaw browser server failed to bind 127.0.0.1:${port}: ${String(err)}`);
    return null;
  });
  if (!server) {
    return null;
  }
  state = {
    server,
    port,
    resolved,
    profiles: /* @__PURE__ */ new Map()
  };
  for (const name of Object.keys(resolved.profiles)) {
    const profile = resolveProfile(resolved, name);
    if (!profile || profile.driver !== 'extension') {
      continue;
    }
    await ensureChromeExtensionRelayServer({ cdpUrl: profile.cdpUrl }).catch((err) => {
      logServer.warn(`Chrome extension relay init failed for profile "${name}": ${String(err)}`);
    });
  }
  logServer.info(`Browser control listening on http://127.0.0.1:${port}/`);
  return state;
}
async function stopBrowserControlServer() {
  const current = state;
  if (!current) {
    return;
  }
  const ctx = createBrowserRouteContext({
    getState: () => state
  });
  try {
    const current2 = state;
    if (current2) {
      for (const name of Object.keys(current2.resolved.profiles)) {
        try {
          await ctx.forProfile(name).stopRunningBrowser();
        } catch {
          // Intentionally ignored
        }
      }
    }
  } catch (err) {
    logServer.warn(`openclaw browser stop failed: ${String(err)}`);
  }
  if (current.server) {
    await new Promise((resolve) => {
      current.server?.close(() => resolve());
    });
  }
  state = null;
  try {
    const mod = await import('./pw-ai.js');
    await mod.closePlaywrightBrowserConnection();
  } catch {
    // Intentionally ignored
  }
}
export {
  startBrowserControlServerFromConfig,
  stopBrowserControlServer
};
