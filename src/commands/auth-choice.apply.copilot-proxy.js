const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: GitHub Copilot proxy credential configuration
import { applyAuthChoicePluginProvider } from './auth-choice.apply.plugin-provider.js';
async function applyAuthChoiceCopilotProxy(params) {
  return await applyAuthChoicePluginProvider(params, {
    authChoice: 'copilot-proxy',
    pluginId: 'copilot-proxy',
    providerId: 'copilot-proxy',
    methodId: 'local',
    label: 'Copilot Proxy'
  });
}
__name(applyAuthChoiceCopilotProxy, 'applyAuthChoiceCopilotProxy');
export {
  applyAuthChoiceCopilotProxy
};
