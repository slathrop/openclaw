const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Qwen Portal API credential setup
import { applyAuthChoicePluginProvider } from './auth-choice.apply.plugin-provider.js';
async function applyAuthChoiceQwenPortal(params) {
  return await applyAuthChoicePluginProvider(params, {
    authChoice: 'qwen-portal',
    pluginId: 'qwen-portal-auth',
    providerId: 'qwen-portal',
    methodId: 'device',
    label: 'Qwen'
  });
}
__name(applyAuthChoiceQwenPortal, 'applyAuthChoiceQwenPortal');
export {
  applyAuthChoiceQwenPortal
};
