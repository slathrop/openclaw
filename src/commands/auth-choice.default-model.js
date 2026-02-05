const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
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
  await params.noteAgentModel(params.defaultModel);
  return { config: next, agentModelOverride: params.defaultModel };
}
__name(applyDefaultModelChoice, 'applyDefaultModelChoice');
export {
  applyDefaultModelChoice
};
