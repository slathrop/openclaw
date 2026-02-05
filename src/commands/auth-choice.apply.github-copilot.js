const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: GitHub Copilot credential extraction and setup
import { githubCopilotLoginCommand } from '../providers/github-copilot-auth.js';
import { applyAuthProfileConfig } from './onboard-auth.js';
async function applyAuthChoiceGitHubCopilot(params) {
  if (params.authChoice !== 'github-copilot') {
    return null;
  }
  let nextConfig = params.config;
  await params.prompter.note(
    [
      'This will open a GitHub device login to authorize Copilot.',
      'Requires an active GitHub Copilot subscription.'
    ].join('\n'),
    'GitHub Copilot'
  );
  if (!process.stdin.isTTY) {
    await params.prompter.note(
      'GitHub Copilot login requires an interactive TTY.',
      'GitHub Copilot'
    );
    return { config: nextConfig };
  }
  try {
    await githubCopilotLoginCommand({ yes: true }, params.runtime);
  } catch (err) {
    await params.prompter.note(`GitHub Copilot login failed: ${String(err)}`, 'GitHub Copilot');
    return { config: nextConfig };
  }
  nextConfig = applyAuthProfileConfig(nextConfig, {
    profileId: 'github-copilot:github',
    provider: 'github-copilot',
    mode: 'token'
  });
  if (params.setDefaultModel) {
    const model = 'github-copilot/gpt-4o';
    nextConfig = {
      ...nextConfig,
      agents: {
        ...nextConfig.agents,
        defaults: {
          ...nextConfig.agents?.defaults,
          model: {
            ...typeof nextConfig.agents?.defaults?.model === 'object' ? nextConfig.agents.defaults.model : void 0,
            primary: model
          }
        }
      }
    };
    await params.prompter.note(`Default model set to ${model}`, 'Model configured');
  }
  return { config: nextConfig };
}
__name(applyAuthChoiceGitHubCopilot, 'applyAuthChoiceGitHubCopilot');
export {
  applyAuthChoiceGitHubCopilot
};
