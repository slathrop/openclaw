const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: OpenCode auth configuration during onboarding
import { OPENCODE_ZEN_DEFAULT_MODEL_REF } from '../agents/opencode-zen-models.js';
function applyOpencodeZenProviderConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[OPENCODE_ZEN_DEFAULT_MODEL_REF] = {
    ...models[OPENCODE_ZEN_DEFAULT_MODEL_REF],
    alias: models[OPENCODE_ZEN_DEFAULT_MODEL_REF]?.alias ?? 'Opus'
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    }
  };
}
__name(applyOpencodeZenProviderConfig, 'applyOpencodeZenProviderConfig');
function applyOpencodeZenConfig(cfg) {
  const next = applyOpencodeZenProviderConfig(cfg);
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...next.agents?.defaults?.model && 'fallbacks' in next.agents.defaults.model ? {
            fallbacks: next.agents.defaults.model.fallbacks
          } : void 0,
          primary: OPENCODE_ZEN_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyOpencodeZenConfig, 'applyOpencodeZenConfig');
export {
  applyOpencodeZenConfig,
  applyOpencodeZenProviderConfig
};
