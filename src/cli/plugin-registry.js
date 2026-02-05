const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from '../agents/agent-scope.js';
import { loadConfig } from '../config/config.js';
import { createSubsystemLogger } from '../logging.js';
import { loadOpenClawPlugins } from '../plugins/loader.js';
const log = createSubsystemLogger('plugins');
let pluginRegistryLoaded = false;
function ensurePluginRegistryLoaded() {
  if (pluginRegistryLoaded) {
    return;
  }
  const config = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  const logger = {
    info: /* @__PURE__ */ __name((msg) => log.info(msg), 'info'),
    warn: /* @__PURE__ */ __name((msg) => log.warn(msg), 'warn'),
    error: /* @__PURE__ */ __name((msg) => log.error(msg), 'error'),
    debug: /* @__PURE__ */ __name((msg) => log.debug(msg), 'debug')
  };
  loadOpenClawPlugins({
    config,
    workspaceDir,
    logger
  });
  pluginRegistryLoaded = true;
}
__name(ensurePluginRegistryLoaded, 'ensurePluginRegistryLoaded');
export {
  ensurePluginRegistryLoaded
};
