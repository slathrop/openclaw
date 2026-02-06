import { DEFAULT_PROVIDER } from '../agents/defaults.js';
import { resolveAllowlistModelKey } from '../agents/model-selection.js';

/**
 * Ensures the given model ref (and its canonical key) exist in the
 * agents.defaults.models allowlist so the model can be selected at runtime.
 * @param {{ cfg: import('../config/config.js').OpenClawConfig, modelRef: string, defaultProvider?: string }} params
 * @returns {import('../config/config.js').OpenClawConfig}
 */
export function ensureModelAllowlistEntry(params) {
  const rawModelRef = params.modelRef.trim();
  if (!rawModelRef) {
    return params.cfg;
  }

  const models = {...params.cfg.agents?.defaults?.models};
  const keySet = new Set([rawModelRef]);
  const canonicalKey = resolveAllowlistModelKey(
    rawModelRef,
    params.defaultProvider ?? DEFAULT_PROVIDER
  );
  if (canonicalKey) {
    keySet.add(canonicalKey);
  }

  for (const key of keySet) {
    models[key] = {
      ...models[key]
    };
  }

  return {
    ...params.cfg,
    agents: {
      ...params.cfg.agents,
      defaults: {
        ...params.cfg.agents?.defaults,
        models
      }
    }
  };
}
