const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const GOOGLE_GEMINI_DEFAULT_MODEL = 'google/gemini-3-pro-preview';
function resolvePrimaryModel(model) {
  if (typeof model === 'string') {
    return model;
  }
  if (model && typeof model === 'object' && typeof model.primary === 'string') {
    return model.primary;
  }
  return void 0;
}
__name(resolvePrimaryModel, 'resolvePrimaryModel');
function applyGoogleGeminiModelDefault(cfg) {
  const current = resolvePrimaryModel(cfg.agents?.defaults?.model)?.trim();
  if (current === GOOGLE_GEMINI_DEFAULT_MODEL) {
    return { next: cfg, changed: false };
  }
  return {
    next: {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          model: cfg.agents?.defaults?.model && typeof cfg.agents.defaults.model === 'object' ? {
            ...cfg.agents.defaults.model,
            primary: GOOGLE_GEMINI_DEFAULT_MODEL
          } : { primary: GOOGLE_GEMINI_DEFAULT_MODEL }
        }
      }
    },
    changed: true
  };
}
__name(applyGoogleGeminiModelDefault, 'applyGoogleGeminiModelDefault');
export {
  GOOGLE_GEMINI_DEFAULT_MODEL,
  applyGoogleGeminiModelDefault
};
