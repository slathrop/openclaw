const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Token lifecycle management (store, refresh, validate)
import { normalizeProviderId } from '../agents/model-selection.js';
const ANTHROPIC_SETUP_TOKEN_PREFIX = 'sk-ant-oat01-';
const ANTHROPIC_SETUP_TOKEN_MIN_LENGTH = 80;
const DEFAULT_TOKEN_PROFILE_NAME = 'default';
function normalizeTokenProfileName(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return DEFAULT_TOKEN_PROFILE_NAME;
  }
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return slug || DEFAULT_TOKEN_PROFILE_NAME;
}
__name(normalizeTokenProfileName, 'normalizeTokenProfileName');
function buildTokenProfileId(params) {
  const provider = normalizeProviderId(params.provider);
  const name = normalizeTokenProfileName(params.name);
  return `${provider}:${name}`;
}
__name(buildTokenProfileId, 'buildTokenProfileId');
function validateAnthropicSetupToken(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Required';
  }
  if (!trimmed.startsWith(ANTHROPIC_SETUP_TOKEN_PREFIX)) {
    return `Expected token starting with ${ANTHROPIC_SETUP_TOKEN_PREFIX}`;
  }
  if (trimmed.length < ANTHROPIC_SETUP_TOKEN_MIN_LENGTH) {
    return 'Token looks too short; paste the full setup-token';
  }
  return void 0;
}
__name(validateAnthropicSetupToken, 'validateAnthropicSetupToken');
export {
  ANTHROPIC_SETUP_TOKEN_MIN_LENGTH,
  ANTHROPIC_SETUP_TOKEN_PREFIX,
  DEFAULT_TOKEN_PROFILE_NAME,
  buildTokenProfileId,
  normalizeTokenProfileName,
  validateAnthropicSetupToken
};
