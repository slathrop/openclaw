/**
 * GitHub Copilot model definitions and defaults.
 *
 * Provides the default list of Copilot model IDs and builds
 * model definition configs for use with the OpenAI-compatible
 * responses API.
 */

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8192;

// Copilot model ids vary by plan/org and can change.
// We keep this list intentionally broad; if a model isn't available Copilot will
// return an error and users can remove it from their config.
const DEFAULT_MODEL_IDS = [
  'gpt-4o',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o1',
  'o1-mini',
  'o3-mini'
];

/**
 * @returns {string[]}
 */
export const getDefaultCopilotModelIds = () => [...DEFAULT_MODEL_IDS];

/**
 * @param {string} modelId
 * @returns {import('../config/types.js').ModelDefinitionConfig}
 */
export const buildCopilotModelDefinition = (modelId) => {
  const id = modelId.trim();
  if (!id) {
    throw new Error('Model id required');
  }
  return {
    id,
    name: id,
    // pi-coding-agent's registry schema doesn't know about a "github-copilot" API.
    // We use OpenAI-compatible responses API, while keeping the provider id as
    // "github-copilot" (pi-ai uses that to attach Copilot-specific headers).
    api: 'openai-responses',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS
  };
};
