const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Gateway authentication configuration (token/password setup)
import { ensureAuthProfileStore } from '../agents/auth-profiles.js';
import { promptAuthChoiceGrouped } from './auth-choice-prompt.js';
import { applyAuthChoice, resolvePreferredProviderForAuthChoice } from './auth-choice.js';
import {
  applyModelAllowlist,
  applyModelFallbacksFromSelection,
  applyPrimaryModel,
  promptDefaultModel,
  promptModelAllowlist
} from './model-picker.js';
const ANTHROPIC_OAUTH_MODEL_KEYS = [
  'anthropic/claude-opus-4-6',
  'anthropic/claude-opus-4-5',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-haiku-4-5'
];
function buildGatewayAuthConfig(params) {
  const allowTailscale = params.existing?.allowTailscale;
  const base = {};
  if (typeof allowTailscale === 'boolean') {
    base.allowTailscale = allowTailscale;
  }
  if (params.mode === 'token') {
    return { ...base, mode: 'token', token: params.token };
  }
  return { ...base, mode: 'password', password: params.password };
}
__name(buildGatewayAuthConfig, 'buildGatewayAuthConfig');
async function promptAuthConfig(cfg, runtime, prompter) {
  const authChoice = await promptAuthChoiceGrouped({
    prompter,
    store: ensureAuthProfileStore(void 0, {
      allowKeychainPrompt: false
    }),
    includeSkip: true
  });
  let next = cfg;
  if (authChoice !== 'skip') {
    const applied = await applyAuthChoice({
      authChoice,
      config: next,
      prompter,
      runtime,
      setDefaultModel: true
    });
    next = applied.config;
  } else {
    const modelSelection = await promptDefaultModel({
      config: next,
      prompter,
      allowKeep: true,
      ignoreAllowlist: true,
      preferredProvider: resolvePreferredProviderForAuthChoice(authChoice)
    });
    if (modelSelection.model) {
      next = applyPrimaryModel(next, modelSelection.model);
    }
  }
  const anthropicOAuth = authChoice === 'setup-token' || authChoice === 'token' || authChoice === 'oauth';
  const allowlistSelection = await promptModelAllowlist({
    config: next,
    prompter,
    allowedKeys: anthropicOAuth ? ANTHROPIC_OAUTH_MODEL_KEYS : void 0,
    initialSelections: anthropicOAuth ? ['anthropic/claude-opus-4-6'] : void 0,
    message: anthropicOAuth ? 'Anthropic OAuth models' : void 0
  });
  if (allowlistSelection.models) {
    next = applyModelAllowlist(next, allowlistSelection.models);
    next = applyModelFallbacksFromSelection(next, allowlistSelection.models);
  }
  return next;
}
__name(promptAuthConfig, 'promptAuthConfig');
export {
  buildGatewayAuthConfig,
  promptAuthConfig
};
