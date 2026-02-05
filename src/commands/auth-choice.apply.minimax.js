const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: MiniMax API credential setup
import { resolveEnvApiKey } from '../agents/model-auth.js';
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput
} from './auth-choice.api-key.js';
import { applyAuthChoicePluginProvider } from './auth-choice.apply.plugin-provider.js';
import { applyDefaultModelChoice } from './auth-choice.default-model.js';
import {
  applyAuthProfileConfig,
  applyMinimaxApiConfig,
  applyMinimaxApiProviderConfig,
  applyMinimaxConfig,
  applyMinimaxProviderConfig,
  setMinimaxApiKey
} from './onboard-auth.js';
async function applyAuthChoiceMiniMax(params) {
  let nextConfig = params.config;
  let agentModelOverride;
  const noteAgentModel = /* @__PURE__ */ __name(async (model) => {
    if (!params.agentId) {
      return;
    }
    await params.prompter.note(
      `Default model set to ${model} for agent "${params.agentId}".`,
      'Model configured'
    );
  }, 'noteAgentModel');
  if (params.authChoice === 'minimax-portal') {
    const endpoint = await params.prompter.select({
      message: 'Select MiniMax endpoint',
      options: [
        { value: 'oauth', label: 'Global', hint: 'OAuth for international users' },
        { value: 'oauth-cn', label: 'CN', hint: 'OAuth for users in China' }
      ]
    });
    return await applyAuthChoicePluginProvider(params, {
      authChoice: 'minimax-portal',
      pluginId: 'minimax-portal-auth',
      providerId: 'minimax-portal',
      methodId: endpoint,
      label: 'MiniMax'
    });
  }
  if (params.authChoice === 'minimax-cloud' || params.authChoice === 'minimax-api' || params.authChoice === 'minimax-api-lightning') {
    const modelId = params.authChoice === 'minimax-api-lightning' ? 'MiniMax-M2.1-lightning' : 'MiniMax-M2.1';
    let hasCredential = false;
    const envKey = resolveEnvApiKey('minimax');
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `Use existing MINIMAX_API_KEY (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true
      });
      if (useExisting) {
        await setMinimaxApiKey(envKey.apiKey, params.agentDir);
        hasCredential = true;
      }
    }
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: 'Enter MiniMax API key',
        validate: validateApiKeyInput
      });
      await setMinimaxApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: 'minimax:default',
      provider: 'minimax',
      mode: 'api_key'
    });
    {
      const modelRef = `minimax/${modelId}`;
      const applied = await applyDefaultModelChoice({
        config: nextConfig,
        setDefaultModel: params.setDefaultModel,
        defaultModel: modelRef,
        applyDefaultConfig: /* @__PURE__ */ __name((config) => applyMinimaxApiConfig(config, modelId), 'applyDefaultConfig'),
        applyProviderConfig: /* @__PURE__ */ __name((config) => applyMinimaxApiProviderConfig(config, modelId), 'applyProviderConfig'),
        noteAgentModel,
        prompter: params.prompter
      });
      nextConfig = applied.config;
      agentModelOverride = applied.agentModelOverride ?? agentModelOverride;
    }
    return { config: nextConfig, agentModelOverride };
  }
  if (params.authChoice === 'minimax') {
    const applied = await applyDefaultModelChoice({
      config: nextConfig,
      setDefaultModel: params.setDefaultModel,
      defaultModel: 'lmstudio/minimax-m2.1-gs32',
      applyDefaultConfig: applyMinimaxConfig,
      applyProviderConfig: applyMinimaxProviderConfig,
      noteAgentModel,
      prompter: params.prompter
    });
    nextConfig = applied.config;
    agentModelOverride = applied.agentModelOverride ?? agentModelOverride;
    return { config: nextConfig, agentModelOverride };
  }
  return null;
}
__name(applyAuthChoiceMiniMax, 'applyAuthChoiceMiniMax');
export {
  applyAuthChoiceMiniMax
};
