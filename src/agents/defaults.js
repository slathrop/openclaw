/**
 * @module defaults
 * Default agent configuration values and constants.
 */
const DEFAULT_PROVIDER = 'anthropic';
const DEFAULT_MODEL = 'claude-opus-4-6';
// Context window: Opus supports ~200k tokens (per pi-ai models.generated.ts for Opus 4.5).
const DEFAULT_CONTEXT_TOKENS = 2e5;
export {
  DEFAULT_CONTEXT_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER
};
