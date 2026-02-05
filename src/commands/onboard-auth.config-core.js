const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Core auth configuration during onboarding
import {
  buildCloudflareAiGatewayModelDefinition,
  resolveCloudflareAiGatewayBaseUrl
} from '../agents/cloudflare-ai-gateway.js';
import { buildXiaomiProvider, XIAOMI_DEFAULT_MODEL_ID } from '../agents/models-config.providers.js';
import {
  buildSyntheticModelDefinition,
  SYNTHETIC_BASE_URL,
  SYNTHETIC_DEFAULT_MODEL_REF,
  SYNTHETIC_MODEL_CATALOG
} from '../agents/synthetic-models.js';
import {
  buildVeniceModelDefinition,
  VENICE_BASE_URL,
  VENICE_DEFAULT_MODEL_REF,
  VENICE_MODEL_CATALOG
} from '../agents/venice-models.js';
import {
  CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF,
  OPENROUTER_DEFAULT_MODEL_REF,
  VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF,
  XIAOMI_DEFAULT_MODEL_REF,
  ZAI_DEFAULT_MODEL_REF
} from './onboard-auth.credentials.js';
import {
  buildMoonshotModelDefinition,
  KIMI_CODING_MODEL_REF,
  MOONSHOT_BASE_URL,
  MOONSHOT_CN_BASE_URL,
  MOONSHOT_DEFAULT_MODEL_ID,
  MOONSHOT_DEFAULT_MODEL_REF
} from './onboard-auth.models.js';
function applyZaiConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[ZAI_DEFAULT_MODEL_REF] = {
    ...models[ZAI_DEFAULT_MODEL_REF],
    alias: models[ZAI_DEFAULT_MODEL_REF]?.alias ?? 'GLM'
  };
  const existingModel = cfg.agents?.defaults?.model;
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: ZAI_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyZaiConfig, 'applyZaiConfig');
function applyOpenrouterProviderConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[OPENROUTER_DEFAULT_MODEL_REF] = {
    ...models[OPENROUTER_DEFAULT_MODEL_REF],
    alias: models[OPENROUTER_DEFAULT_MODEL_REF]?.alias ?? 'OpenRouter'
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    }
  };
}
__name(applyOpenrouterProviderConfig, 'applyOpenrouterProviderConfig');
function applyVercelAiGatewayProviderConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF] = {
    ...models[VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF],
    alias: models[VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF]?.alias ?? 'Vercel AI Gateway'
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    }
  };
}
__name(applyVercelAiGatewayProviderConfig, 'applyVercelAiGatewayProviderConfig');
function applyCloudflareAiGatewayProviderConfig(cfg, params) {
  const models = { ...cfg.agents?.defaults?.models };
  models[CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF] = {
    ...models[CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF],
    alias: models[CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF]?.alias ?? 'Cloudflare AI Gateway'
  };
  const providers = { ...cfg.models?.providers };
  const existingProvider = providers['cloudflare-ai-gateway'];
  const existingModels = Array.isArray(existingProvider?.models) ? existingProvider.models : [];
  const defaultModel = buildCloudflareAiGatewayModelDefinition();
  const hasDefaultModel = existingModels.some((model) => model.id === defaultModel.id);
  const mergedModels = hasDefaultModel ? existingModels : [...existingModels, defaultModel];
  const baseUrl = params?.accountId && params?.gatewayId ? resolveCloudflareAiGatewayBaseUrl({
    accountId: params.accountId,
    gatewayId: params.gatewayId
  }) : existingProvider?.baseUrl;
  if (!baseUrl) {
    return {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          models
        }
      }
    };
  }
  const { apiKey: existingApiKey, ...existingProviderRest } = existingProvider ?? {};
  const resolvedApiKey = typeof existingApiKey === 'string' ? existingApiKey : void 0;
  const normalizedApiKey = resolvedApiKey?.trim();
  providers['cloudflare-ai-gateway'] = {
    ...existingProviderRest,
    baseUrl,
    api: 'anthropic-messages',
    ...normalizedApiKey ? { apiKey: normalizedApiKey } : {},
    models: mergedModels.length > 0 ? mergedModels : [defaultModel]
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    },
    models: {
      mode: cfg.models?.mode ?? 'merge',
      providers
    }
  };
}
__name(applyCloudflareAiGatewayProviderConfig, 'applyCloudflareAiGatewayProviderConfig');
function applyVercelAiGatewayConfig(cfg) {
  const next = applyVercelAiGatewayProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyVercelAiGatewayConfig, 'applyVercelAiGatewayConfig');
function applyCloudflareAiGatewayConfig(cfg, params) {
  const next = applyCloudflareAiGatewayProviderConfig(cfg, params);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyCloudflareAiGatewayConfig, 'applyCloudflareAiGatewayConfig');
function applyOpenrouterConfig(cfg) {
  const next = applyOpenrouterProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: OPENROUTER_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyOpenrouterConfig, 'applyOpenrouterConfig');
