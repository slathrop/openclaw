const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { logConfigUpdated } from '../../config/logging.js';
import { resolveModelTarget, updateConfig } from './shared.js';
async function modelsSetImageCommand(modelRaw, runtime) {
  const updated = await updateConfig((cfg) => {
    const resolved = resolveModelTarget({ raw: modelRaw, cfg });
    const key = `${resolved.provider}/${resolved.model}`;
    const nextModels = { ...cfg.agents?.defaults?.models };
    if (!nextModels[key]) {
      nextModels[key] = {};
    }
    const existingModel = cfg.agents?.defaults?.imageModel;
    return {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          imageModel: {
            ...existingModel?.fallbacks ? { fallbacks: existingModel.fallbacks } : void 0,
            primary: key
          },
          models: nextModels
        }
      }
    };
  });
  logConfigUpdated(runtime);
  runtime.log(`Image model: ${updated.agents?.defaults?.imageModel?.primary ?? modelRaw}`);
}
__name(modelsSetImageCommand, 'modelsSetImageCommand');
export {
  modelsSetImageCommand
};
