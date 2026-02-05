/**
 * Extra parameter resolution for Pi embedded runner API calls.
 * @module agents/pi-embedded-runner/extra-params
 */
import { streamSimple } from '@mariozechner/pi-ai';
import { log } from './logger.js';
const OPENROUTER_APP_HEADERS = {
  'HTTP-Referer': 'https://openclaw.ai',
  'X-Title': 'OpenClaw'
};
function resolveExtraParams(params) {
  const modelKey = `${params.provider}/${params.modelId}`;
  const modelConfig = params.cfg?.agents?.defaults?.models?.[modelKey];
  return modelConfig?.params ? { ...modelConfig.params } : void 0;
}
function resolveCacheRetention(extraParams, provider) {
  if (provider !== 'anthropic') {
    return void 0;
  }
  const newVal = extraParams?.cacheRetention;
  if (newVal === 'none' || newVal === 'short' || newVal === 'long') {
    return newVal;
  }
  const legacy = extraParams?.cacheControlTtl;
  if (legacy === '5m') {
    return 'short';
  }
  if (legacy === '1h') {
    return 'long';
  }
  return void 0;
}
function createStreamFnWithExtraParams(baseStreamFn, extraParams, provider) {
  if (!extraParams || Object.keys(extraParams).length === 0) {
    return void 0;
  }
  const streamParams = {};
  if (typeof extraParams.temperature === 'number') {
    streamParams.temperature = extraParams.temperature;
  }
  if (typeof extraParams.maxTokens === 'number') {
    streamParams.maxTokens = extraParams.maxTokens;
  }
  const cacheRetention = resolveCacheRetention(extraParams, provider);
  if (cacheRetention) {
    streamParams.cacheRetention = cacheRetention;
  }
  if (Object.keys(streamParams).length === 0) {
    return void 0;
  }
  log.debug(`creating streamFn wrapper with params: ${JSON.stringify(streamParams)}`);
  const underlying = baseStreamFn ?? streamSimple;
  const wrappedStreamFn = (model, context, options) => underlying(model, context, {
    ...streamParams,
    ...options
  });
  return wrappedStreamFn;
}
function createOpenRouterHeadersWrapper(baseStreamFn) {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) => underlying(model, context, {
    ...options,
    headers: {
      ...OPENROUTER_APP_HEADERS,
      ...options?.headers
    }
  });
}
function applyExtraParamsToAgent(agent, cfg, provider, modelId, extraParamsOverride) {
  const extraParams = resolveExtraParams({
    cfg,
    provider,
    modelId
  });
  const override = extraParamsOverride && Object.keys(extraParamsOverride).length > 0 ? Object.fromEntries(
    Object.entries(extraParamsOverride).filter(([, value]) => value !== void 0)
  ) : void 0;
  const merged = Object.assign({}, extraParams, override);
  const wrappedStreamFn = createStreamFnWithExtraParams(agent.streamFn, merged, provider);
  if (wrappedStreamFn) {
    log.debug(`applying extraParams to agent streamFn for ${provider}/${modelId}`);
    agent.streamFn = wrappedStreamFn;
  }
  if (provider === 'openrouter') {
    log.debug(`applying OpenRouter app attribution headers for ${provider}/${modelId}`);
    agent.streamFn = createOpenRouterHeadersWrapper(agent.streamFn);
  }
}
export {
  applyExtraParamsToAgent,
  resolveExtraParams
};
