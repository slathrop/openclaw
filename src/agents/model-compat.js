/**
 * @param model
 * @module model-compat
 * Model compatibility checking for feature-gated capabilities.
 */
function isOpenAiCompletionsModel(model) {
  return model.api === 'openai-completions';
}
function normalizeModelCompat(model) {
  const baseUrl = model.baseUrl ?? '';
  const isZai = model.provider === 'zai' || baseUrl.includes('api.z.ai');
  if (!isZai || !isOpenAiCompletionsModel(model)) {
    return model;
  }
  const openaiModel = model;
  const compat = openaiModel.compat ?? void 0;
  if (compat?.supportsDeveloperRole === false) {
    return model;
  }
  openaiModel.compat = compat ? { ...compat, supportsDeveloperRole: false } : { supportsDeveloperRole: false };
  return openaiModel;
}
export {
  normalizeModelCompat
};
