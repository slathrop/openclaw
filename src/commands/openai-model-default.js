import { ensureModelAllowlistEntry } from './model-allowlist.js';

export const OPENAI_DEFAULT_MODEL = 'openai/gpt-5.1-codex';

/**
 * Adds the OpenAI default model to the allowlist and sets its alias.
 * @param {import('../config/config.js').OpenClawConfig} cfg
 * @returns {import('../config/config.js').OpenClawConfig}
 */
export function applyOpenAIProviderConfig(cfg) {
  const next = ensureModelAllowlistEntry({
    cfg,
    modelRef: OPENAI_DEFAULT_MODEL
  });
  const models = {...next.agents?.defaults?.models};
  models[OPENAI_DEFAULT_MODEL] = {
    ...models[OPENAI_DEFAULT_MODEL],
    alias: models[OPENAI_DEFAULT_MODEL]?.alias ?? 'GPT'
  };

  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        models
      }
    }
  };
}

/**
 * Applies the OpenAI default model to both the allowlist and model.primary.
 * @param {import('../config/config.js').OpenClawConfig} cfg
 * @returns {import('../config/config.js').OpenClawConfig}
 */
export function applyOpenAIConfig(cfg) {
  const next = applyOpenAIProviderConfig(cfg);
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model:
          next.agents?.defaults?.model && typeof next.agents.defaults.model === 'object'
            ? {
              ...next.agents.defaults.model,
              primary: OPENAI_DEFAULT_MODEL
            }
            : {primary: OPENAI_DEFAULT_MODEL}
      }
    }
  };
}
