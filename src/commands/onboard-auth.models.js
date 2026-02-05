const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Model provider credential verification
const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/v1';
const MINIMAX_API_BASE_URL = 'https://api.minimax.io/anthropic';
const MINIMAX_HOSTED_MODEL_ID = 'MiniMax-M2.1';
const MINIMAX_HOSTED_MODEL_REF = `minimax/${MINIMAX_HOSTED_MODEL_ID}`;
const DEFAULT_MINIMAX_CONTEXT_WINDOW = 2e5;
const DEFAULT_MINIMAX_MAX_TOKENS = 8192;
const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';
const MOONSHOT_CN_BASE_URL = 'https://api.moonshot.cn/v1';
const MOONSHOT_DEFAULT_MODEL_ID = 'kimi-k2.5';
const MOONSHOT_DEFAULT_MODEL_REF = `moonshot/${MOONSHOT_DEFAULT_MODEL_ID}`;
const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 256e3;
const MOONSHOT_DEFAULT_MAX_TOKENS = 8192;
const KIMI_CODING_MODEL_ID = 'k2p5';
const KIMI_CODING_MODEL_REF = `kimi-coding/${KIMI_CODING_MODEL_ID}`;
const MINIMAX_API_COST = {
  input: 15,
  output: 60,
  cacheRead: 2,
  cacheWrite: 10
};
const MINIMAX_HOSTED_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
const MINIMAX_LM_STUDIO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
const MOONSHOT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
const MINIMAX_MODEL_CATALOG = {
  'MiniMax-M2.1': { name: 'MiniMax M2.1', reasoning: false },
  'MiniMax-M2.1-lightning': {
    name: 'MiniMax M2.1 Lightning',
    reasoning: false
  }
};
function buildMinimaxModelDefinition(params) {
  const catalog = MINIMAX_MODEL_CATALOG[params.id];
  return {
    id: params.id,
    name: params.name ?? catalog?.name ?? `MiniMax ${params.id}`,
    reasoning: params.reasoning ?? catalog?.reasoning ?? false,
    input: ['text'],
    cost: params.cost,
    contextWindow: params.contextWindow,
    maxTokens: params.maxTokens
  };
}
__name(buildMinimaxModelDefinition, 'buildMinimaxModelDefinition');
function buildMinimaxApiModelDefinition(modelId) {
  return buildMinimaxModelDefinition({
    id: modelId,
    cost: MINIMAX_API_COST,
    contextWindow: DEFAULT_MINIMAX_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MINIMAX_MAX_TOKENS
  });
}
__name(buildMinimaxApiModelDefinition, 'buildMinimaxApiModelDefinition');
function buildMoonshotModelDefinition() {
  return {
    id: MOONSHOT_DEFAULT_MODEL_ID,
    name: 'Kimi K2.5',
    reasoning: false,
    input: ['text'],
    cost: MOONSHOT_DEFAULT_COST,
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS
  };
}
__name(buildMoonshotModelDefinition, 'buildMoonshotModelDefinition');
export {
  DEFAULT_MINIMAX_BASE_URL,
  DEFAULT_MINIMAX_CONTEXT_WINDOW,
  DEFAULT_MINIMAX_MAX_TOKENS,
  KIMI_CODING_MODEL_ID,
  KIMI_CODING_MODEL_REF,
  MINIMAX_API_BASE_URL,
  MINIMAX_API_COST,
  MINIMAX_HOSTED_COST,
  MINIMAX_HOSTED_MODEL_ID,
  MINIMAX_HOSTED_MODEL_REF,
  MINIMAX_LM_STUDIO_COST,
  MOONSHOT_BASE_URL,
  MOONSHOT_CN_BASE_URL,
  MOONSHOT_DEFAULT_CONTEXT_WINDOW,
  MOONSHOT_DEFAULT_COST,
  MOONSHOT_DEFAULT_MAX_TOKENS,
  MOONSHOT_DEFAULT_MODEL_ID,
  MOONSHOT_DEFAULT_MODEL_REF,
  buildMinimaxApiModelDefinition,
  buildMinimaxModelDefinition,
  buildMoonshotModelDefinition
};
