const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Google AI credential setup via antigravity flow
import { applyAuthChoicePluginProvider } from './auth-choice.apply.plugin-provider.js';
async function applyAuthChoiceGoogleAntigravity(params) {
  return await applyAuthChoicePluginProvider(params, {
    authChoice: 'google-antigravity',
    pluginId: 'google-antigravity-auth',
    providerId: 'google-antigravity',
    methodId: 'oauth',
    label: 'Google Antigravity'
  });
}
__name(applyAuthChoiceGoogleAntigravity, 'applyAuthChoiceGoogleAntigravity');
export {
  applyAuthChoiceGoogleAntigravity
};
