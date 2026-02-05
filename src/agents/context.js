/**
 * @module context
 * Agent execution context construction and thread management.
 */
import { loadConfig } from '../config/config.js';
import { resolveOpenClawAgentDir } from './agent-paths.js';
import { ensureOpenClawModelsJson } from './models-config.js';
const MODEL_CACHE = /* @__PURE__ */ new Map();
const loadPromise = (async () => {
  try {
    const { discoverAuthStorage, discoverModels } = await import('./pi-model-discovery.js');
    const cfg = loadConfig();
    await ensureOpenClawModelsJson(cfg);
    const agentDir = resolveOpenClawAgentDir();
    const authStorage = discoverAuthStorage(agentDir);
    const modelRegistry = discoverModels(authStorage, agentDir);
    const models = modelRegistry.getAll();
    for (const m of models) {
      if (!m?.id) {
        continue;
      }
      if (typeof m.contextWindow === 'number' && m.contextWindow > 0) {
        MODEL_CACHE.set(m.id, m.contextWindow);
      }
    }
  } catch { /* ignored */ }
})();
function lookupContextTokens(modelId) {
  if (!modelId) {
    return void 0;
  }
  void loadPromise;
  return MODEL_CACHE.get(modelId);
}
export {
  lookupContextTokens
};
