const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { resolveOpenClawAgentDir } from '../../agents/agent-paths.js';
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from '../../agents/agent-scope.js';
import {
  ensureAuthProfileStore,
  listProfilesForProvider,
  resolveAuthProfileDisplayLabel,
  resolveAuthProfileOrder
} from '../../agents/auth-profiles.js';
import { describeFailoverError } from '../../agents/failover-error.js';
import { getCustomProviderApiKey, resolveEnvApiKey } from '../../agents/model-auth.js';
import { loadModelCatalog } from '../../agents/model-catalog.js';
import { normalizeProviderId, parseModelRef } from '../../agents/model-selection.js';
import { runEmbeddedPiAgent } from '../../agents/pi-embedded.js';
import { resolveDefaultAgentWorkspaceDir } from '../../agents/workspace.js';
import {
  resolveSessionTranscriptPath,
  resolveSessionTranscriptsDirForAgent
} from '../../config/sessions/paths.js';
import { redactSecrets } from '../status-all/format.js';
import { DEFAULT_PROVIDER, formatMs } from './shared.js';
const PROBE_PROMPT = 'Reply with OK. Do not use tools.';
const toStatus = /* @__PURE__ */ __name((reason) => {
  if (!reason) {
    return 'unknown';
  }
  if (reason === 'auth') {
    return 'auth';
  }
  if (reason === 'rate_limit') {
    return 'rate_limit';
  }
  if (reason === 'billing') {
    return 'billing';
  }
  if (reason === 'timeout') {
    return 'timeout';
  }
  if (reason === 'format') {
    return 'format';
  }
  return 'unknown';
}, 'toStatus');
function buildCandidateMap(modelCandidates) {
  const map = /* @__PURE__ */ new Map();
  for (const raw of modelCandidates) {
    const parsed = parseModelRef(String(raw ?? ''), DEFAULT_PROVIDER);
    if (!parsed) {
      continue;
    }
    const list = map.get(parsed.provider) ?? [];
    if (!list.includes(parsed.model)) {
      list.push(parsed.model);
    }
    map.set(parsed.provider, list);
  }
  return map;
}
__name(buildCandidateMap, 'buildCandidateMap');
function selectProbeModel(params) {
  const { provider, candidates, catalog } = params;
  const direct = candidates.get(provider);
  if (direct && direct.length > 0) {
    return { provider, model: direct[0] };
  }
  const fromCatalog = catalog.find((entry) => entry.provider === provider);
  if (fromCatalog) {
    return { provider: fromCatalog.provider, model: fromCatalog.id };
  }
  return null;
}
__name(selectProbeModel, 'selectProbeModel');
function buildProbeTargets(params) {
  const { cfg, providers, modelCandidates, options } = params;
  const store = ensureAuthProfileStore();
  const providerFilter = options.provider?.trim();
  const providerFilterKey = providerFilter ? normalizeProviderId(providerFilter) : null;
  const profileFilter = new Set((options.profileIds ?? []).map((id) => id.trim()).filter(Boolean));
  return loadModelCatalog({ config: cfg }).then((catalog) => {
    const candidates = buildCandidateMap(modelCandidates);
    const targets = [];
    const results = [];
    for (const provider of providers) {
      const providerKey = normalizeProviderId(provider);
      if (providerFilterKey && providerKey !== providerFilterKey) {
        continue;
      }
      const model = selectProbeModel({
        provider: providerKey,
        candidates,
        catalog
      });
      const profileIds = listProfilesForProvider(store, providerKey);
      const explicitOrder = (() => {
        const order = store.order;
        if (order) {
          for (const [key, value] of Object.entries(order)) {
            if (normalizeProviderId(key) === providerKey) {
              return value;
            }
          }
        }
        const cfgOrder = cfg?.auth?.order;
        if (cfgOrder) {
          for (const [key, value] of Object.entries(cfgOrder)) {
            if (normalizeProviderId(key) === providerKey) {
              return value;
            }
          }
        }
        return void 0;
      })();
      const allowedProfiles = explicitOrder && explicitOrder.length > 0 ? new Set(resolveAuthProfileOrder({ cfg, store, provider: providerKey })) : null;
      const filteredProfiles = profileFilter.size ? profileIds.filter((id) => profileFilter.has(id)) : profileIds;
      if (filteredProfiles.length > 0) {
        for (const profileId of filteredProfiles) {
          const profile = store.profiles[profileId];
          const mode2 = profile?.type;
          const label2 = resolveAuthProfileDisplayLabel({ cfg, store, profileId });
          if (explicitOrder && !explicitOrder.includes(profileId)) {
            results.push({
              provider: providerKey,
              model: model ? `${model.provider}/${model.model}` : void 0,
              profileId,
              label: label2,
              source: 'profile',
              mode: mode2,
              status: 'unknown',
              error: 'Excluded by auth.order for this provider.'
            });
            continue;
          }
          if (allowedProfiles && !allowedProfiles.has(profileId)) {
            results.push({
              provider: providerKey,
              model: model ? `${model.provider}/${model.model}` : void 0,
              profileId,
              label: label2,
              source: 'profile',
              mode: mode2,
              status: 'unknown',
              error: 'Auth profile credentials are missing or expired.'
            });
            continue;
          }
          if (!model) {
            results.push({
              provider: providerKey,
              model: void 0,
              profileId,
              label: label2,
              source: 'profile',
              mode: mode2,
              status: 'no_model',
              error: 'No model available for probe'
            });
            continue;
          }
          targets.push({
            provider: providerKey,
            model,
            profileId,
            label: label2,
            source: 'profile',
            mode: mode2
          });
        }
        continue;
      }
      if (profileFilter.size > 0) {
        continue;
      }
      const envKey = resolveEnvApiKey(providerKey);
      const customKey = getCustomProviderApiKey(cfg, providerKey);
      if (!envKey && !customKey) {
        continue;
      }
      const label = envKey ? 'env' : 'models.json';
      const source = envKey ? 'env' : 'models.json';
      const mode = envKey?.source.includes('OAUTH_TOKEN') ? 'oauth' : 'api_key';
      if (!model) {
        results.push({
          provider: providerKey,
          model: void 0,
          label,
          source,
          mode,
          status: 'no_model',
          error: 'No model available for probe'
        });
        continue;
      }
      targets.push({
        provider: providerKey,
        model,
        label,
        source,
        mode
      });
    }
    return { targets, results };
  });
}
__name(buildProbeTargets, 'buildProbeTargets');
async function probeTarget(params) {
  const { cfg, agentId, agentDir, workspaceDir, sessionDir, target, timeoutMs, maxTokens } = params;
  if (!target.model) {
    return {
      provider: target.provider,
      model: void 0,
      profileId: target.profileId,
      label: target.label,
      source: target.source,
      mode: target.mode,
      status: 'no_model',
      error: 'No model available for probe'
    };
  }
  const sessionId = `probe-${target.provider}-${crypto.randomUUID()}`;
  const sessionFile = resolveSessionTranscriptPath(sessionId, agentId);
  await fs.mkdir(sessionDir, { recursive: true });
  const start = Date.now();
  try {
    await runEmbeddedPiAgent({
      sessionId,
      sessionFile,
      workspaceDir,
      agentDir,
      config: cfg,
      prompt: PROBE_PROMPT,
      provider: target.model.provider,
      model: target.model.model,
      authProfileId: target.profileId,
      authProfileIdSource: target.profileId ? 'user' : void 0,
      timeoutMs,
      runId: `probe-${crypto.randomUUID()}`,
      lane: `auth-probe:${target.provider}:${target.profileId ?? target.source}`,
      thinkLevel: 'off',
      reasoningLevel: 'off',
      verboseLevel: 'off',
      streamParams: { maxTokens }
    });
    return {
      provider: target.provider,
      model: `${target.model.provider}/${target.model.model}`,
      profileId: target.profileId,
      label: target.label,
      source: target.source,
      mode: target.mode,
      status: 'ok',
      latencyMs: Date.now() - start
    };
  } catch (err) {
    const described = describeFailoverError(err);
    return {
      provider: target.provider,
      model: `${target.model.provider}/${target.model.model}`,
      profileId: target.profileId,
      label: target.label,
      source: target.source,
      mode: target.mode,
      status: toStatus(described.reason),
      error: redactSecrets(described.message),
      latencyMs: Date.now() - start
    };
  }
}
__name(probeTarget, 'probeTarget');
async function runTargetsWithConcurrency(params) {
  const { cfg, targets, timeoutMs, maxTokens, onProgress } = params;
  const concurrency = Math.max(1, Math.min(targets.length || 1, params.concurrency));
  const agentId = resolveDefaultAgentId(cfg);
  const agentDir = resolveOpenClawAgentDir();
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId) ?? resolveDefaultAgentWorkspaceDir();
  const sessionDir = resolveSessionTranscriptsDirForAgent(agentId);
  await fs.mkdir(workspaceDir, { recursive: true });
  let completed = 0;
  const results = Array.from({ length: targets.length });
  let cursor = 0;
  const worker = /* @__PURE__ */ __name(async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= targets.length) {
        return;
      }
      const target = targets[index];
      onProgress?.({
        completed,
        total: targets.length,
        label: `Probing ${target.provider}${target.profileId ? ` (${target.label})` : ''}`
      });
      const result = await probeTarget({
        cfg,
        agentId,
        agentDir,
        workspaceDir,
        sessionDir,
        target,
        timeoutMs,
        maxTokens
      });
      results[index] = result;
      completed += 1;
      onProgress?.({ completed, total: targets.length });
    }
  }, 'worker');
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.filter((entry) => Boolean(entry));
}
__name(runTargetsWithConcurrency, 'runTargetsWithConcurrency');
async function runAuthProbes(params) {
  const startedAt = Date.now();
  const plan = await buildProbeTargets({
    cfg: params.cfg,
    providers: params.providers,
    modelCandidates: params.modelCandidates,
    options: params.options
  });
  const totalTargets = plan.targets.length;
  params.onProgress?.({ completed: 0, total: totalTargets });
  const results = totalTargets ? await runTargetsWithConcurrency({
    cfg: params.cfg,
    targets: plan.targets,
    timeoutMs: params.options.timeoutMs,
    maxTokens: params.options.maxTokens,
    concurrency: params.options.concurrency,
    onProgress: params.onProgress
  }) : [];
  const finishedAt = Date.now();
  return {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    totalTargets,
    options: params.options,
    results: [...plan.results, ...results]
  };
}
__name(runAuthProbes, 'runAuthProbes');
function formatProbeLatency(latencyMs) {
  if (!latencyMs && latencyMs !== 0) {
    return '-';
  }
  return formatMs(latencyMs);
}
__name(formatProbeLatency, 'formatProbeLatency');
function groupProbeResults(results) {
  const map = /* @__PURE__ */ new Map();
  for (const result of results) {
    const list = map.get(result.provider) ?? [];
    list.push(result);
    map.set(result.provider, list);
  }
  return map;
}
__name(groupProbeResults, 'groupProbeResults');
function sortProbeResults(results) {
  return results.slice().toSorted((a, b) => {
    const provider = a.provider.localeCompare(b.provider);
    if (provider !== 0) {
      return provider;
    }
    const aLabel = a.label || a.profileId || '';
    const bLabel = b.label || b.profileId || '';
    return aLabel.localeCompare(bLabel);
  });
}
__name(sortProbeResults, 'sortProbeResults');
function describeProbeSummary(summary) {
  if (summary.totalTargets === 0) {
    return 'No probe targets.';
  }
  return `Probed ${summary.totalTargets} target${summary.totalTargets === 1 ? '' : 's'} in ${formatMs(summary.durationMs)}`;
}
__name(describeProbeSummary, 'describeProbeSummary');
export {
  describeProbeSummary,
  formatProbeLatency,
  groupProbeResults,
  runAuthProbes,
  sortProbeResults
};
