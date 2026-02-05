const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { listAgentIds } from '../../agents/agent-scope.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../../agents/defaults.js';
import {
  buildModelAliasIndex,
  modelKey,
  parseModelRef,
  resolveModelRefFromString
} from '../../agents/model-selection.js';
import { formatCliCommand } from '../../cli/command-format.js';
import {
  readConfigFileSnapshot,
  writeConfigFile
} from '../../config/config.js';
import { normalizeAgentId } from '../../routing/session-key.js';
const ensureFlagCompatibility = /* @__PURE__ */ __name((opts) => {
  if (opts.json && opts.plain) {
    throw new Error('Choose either --json or --plain, not both.');
  }
}, 'ensureFlagCompatibility');
const formatTokenK = /* @__PURE__ */ __name((value) => {
  if (!value || !Number.isFinite(value)) {
    return '-';
  }
  if (value < 1024) {
    return `${Math.round(value)}`;
  }
  return `${Math.round(value / 1024)}k`;
}, 'formatTokenK');
const formatMs = /* @__PURE__ */ __name((value) => {
  if (value === null || value === void 0) {
    return '-';
  }
  if (!Number.isFinite(value)) {
    return '-';
  }
  if (value < 1e3) {
    return `${Math.round(value)}ms`;
  }
  return `${Math.round(value / 100) / 10}s`;
}, 'formatMs');
async function updateConfig(mutator) {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    const issues = snapshot.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid config at ${snapshot.path}
${issues}`);
  }
  const next = mutator(snapshot.config);
  await writeConfigFile(next);
  return next;
}
__name(updateConfig, 'updateConfig');
function resolveModelTarget(params) {
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: DEFAULT_PROVIDER
  });
  const resolved = resolveModelRefFromString({
    raw: params.raw,
    defaultProvider: DEFAULT_PROVIDER,
    aliasIndex
  });
  if (!resolved) {
    throw new Error(`Invalid model reference: ${params.raw}`);
  }
  return resolved.ref;
}
__name(resolveModelTarget, 'resolveModelTarget');
function buildAllowlistSet(cfg) {
  const allowed = /* @__PURE__ */ new Set();
  const models = cfg.agents?.defaults?.models ?? {};
  for (const raw of Object.keys(models)) {
    const parsed = parseModelRef(String(raw ?? ''), DEFAULT_PROVIDER);
    if (!parsed) {
      continue;
    }
    allowed.add(modelKey(parsed.provider, parsed.model));
  }
  return allowed;
}
__name(buildAllowlistSet, 'buildAllowlistSet');
function normalizeAlias(alias) {
  const trimmed = alias.trim();
  if (!trimmed) {
    throw new Error('Alias cannot be empty.');
  }
  if (!/^[A-Za-z0-9_.:-]+$/.test(trimmed)) {
    throw new Error('Alias must use letters, numbers, dots, underscores, colons, or dashes.');
  }
  return trimmed;
}
__name(normalizeAlias, 'normalizeAlias');
function resolveKnownAgentId(params) {
  const raw = params.rawAgentId?.trim();
  if (!raw) {
    return void 0;
  }
  const agentId = normalizeAgentId(raw);
  const knownAgents = listAgentIds(params.cfg);
  if (!knownAgents.includes(agentId)) {
    throw new Error(
      `Unknown agent id "${raw}". Use "${formatCliCommand('openclaw agents list')}" to see configured agents.`
    );
  }
  return agentId;
}
__name(resolveKnownAgentId, 'resolveKnownAgentId');
export {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  buildAllowlistSet,
  ensureFlagCompatibility,
  formatMs,
  formatTokenK,
  modelKey,
  normalizeAlias,
  resolveKnownAgentId,
  resolveModelTarget,
  updateConfig
};
