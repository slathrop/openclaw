/**
 * Infer auth choice from non-interactive API key flags.
 * @module commands/onboard-non-interactive/local/auth-choice-inference
 */

/**
 * @typedef {{ flag: string, authChoice: string, label: string }} AuthChoiceFlag
 */

/**
 * @typedef {{ choice?: string, matches: AuthChoiceFlag[] }} AuthChoiceInference
 */

const AUTH_CHOICE_FLAG_MAP = [
  { flag: 'anthropicApiKey', authChoice: 'apiKey', label: '--anthropic-api-key' },
  { flag: 'geminiApiKey', authChoice: 'gemini-api-key', label: '--gemini-api-key' },
  { flag: 'openaiApiKey', authChoice: 'openai-api-key', label: '--openai-api-key' },
  { flag: 'openrouterApiKey', authChoice: 'openrouter-api-key', label: '--openrouter-api-key' },
  { flag: 'aiGatewayApiKey', authChoice: 'ai-gateway-api-key', label: '--ai-gateway-api-key' },
  {
    flag: 'cloudflareAiGatewayApiKey',
    authChoice: 'cloudflare-ai-gateway-api-key',
    label: '--cloudflare-ai-gateway-api-key'
  },
  { flag: 'moonshotApiKey', authChoice: 'moonshot-api-key', label: '--moonshot-api-key' },
  { flag: 'kimiCodeApiKey', authChoice: 'kimi-code-api-key', label: '--kimi-code-api-key' },
  { flag: 'syntheticApiKey', authChoice: 'synthetic-api-key', label: '--synthetic-api-key' },
  { flag: 'veniceApiKey', authChoice: 'venice-api-key', label: '--venice-api-key' },
  { flag: 'zaiApiKey', authChoice: 'zai-api-key', label: '--zai-api-key' },
  { flag: 'xiaomiApiKey', authChoice: 'xiaomi-api-key', label: '--xiaomi-api-key' },
  { flag: 'minimaxApiKey', authChoice: 'minimax-api', label: '--minimax-api-key' },
  { flag: 'opencodeZenApiKey', authChoice: 'opencode-zen', label: '--opencode-zen-api-key' }
];

/**
 * Infer auth choice from explicit provider API key flags.
 * @param {import('../../onboard-types.js').OnboardOptions} opts
 * @returns {AuthChoiceInference}
 */
function inferAuthChoiceFromFlags(opts) {
  const matches = AUTH_CHOICE_FLAG_MAP.filter(({ flag }) => {
    const value = opts[flag];
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return Boolean(value);
  });

  return {
    choice: matches[0]?.authChoice,
    matches
  };
}

export { inferAuthChoiceFromFlags };
