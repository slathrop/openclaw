const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Google Gemini CLI credential extraction
import { applyAuthChoicePluginProvider } from './auth-choice.apply.plugin-provider.js';
async function applyAuthChoiceGoogleGeminiCli(params) {
  return await applyAuthChoicePluginProvider(params, {
    authChoice: 'google-gemini-cli',
    pluginId: 'google-gemini-cli-auth',
    providerId: 'google-gemini-cli',
    methodId: 'oauth',
    label: 'Google Gemini CLI'
  });
}
__name(applyAuthChoiceGoogleGeminiCli, 'applyAuthChoiceGoogleGeminiCli');
export {
  applyAuthChoiceGoogleGeminiCli
};
