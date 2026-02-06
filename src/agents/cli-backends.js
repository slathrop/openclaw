/**
 * @module cli-backends
 * CLI backend resolution for model provider selection.
 * @typedef {object} ResolvedCliBackend - Resolved CLI backend with provider and model info.
 * @property
 */

import { normalizeProviderId } from './model-selection.js';
const CLAUDE_MODEL_ALIASES = {
  opus: 'opus',
  'opus-4.6': 'opus',
  'opus-4.5': 'opus',
  'opus-4': 'opus',
  'claude-opus-4-6': 'opus',
  'claude-opus-4-5': 'opus',
  'claude-opus-4': 'opus',
  sonnet: 'sonnet',
  'sonnet-4.5': 'sonnet',
  'sonnet-4.1': 'sonnet',
  'sonnet-4.0': 'sonnet',
  'claude-sonnet-4-5': 'sonnet',
  'claude-sonnet-4-1': 'sonnet',
  'claude-sonnet-4-0': 'sonnet',
  haiku: 'haiku',
  'haiku-3.5': 'haiku',
  'claude-haiku-3-5': 'haiku'
};
const DEFAULT_CLAUDE_BACKEND = {
  command: 'claude',
  args: ['-p', '--output-format', 'json', '--dangerously-skip-permissions'],
  resumeArgs: [
    '-p',
    '--output-format',
    'json',
    '--dangerously-skip-permissions',
    '--resume',
    '{sessionId}'
  ],
  output: 'json',
  input: 'arg',
  modelArg: '--model',
  modelAliases: CLAUDE_MODEL_ALIASES,
  sessionArg: '--session-id',
  sessionMode: 'always',
  sessionIdFields: ['session_id', 'sessionId', 'conversation_id', 'conversationId'],
  systemPromptArg: '--append-system-prompt',
  systemPromptMode: 'append',
  systemPromptWhen: 'first',
  clearEnv: ['ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY_OLD'],
  serialize: true
};
const DEFAULT_CODEX_BACKEND = {
  command: 'codex',
  args: ['exec', '--json', '--color', 'never', '--sandbox', 'read-only', '--skip-git-repo-check'],
  resumeArgs: [
    'exec',
    'resume',
    '{sessionId}',
    '--color',
    'never',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check'
  ],
  output: 'jsonl',
  resumeOutput: 'text',
  input: 'arg',
  modelArg: '--model',
  sessionIdFields: ['thread_id'],
  sessionMode: 'existing',
  imageArg: '--image',
  imageMode: 'repeat',
  serialize: true
};
function normalizeBackendKey(key) {
  return normalizeProviderId(key);
}
function pickBackendConfig(config, normalizedId) {
  for (const [key, entry] of Object.entries(config)) {
    if (normalizeBackendKey(key) === normalizedId) {
      return entry;
    }
  }
  return void 0;
}
function mergeBackendConfig(base, override) {
  if (!override) {
    return { ...base };
  }
  return {
    ...base,
    ...override,
    args: override.args ?? base.args,
    env: { ...base.env, ...override.env },
    modelAliases: { ...base.modelAliases, ...override.modelAliases },
    clearEnv: Array.from(/* @__PURE__ */ new Set([...base.clearEnv ?? [], ...override.clearEnv ?? []])),
    sessionIdFields: override.sessionIdFields ?? base.sessionIdFields,
    sessionArgs: override.sessionArgs ?? base.sessionArgs,
    resumeArgs: override.resumeArgs ?? base.resumeArgs
  };
}
function resolveCliBackendIds(cfg) {
  const ids = /* @__PURE__ */ new Set([
    normalizeBackendKey('claude-cli'),
    normalizeBackendKey('codex-cli')
  ]);
  const configured = cfg?.agents?.defaults?.cliBackends ?? {};
  for (const key of Object.keys(configured)) {
    ids.add(normalizeBackendKey(key));
  }
  return ids;
}
function resolveCliBackendConfig(provider, cfg) {
  const normalized = normalizeBackendKey(provider);
  const configured = cfg?.agents?.defaults?.cliBackends ?? {};
  const override = pickBackendConfig(configured, normalized);
  if (normalized === 'claude-cli') {
    const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);
    const command2 = merged.command?.trim();
    if (!command2) {
      return null;
    }
    return { id: normalized, config: { ...merged, command: command2 } };
  }
  if (normalized === 'codex-cli') {
    const merged = mergeBackendConfig(DEFAULT_CODEX_BACKEND, override);
    const command2 = merged.command?.trim();
    if (!command2) {
      return null;
    }
    return { id: normalized, config: { ...merged, command: command2 } };
  }
  if (!override) {
    return null;
  }
  const command = override.command?.trim();
  if (!command) {
    return null;
  }
  return { id: normalized, config: { ...override, command } };
}
export {
  resolveCliBackendConfig,
  resolveCliBackendIds
};