function applyMoonshotProviderConfig(cfg) {
  return applyMoonshotProviderConfigWithBaseUrl(cfg, MOONSHOT_BASE_URL);
}
__name(applyMoonshotProviderConfig, 'applyMoonshotProviderConfig');
function applyMoonshotProviderConfigCn(cfg) {
  return applyMoonshotProviderConfigWithBaseUrl(cfg, MOONSHOT_CN_BASE_URL);
}
__name(applyMoonshotProviderConfigCn, 'applyMoonshotProviderConfigCn');
function applyMoonshotProviderConfigWithBaseUrl(cfg, baseUrl) {
  const models = { ...cfg.agents?.defaults?.models };
  models[MOONSHOT_DEFAULT_MODEL_REF] = {
    ...models[MOONSHOT_DEFAULT_MODEL_REF],
    alias: models[MOONSHOT_DEFAULT_MODEL_REF]?.alias ?? 'Kimi'
  };
  const providers = { ...cfg.models?.providers };
  const existingProvider = providers.moonshot;
  const existingModels = Array.isArray(existingProvider?.models) ? existingProvider.models : [];
  const defaultModel = buildMoonshotModelDefinition();
  const hasDefaultModel = existingModels.some((model) => model.id === MOONSHOT_DEFAULT_MODEL_ID);
  const mergedModels = hasDefaultModel ? existingModels : [...existingModels, defaultModel];
  const { apiKey: existingApiKey, ...existingProviderRest } = existingProvider ?? {};
  const resolvedApiKey = typeof existingApiKey === 'string' ? existingApiKey : void 0;
  const normalizedApiKey = resolvedApiKey?.trim();
  providers.moonshot = {
    ...existingProviderRest,
    baseUrl,
    api: 'openai-completions',
    ...normalizedApiKey ? { apiKey: normalizedApiKey } : {},
    models: mergedModels.length > 0 ? mergedModels : [defaultModel]
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    },
    models: {
      mode: cfg.models?.mode ?? 'merge',
      providers
    }
  };
}
__name(applyMoonshotProviderConfigWithBaseUrl, 'applyMoonshotProviderConfigWithBaseUrl');
function applyMoonshotConfig(cfg) {
  const next = applyMoonshotProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: MOONSHOT_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyMoonshotConfig, 'applyMoonshotConfig');
function applyMoonshotConfigCn(cfg) {
  const next = applyMoonshotProviderConfigCn(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: MOONSHOT_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyMoonshotConfigCn, 'applyMoonshotConfigCn');
function applyKimiCodeProviderConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[KIMI_CODING_MODEL_REF] = {
    ...models[KIMI_CODING_MODEL_REF],
    alias: models[KIMI_CODING_MODEL_REF]?.alias ?? 'Kimi K2.5'
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    }
  };
}
__name(applyKimiCodeProviderConfig, 'applyKimiCodeProviderConfig');
function applyKimiCodeConfig(cfg) {
  const next = applyKimiCodeProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: KIMI_CODING_MODEL_REF
        }
      }
    }
  };
}
__name(applyKimiCodeConfig, 'applyKimiCodeConfig');
function applySyntheticProviderConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[SYNTHETIC_DEFAULT_MODEL_REF] = {
    ...models[SYNTHETIC_DEFAULT_MODEL_REF],
    alias: models[SYNTHETIC_DEFAULT_MODEL_REF]?.alias ?? 'MiniMax M2.1'
  };
  const providers = { ...cfg.models?.providers };
  const existingProvider = providers.synthetic;
  const existingModels = Array.isArray(existingProvider?.models) ? existingProvider.models : [];
  const syntheticModels = SYNTHETIC_MODEL_CATALOG.map(buildSyntheticModelDefinition);
  const mergedModels = [
    ...existingModels,
    ...syntheticModels.filter(
      (model) => !existingModels.some((existing) => existing.id === model.id)
    )
  ];
  const { apiKey: existingApiKey, ...existingProviderRest } = existingProvider ?? {};
  const resolvedApiKey = typeof existingApiKey === 'string' ? existingApiKey : void 0;
  const normalizedApiKey = resolvedApiKey?.trim();
  providers.synthetic = {
    ...existingProviderRest,
    baseUrl: SYNTHETIC_BASE_URL,
    api: 'anthropic-messages',
    ...normalizedApiKey ? { apiKey: normalizedApiKey } : {},
    models: mergedModels.length > 0 ? mergedModels : syntheticModels
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    },
    models: {
      mode: cfg.models?.mode ?? 'merge',
      providers
    }
  };
}
__name(applySyntheticProviderConfig, 'applySyntheticProviderConfig');
function applySyntheticConfig(cfg) {
  const next = applySyntheticProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: SYNTHETIC_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applySyntheticConfig, 'applySyntheticConfig');
function applyXiaomiProviderConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[XIAOMI_DEFAULT_MODEL_REF] = {
    ...models[XIAOMI_DEFAULT_MODEL_REF],
    alias: models[XIAOMI_DEFAULT_MODEL_REF]?.alias ?? 'Xiaomi'
  };
  const providers = { ...cfg.models?.providers };
  const existingProvider = providers.xiaomi;
  const defaultProvider = buildXiaomiProvider();
  const existingModels = Array.isArray(existingProvider?.models) ? existingProvider.models : [];
  const defaultModels = defaultProvider.models ?? [];
  const hasDefaultModel = existingModels.some((model) => model.id === XIAOMI_DEFAULT_MODEL_ID);
  const mergedModels = existingModels.length > 0 ? hasDefaultModel ? existingModels : [...existingModels, ...defaultModels] : defaultModels;
  const { apiKey: existingApiKey, ...existingProviderRest } = existingProvider ?? {};
  const resolvedApiKey = typeof existingApiKey === 'string' ? existingApiKey : void 0;
  const normalizedApiKey = resolvedApiKey?.trim();
  providers.xiaomi = {
    ...existingProviderRest,
    baseUrl: defaultProvider.baseUrl,
    api: defaultProvider.api,
    ...normalizedApiKey ? { apiKey: normalizedApiKey } : {},
    models: mergedModels.length > 0 ? mergedModels : defaultProvider.models
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    },
    models: {
      mode: cfg.models?.mode ?? 'merge',
      providers
    }
  };
}
__name(applyXiaomiProviderConfig, 'applyXiaomiProviderConfig');
function applyXiaomiConfig(cfg) {
  const next = applyXiaomiProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: XIAOMI_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyXiaomiConfig, 'applyXiaomiConfig');
function applyVeniceProviderConfig(cfg) {
  const models = { ...cfg.agents?.defaults?.models };
  models[VENICE_DEFAULT_MODEL_REF] = {
    ...models[VENICE_DEFAULT_MODEL_REF],
    alias: models[VENICE_DEFAULT_MODEL_REF]?.alias ?? 'Llama 3.3 70B'
  };
  const providers = { ...cfg.models?.providers };
  const existingProvider = providers.venice;
  const existingModels = Array.isArray(existingProvider?.models) ? existingProvider.models : [];
  const veniceModels = VENICE_MODEL_CATALOG.map(buildVeniceModelDefinition);
  const mergedModels = [
    ...existingModels,
    ...veniceModels.filter((model) => !existingModels.some((existing) => existing.id === model.id))
  ];
  const { apiKey: existingApiKey, ...existingProviderRest } = existingProvider ?? {};
  const resolvedApiKey = typeof existingApiKey === 'string' ? existingApiKey : void 0;
  const normalizedApiKey = resolvedApiKey?.trim();
  providers.venice = {
    ...existingProviderRest,
    baseUrl: VENICE_BASE_URL,
    api: 'openai-completions',
    ...normalizedApiKey ? { apiKey: normalizedApiKey } : {},
    models: mergedModels.length > 0 ? mergedModels : veniceModels
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models
      }
    },
    models: {
      mode: cfg.models?.mode ?? 'merge',
      providers
    }
  };
}
__name(applyVeniceProviderConfig, 'applyVeniceProviderConfig');
function applyVeniceConfig(cfg) {
  const next = applyVeniceProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...existingModel && 'fallbacks' in existingModel ? {
            fallbacks: existingModel.fallbacks
          } : void 0,
          primary: VENICE_DEFAULT_MODEL_REF
        }
      }
    }
  };
}
__name(applyVeniceConfig, 'applyVeniceConfig');
function applyAuthProfileConfig(cfg, params) {
  const profiles = {
    ...cfg.auth?.profiles,
    [params.profileId]: {
      provider: params.provider,
      mode: params.mode,
      ...params.email ? { email: params.email } : {}
    }
  };
  const existingProviderOrder = cfg.auth?.order?.[params.provider];
  const preferProfileFirst = params.preferProfileFirst ?? true;
  const reorderedProviderOrder = existingProviderOrder && preferProfileFirst ? [
    params.profileId,
    ...existingProviderOrder.filter((profileId) => profileId !== params.profileId)
  ] : existingProviderOrder;
  const order = existingProviderOrder !== void 0 ? {
    ...cfg.auth?.order,
    [params.provider]: reorderedProviderOrder?.includes(params.profileId) ? reorderedProviderOrder : [...reorderedProviderOrder ?? [], params.profileId]
  } : cfg.auth?.order;
  return {
    ...cfg,
    auth: {
      ...cfg.auth,
      profiles,
      ...order ? { order } : {}
    }
  };
}
__name(applyAuthProfileConfig, 'applyAuthProfileConfig');
export {
  applyAuthProfileConfig,
  applyCloudflareAiGatewayConfig,
  applyCloudflareAiGatewayProviderConfig,
  applyKimiCodeConfig,
  applyKimiCodeProviderConfig,
  applyMoonshotConfig,
  applyMoonshotConfigCn,
  applyMoonshotProviderConfig,
  applyMoonshotProviderConfigCn,
  applyOpenrouterConfig,
  applyOpenrouterProviderConfig,
  applySyntheticConfig,
  applySyntheticProviderConfig,
  applyVeniceConfig,
  applyVeniceProviderConfig,
  applyVercelAiGatewayConfig,
  applyVercelAiGatewayProviderConfig,
  applyXiaomiConfig,
  applyXiaomiProviderConfig,
  applyZaiConfig
};
