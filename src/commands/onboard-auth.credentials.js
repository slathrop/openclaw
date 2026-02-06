const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Credential persistence during onboarding
import { resolveOpenClawAgentDir } from '../agents/agent-paths.js';
import { upsertAuthProfile } from '../agents/auth-profiles.js';
import { CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF } from '../agents/cloudflare-ai-gateway.js';
const resolveAuthAgentDir = /* @__PURE__ */ __name((agentDir) => agentDir ?? resolveOpenClawAgentDir(), 'resolveAuthAgentDir');
async function writeOAuthCredentials(provider, creds, agentDir) {
  const email = typeof creds.email === 'string' && creds.email.trim() ? creds.email.trim() : 'default';
  upsertAuthProfile({
    profileId: `${provider}:${email}`,
    credential: {
      type: 'oauth',
      provider,
      ...creds
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(writeOAuthCredentials, 'writeOAuthCredentials');
async function setAnthropicApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'anthropic:default',
    credential: {
      type: 'api_key',
      provider: 'anthropic',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setAnthropicApiKey, 'setAnthropicApiKey');
async function setGeminiApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'google:default',
    credential: {
      type: 'api_key',
      provider: 'google',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setGeminiApiKey, 'setGeminiApiKey');
async function setMinimaxApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'minimax:default',
    credential: {
      type: 'api_key',
      provider: 'minimax',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setMinimaxApiKey, 'setMinimaxApiKey');
async function setMoonshotApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'moonshot:default',
    credential: {
      type: 'api_key',
      provider: 'moonshot',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setMoonshotApiKey, 'setMoonshotApiKey');
async function setKimiCodingApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'kimi-coding:default',
    credential: {
      type: 'api_key',
      provider: 'kimi-coding',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setKimiCodingApiKey, 'setKimiCodingApiKey');
async function setSyntheticApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'synthetic:default',
    credential: {
      type: 'api_key',
      provider: 'synthetic',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setSyntheticApiKey, 'setSyntheticApiKey');
async function setVeniceApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'venice:default',
    credential: {
      type: 'api_key',
      provider: 'venice',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setVeniceApiKey, 'setVeniceApiKey');
const ZAI_DEFAULT_MODEL_REF = 'zai/glm-4.7';
const XIAOMI_DEFAULT_MODEL_REF = 'xiaomi/mimo-v2-flash';
const OPENROUTER_DEFAULT_MODEL_REF = 'openrouter/auto';
const VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF = 'vercel-ai-gateway/anthropic/claude-opus-4.6';
async function setZaiApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'zai:default',
    credential: {
      type: 'api_key',
      provider: 'zai',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setZaiApiKey, 'setZaiApiKey');
async function setXiaomiApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'xiaomi:default',
    credential: {
      type: 'api_key',
      provider: 'xiaomi',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setXiaomiApiKey, 'setXiaomiApiKey');
async function setOpenrouterApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'openrouter:default',
    credential: {
      type: 'api_key',
      provider: 'openrouter',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setOpenrouterApiKey, 'setOpenrouterApiKey');
async function setCloudflareAiGatewayConfig(accountId, gatewayId, apiKey, agentDir) {
  const normalizedAccountId = accountId.trim();
  const normalizedGatewayId = gatewayId.trim();
  const normalizedKey = apiKey.trim();
  upsertAuthProfile({
    profileId: 'cloudflare-ai-gateway:default',
    credential: {
      type: 'api_key',
      provider: 'cloudflare-ai-gateway',
      key: normalizedKey,
      metadata: {
        accountId: normalizedAccountId,
        gatewayId: normalizedGatewayId
      }
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setCloudflareAiGatewayConfig, 'setCloudflareAiGatewayConfig');
async function setVercelAiGatewayApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'vercel-ai-gateway:default',
    credential: {
      type: 'api_key',
      provider: 'vercel-ai-gateway',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setVercelAiGatewayApiKey, 'setVercelAiGatewayApiKey');
async function setOpencodeZenApiKey(key, agentDir) {
  upsertAuthProfile({
    profileId: 'opencode:default',
    credential: {
      type: 'api_key',
      provider: 'opencode',
      key
    },
    agentDir: resolveAuthAgentDir(agentDir)
  });
}
__name(setOpencodeZenApiKey, 'setOpencodeZenApiKey');
export {
  CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF,
  OPENROUTER_DEFAULT_MODEL_REF,
  VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF,
  XIAOMI_DEFAULT_MODEL_REF,
  ZAI_DEFAULT_MODEL_REF,
  setAnthropicApiKey,
  setCloudflareAiGatewayConfig,
  setGeminiApiKey,
  setKimiCodingApiKey,
  setMinimaxApiKey,
  setMoonshotApiKey,
  setOpencodeZenApiKey,
  setOpenrouterApiKey,
  setSyntheticApiKey,
  setVeniceApiKey,
  setVercelAiGatewayApiKey,
  setXiaomiApiKey,
  setZaiApiKey,
  writeOAuthCredentials
};
