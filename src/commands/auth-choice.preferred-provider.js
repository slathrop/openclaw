const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Preferred provider selection from credential state
const PREFERRED_PROVIDER_BY_AUTH_CHOICE = {
  oauth: 'anthropic',
  'setup-token': 'anthropic',
  'claude-cli': 'anthropic',
  token: 'anthropic',
  apiKey: 'anthropic',
  'openai-codex': 'openai-codex',
  'codex-cli': 'openai-codex',
  chutes: 'chutes',
  'openai-api-key': 'openai',
  'openrouter-api-key': 'openrouter',
  'ai-gateway-api-key': 'vercel-ai-gateway',
  'cloudflare-ai-gateway-api-key': 'cloudflare-ai-gateway',
  'moonshot-api-key': 'moonshot',
  'moonshot-api-key-cn': 'moonshot',
  'kimi-code-api-key': 'kimi-coding',
  'gemini-api-key': 'google',
  'google-antigravity': 'google-antigravity',
  'google-gemini-cli': 'google-gemini-cli',
  'zai-api-key': 'zai',
  'xiaomi-api-key': 'xiaomi',
  'synthetic-api-key': 'synthetic',
  'venice-api-key': 'venice',
  'github-copilot': 'github-copilot',
  'copilot-proxy': 'copilot-proxy',
  'minimax-cloud': 'minimax',
  'minimax-api': 'minimax',
  'minimax-api-lightning': 'minimax',
  minimax: 'lmstudio',
  'opencode-zen': 'opencode',
  'qwen-portal': 'qwen-portal',
  'minimax-portal': 'minimax-portal'
};
function resolvePreferredProviderForAuthChoice(choice) {
  return PREFERRED_PROVIDER_BY_AUTH_CHOICE[choice];
}
__name(resolvePreferredProviderForAuthChoice, 'resolvePreferredProviderForAuthChoice');
export {
  resolvePreferredProviderForAuthChoice
};
