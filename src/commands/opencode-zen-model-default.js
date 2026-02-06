const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const OPENCODE_ZEN_DEFAULT_MODEL = 'opencode/claude-opus-4-6';
const LEGACY_OPENCODE_ZEN_DEFAULT_MODELS = new Set([
  'opencode/claude-opus-4-5',
  'opencode-zen/claude-opus-4-5'
]);
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
function applyOpencodeZenModelDefault(cfg) {
  const current = resolvePrimaryModel(cfg.agents?.defaults?.model)?.trim();
  const normalizedCurrent = current && LEGACY_OPENCODE_ZEN_DEFAULT_MODELS.has(current) ? OPENCODE_ZEN_DEFAULT_MODEL : current;
  if (normalizedCurrent === OPENCODE_ZEN_DEFAULT_MODEL) {
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
            primary: OPENCODE_ZEN_DEFAULT_MODEL
          } : { primary: OPENCODE_ZEN_DEFAULT_MODEL }
        }
      }
    },
    changed: true
  };
}
__name(applyOpencodeZenModelDefault, 'applyOpencodeZenModelDefault');
export {
  OPENCODE_ZEN_DEFAULT_MODEL,
  applyOpencodeZenModelDefault
};
