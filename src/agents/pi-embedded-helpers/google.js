/**
 * Google-specific helpers for Pi embedded agent interactions.
 * @module agents/pi-embedded-helpers/google
 */
import { sanitizeGoogleTurnOrdering } from './bootstrap.js';
function isGoogleModelApi(api) {
  return api === 'google-gemini-cli' || api === 'google-generative-ai' || api === 'google-antigravity';
}
function isAntigravityClaude(params) {
  const provider = params.provider?.toLowerCase();
  const api = params.api?.toLowerCase();
  if (provider !== 'google-antigravity' && api !== 'google-antigravity') {
    return false;
  }
  return params.modelId?.toLowerCase().includes('claude') ?? false;
}
export {
  isAntigravityClaude,
  isGoogleModelApi,
  sanitizeGoogleTurnOrdering
};
