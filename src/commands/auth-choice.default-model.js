import { ensureModelAllowlistEntry } from './model-allowlist.js';

// SECURITY: Default model resolution tied to auth provider
async function applyDefaultModelChoice(params) {
  if (params.setDefaultModel) {
    const next2 = params.applyDefaultConfig(params.config);
    if (params.noteDefault) {
      await params.prompter.note(`Default model set to ${params.noteDefault}`, 'Model configured');
    }
    return { config: next2 };
  }
  const next = params.applyProviderConfig(params.config);
  const nextWithModel = ensureModelAllowlistEntry({
    cfg: next,
    modelRef: params.defaultModel
  });
  await params.noteAgentModel(params.defaultModel);
  return { config: nextWithModel, agentModelOverride: params.defaultModel };
}
export {
  applyDefaultModelChoice
};
