 
import fs from 'node:fs';
import { lookupContextTokens } from '../agents/context.js';
import { DEFAULT_CONTEXT_TOKENS, DEFAULT_MODEL, DEFAULT_PROVIDER } from '../agents/defaults.js';
import { resolveModelAuthMode } from '../agents/model-auth.js';
import { resolveConfiguredModelRef } from '../agents/model-selection.js';
import { resolveSandboxRuntimeStatus } from '../agents/sandbox.js';
import { derivePromptTokens, normalizeUsage } from '../agents/usage.js';
import {
  resolveMainSessionKey,
  resolveSessionFilePath
} from '../config/sessions.js';
import { resolveCommitHash } from '../infra/git-commit.js';
import { listPluginCommands } from '../plugins/commands.js';
import {
  getTtsMaxLength,
  getTtsProvider,
  isSummarizationEnabled,
  resolveTtsAutoMode,
  resolveTtsConfig,
  resolveTtsPrefsPath
} from '../tts/tts.js';
import {
  estimateUsageCost,
  formatTokenCount as formatTokenCountShared,
  formatUsd,
  resolveModelCostConfig
} from '../utils/usage-format.js';
import { VERSION } from '../version.js';
import {
  listChatCommands,
  listChatCommandsForConfig
} from './commands-registry.js';
const formatTokenCount = formatTokenCountShared;
function resolveRuntimeLabel(args) {
  const sessionKey = args.sessionKey?.trim();
  if (args.config && sessionKey) {
    const runtimeStatus = resolveSandboxRuntimeStatus({
      cfg: args.config,
      sessionKey
    });
    const sandboxMode2 = runtimeStatus.mode ?? 'off';
    if (sandboxMode2 === 'off') {
      return 'direct';
    }
    const runtime2 = runtimeStatus.sandboxed ? 'docker' : sessionKey ? 'direct' : 'unknown';
    return `${runtime2}/${sandboxMode2}`;
  }
  const sandboxMode = args.agent?.sandbox?.mode ?? 'off';
  if (sandboxMode === 'off') {
    return 'direct';
  }
  const sandboxed = (() => {
    if (!sessionKey) {
      return false;
    }
    if (sandboxMode === 'all') {
      return true;
    }
    if (args.config) {
      return resolveSandboxRuntimeStatus({
        cfg: args.config,
        sessionKey
      }).sandboxed;
    }
    const sessionScope = args.sessionScope ?? 'per-sender';
    const mainKey = resolveMainSessionKey({
      session: { scope: sessionScope }
    });
    return sessionKey !== mainKey.trim();
  })();
  const runtime = sandboxed ? 'docker' : sessionKey ? 'direct' : 'unknown';
  return `${runtime}/${sandboxMode}`;
}
const formatTokens = (total, contextTokens) => {
  const ctx = contextTokens ?? null;
  if (total === null || total === undefined) {
    const ctxLabel2 = ctx ? formatTokenCount(ctx) : '?';
    return `?/${ctxLabel2}`;
  }
  const pct = ctx ? Math.min(999, Math.round(total / ctx * 100)) : null;
  const totalLabel = formatTokenCount(total);
  const ctxLabel = ctx ? formatTokenCount(ctx) : '?';
  return `${totalLabel}/${ctxLabel}${pct !== null ? ` (${pct}%)` : ''}`;
};
const formatContextUsageShort = (total, contextTokens) => `Context ${formatTokens(total, contextTokens ?? null)}`;
const formatAge = (ms) => {
  if (!ms || ms < 0) {
    return 'unknown';
  }
  const minutes = Math.round(ms / 6e4);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};
const formatQueueDetails = (queue) => {
  if (!queue) {
    return '';
  }
  const depth = typeof queue.depth === 'number' ? `depth ${queue.depth}` : null;
  if (!queue.showDetails) {
    return depth ? ` (${depth})` : '';
  }
  const detailParts = [];
  if (depth) {
    detailParts.push(depth);
  }
  if (typeof queue.debounceMs === 'number') {
    const ms = Math.max(0, Math.round(queue.debounceMs));
    const label = ms >= 1e3 ? `${ms % 1e3 === 0 ? ms / 1e3 : (ms / 1e3).toFixed(1)}s` : `${ms}ms`;
    detailParts.push(`debounce ${label}`);
  }
  if (typeof queue.cap === 'number') {
    detailParts.push(`cap ${queue.cap}`);
  }
  if (queue.dropPolicy) {
    detailParts.push(`drop ${queue.dropPolicy}`);
  }
  return detailParts.length ? ` (${detailParts.join(' \xB7 ')})` : '';
};
const readUsageFromSessionLog = (sessionId, sessionEntry) => {
  if (!sessionId) {
    return void 0;
  }
  const logPath = resolveSessionFilePath(sessionId, sessionEntry);
  if (!fs.existsSync(logPath)) {
    return void 0;
  }
  try {
    const lines = fs.readFileSync(logPath, 'utf-8').split(/\n+/);
    let input = 0;
    let output = 0;
    let promptTokens = 0;
    let model;
    let lastUsage;
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        const usageRaw = parsed.message?.usage ?? parsed.usage;
        const usage = normalizeUsage(usageRaw);
        if (usage) {
          lastUsage = usage;
        }
        model = parsed.message?.model ?? parsed.model ?? model;
      } catch {
        // Intentionally ignored
      }
    }
    if (!lastUsage) {
      return void 0;
    }
    input = lastUsage.input ?? 0;
    output = lastUsage.output ?? 0;
    promptTokens = derivePromptTokens(lastUsage) ?? lastUsage.total ?? input + output;
    const total = lastUsage.total ?? promptTokens + output;
    if (promptTokens === 0 && total === 0) {
      return void 0;
    }
    return { input, output, promptTokens, total, model };
  } catch {
    return void 0;
  }
};
const formatUsagePair = (input, output) => {
  if (input === null || input === undefined && output === null || output === undefined) {
    return null;
  }
  const inputLabel = typeof input === 'number' ? formatTokenCount(input) : '?';
  const outputLabel = typeof output === 'number' ? formatTokenCount(output) : '?';
  return `\u{1F9EE} Tokens: ${inputLabel} in / ${outputLabel} out`;
};
const formatMediaUnderstandingLine = (decisions) => {
  if (!decisions || decisions.length === 0) {
    return null;
  }
  const parts = decisions.map((decision) => {
    const count = decision.attachments.length;
    const countLabel = count > 1 ? ` x${count}` : '';
    if (decision.outcome === 'success') {
      const chosen = decision.attachments.find((entry) => entry.chosen)?.chosen;
      const provider = chosen?.provider?.trim();
      const model = chosen?.model?.trim();
      const modelLabel = provider ? model ? `${provider}/${model}` : provider : null;
      return `${decision.capability}${countLabel} ok${modelLabel ? ` (${modelLabel})` : ''}`;
    }
    if (decision.outcome === 'no-attachment') {
      return `${decision.capability} none`;
    }
    if (decision.outcome === 'disabled') {
      return `${decision.capability} off`;
    }
    if (decision.outcome === 'scope-deny') {
      return `${decision.capability} denied`;
    }
    if (decision.outcome === 'skipped') {
      const reason = decision.attachments.flatMap((entry) => entry.attempts.map((attempt) => attempt.reason).filter(Boolean)).find(Boolean);
      const shortReason = reason ? reason.split(':')[0]?.trim() : void 0;
      return `${decision.capability} skipped${shortReason ? ` (${shortReason})` : ''}`;
    }
    return null;
  }).filter((part) => part !== null && part !== undefined);
  if (parts.length === 0) {
    return null;
  }
  if (parts.every((part) => part.endsWith(' none'))) {
    return null;
  }
  return `\u{1F4CE} Media: ${parts.join(' \xB7 ')}`;
};
const formatVoiceModeLine = (config, sessionEntry) => {
  if (!config) {
    return null;
  }
  const ttsConfig = resolveTtsConfig(config);
  const prefsPath = resolveTtsPrefsPath(ttsConfig);
  const autoMode = resolveTtsAutoMode({
    config: ttsConfig,
    prefsPath,
    sessionAuto: sessionEntry?.ttsAuto
  });
  if (autoMode === 'off') {
    return null;
  }
  const provider = getTtsProvider(ttsConfig, prefsPath);
  const maxLength = getTtsMaxLength(prefsPath);
  const summarize = isSummarizationEnabled(prefsPath) ? 'on' : 'off';
  return `\u{1F50A} Voice: ${autoMode} \xB7 provider=${provider} \xB7 limit=${maxLength} \xB7 summary=${summarize}`;
};
function buildStatusMessage(args) {
  const now = args.now ?? Date.now();
  const entry = args.sessionEntry;
  const resolved = resolveConfiguredModelRef({
    cfg: {
      agents: {
        defaults: args.agent ?? {}
      }
    },
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
  const provider = entry?.providerOverride ?? resolved.provider ?? DEFAULT_PROVIDER;
  let model = entry?.modelOverride ?? resolved.model ?? DEFAULT_MODEL;
  let contextTokens = entry?.contextTokens ?? args.agent?.contextTokens ?? lookupContextTokens(model) ?? DEFAULT_CONTEXT_TOKENS;
  let inputTokens = entry?.inputTokens;
  let outputTokens = entry?.outputTokens;
  let totalTokens = entry?.totalTokens ?? (entry?.inputTokens ?? 0) + (entry?.outputTokens ?? 0);
  if (args.includeTranscriptUsage) {
    const logUsage = readUsageFromSessionLog(entry?.sessionId, entry);
    if (logUsage) {
      const candidate = logUsage.promptTokens || logUsage.total;
      if (!totalTokens || totalTokens === 0 || candidate > totalTokens) {
        totalTokens = candidate;
      }
      if (!model) {
        model = logUsage.model ?? model;
      }
      if (!contextTokens && logUsage.model) {
        contextTokens = lookupContextTokens(logUsage.model) ?? contextTokens;
      }
      if (!inputTokens || inputTokens === 0) {
        inputTokens = logUsage.input;
      }
      if (!outputTokens || outputTokens === 0) {
        outputTokens = logUsage.output;
      }
    }
  }
  const thinkLevel = args.resolvedThink ?? args.agent?.thinkingDefault ?? 'off';
  const verboseLevel = args.resolvedVerbose ?? args.agent?.verboseDefault ?? 'off';
  const reasoningLevel = args.resolvedReasoning ?? 'off';
  const elevatedLevel = args.resolvedElevated ?? args.sessionEntry?.elevatedLevel ?? args.agent?.elevatedDefault ?? 'on';
  const runtime = { label: resolveRuntimeLabel(args) };
  const updatedAt = entry?.updatedAt;
  const sessionLine = [
    `Session: ${args.sessionKey ?? 'unknown'}`,
    typeof updatedAt === 'number' ? `updated ${formatAge(now - updatedAt)}` : 'no activity'
  ].filter(Boolean).join(' \u2022 ');
  const isGroupSession = entry?.chatType === 'group' || entry?.chatType === 'channel' || Boolean(args.sessionKey?.includes(':group:')) || Boolean(args.sessionKey?.includes(':channel:'));
  const groupActivationValue = isGroupSession ? args.groupActivation ?? entry?.groupActivation ?? 'mention' : void 0;
  const contextLine = [
    `Context: ${formatTokens(totalTokens, contextTokens ?? null)}`,
    `\u{1F9F9} Compactions: ${entry?.compactionCount ?? 0}`
  ].filter(Boolean).join(' \xB7 ');
  const queueMode = args.queue?.mode ?? 'unknown';
  const queueDetails = formatQueueDetails(args.queue);
  const verboseLabel = verboseLevel === 'full' ? 'verbose:full' : verboseLevel === 'on' ? 'verbose' : null;
  const elevatedLabel = elevatedLevel && elevatedLevel !== 'off' ? elevatedLevel === 'on' ? 'elevated' : `elevated:${elevatedLevel}` : null;
  const optionParts = [
    `Runtime: ${runtime.label}`,
    `Think: ${thinkLevel}`,
    verboseLabel,
    reasoningLevel !== 'off' ? `Reasoning: ${reasoningLevel}` : null,
    elevatedLabel
  ];
  const optionsLine = optionParts.filter(Boolean).join(' \xB7 ');
  const activationParts = [
    groupActivationValue ? `\u{1F465} Activation: ${groupActivationValue}` : null,
    `\u{1FAA2} Queue: ${queueMode}${queueDetails}`
  ];
  const activationLine = activationParts.filter(Boolean).join(' \xB7 ');
  const authMode = resolveModelAuthMode(provider, args.config);
  const authLabelValue = args.modelAuth ?? (authMode && authMode !== 'unknown' ? authMode : void 0);
  const showCost = authLabelValue === 'api-key' || authLabelValue === 'mixed';
  const costConfig = showCost ? resolveModelCostConfig({
    provider,
    model,
    config: args.config
  }) : void 0;
  const hasUsage = typeof inputTokens === 'number' || typeof outputTokens === 'number';
  const cost = showCost && hasUsage ? estimateUsageCost({
    usage: {
      input: inputTokens ?? void 0,
      output: outputTokens ?? void 0
    },
    cost: costConfig
  }) : void 0;
  const costLabel = showCost && hasUsage ? formatUsd(cost) : void 0;
  const modelLabel = model ? `${provider}/${model}` : 'unknown';
  const authLabel = authLabelValue ? ` \xB7 \u{1F511} ${authLabelValue}` : '';
  const modelLine = `\u{1F9E0} Model: ${modelLabel}${authLabel}`;
  const commit = resolveCommitHash();
  const versionLine = `\u{1F99E} OpenClaw ${VERSION}${commit ? ` (${commit})` : ''}`;
  const usagePair = formatUsagePair(inputTokens, outputTokens);
  const costLine = costLabel ? `\u{1F4B5} Cost: ${costLabel}` : null;
  const usageCostLine = usagePair && costLine ? `${usagePair} \xB7 ${costLine}` : usagePair ?? costLine;
  const mediaLine = formatMediaUnderstandingLine(args.mediaDecisions);
  const voiceLine = formatVoiceModeLine(args.config, args.sessionEntry);
  return [
    versionLine,
    args.timeLine,
    modelLine,
    usageCostLine,
    `\u{1F4DA} ${contextLine}`,
    mediaLine,
    args.usageLine,
    `\u{1F9F5} ${sessionLine}`,
    args.subagentsLine,
    `\u2699\uFE0F ${optionsLine}`,
    voiceLine,
    activationLine
  ].filter(Boolean).join('\n');
}
const CATEGORY_LABELS = {
  session: 'Session',
  options: 'Options',
  status: 'Status',
  management: 'Management',
  media: 'Media',
  tools: 'Tools',
  docks: 'Docks'
};
const CATEGORY_ORDER = [
  'session',
  'options',
  'status',
  'management',
  'media',
  'tools',
  'docks'
];
function groupCommandsByCategory(commands) {
  const grouped = /* @__PURE__ */ new Map();
  for (const category of CATEGORY_ORDER) {
    grouped.set(category, []);
  }
  for (const command of commands) {
    const category = command.category ?? 'tools';
    const list = grouped.get(category) ?? [];
    list.push(command);
    grouped.set(category, list);
  }
  return grouped;
}
function buildHelpMessage(cfg) {
  const lines = ['\u2139\uFE0F Help', ''];
  lines.push('Session');
  lines.push('  /new  |  /reset  |  /compact [instructions]  |  /stop');
  lines.push('');
  const optionParts = ['/think <level>', '/model <id>', '/verbose on|off'];
  if (cfg?.commands?.config === true) {
    optionParts.push('/config');
  }
  if (cfg?.commands?.debug === true) {
    optionParts.push('/debug');
  }
  lines.push('Options');
  lines.push(`  ${optionParts.join('  |  ')}`);
  lines.push('');
  lines.push('Status');
  lines.push('  /status  |  /whoami  |  /context');
  lines.push('');
  lines.push('Skills');
  lines.push('  /skill <name> [input]');
  lines.push('');
  lines.push('More: /commands for full list');
  return lines.join('\n');
}
const COMMANDS_PER_PAGE = 8;
function formatCommandEntry(command) {
  const primary = command.nativeName ? `/${command.nativeName}` : command.textAliases[0]?.trim() || `/${command.key}`;
  const seen = /* @__PURE__ */ new Set();
  const aliases = command.textAliases.map((alias) => alias.trim()).filter(Boolean).filter((alias) => alias.toLowerCase() !== primary.toLowerCase()).filter((alias) => {
    const key = alias.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const aliasLabel = aliases.length ? ` (${aliases.join(', ')})` : '';
  const scopeLabel = command.scope === 'text' ? ' [text]' : '';
  return `${primary}${aliasLabel}${scopeLabel} - ${command.description}`;
}
function buildCommandItems(commands, pluginCommands) {
  const grouped = groupCommandsByCategory(commands);
  const items = [];
  for (const category of CATEGORY_ORDER) {
    const categoryCommands = grouped.get(category) ?? [];
    if (categoryCommands.length === 0) {
      continue;
    }
    const label = CATEGORY_LABELS[category];
    for (const command of categoryCommands) {
      items.push({ label, text: formatCommandEntry(command) });
    }
  }
  for (const command of pluginCommands) {
    const pluginLabel = command.pluginId ? ` (${command.pluginId})` : '';
    items.push({
      label: 'Plugins',
      text: `/${command.name}${pluginLabel} - ${command.description}`
    });
  }
  return items;
}
function formatCommandList(items) {
  const lines = [];
  let currentLabel = null;
  for (const item of items) {
    if (item.label !== currentLabel) {
      if (lines.length > 0) {
        lines.push('');
      }
      lines.push(item.label);
      currentLabel = item.label;
    }
    lines.push(`  ${item.text}`);
  }
  return lines.join('\n');
}
function buildCommandsMessage(cfg, skillCommands, options) {
  const result = buildCommandsMessagePaginated(cfg, skillCommands, options);
  return result.text;
}
function buildCommandsMessagePaginated(cfg, skillCommands, options) {
  const page = Math.max(1, options?.page ?? 1);
  const surface = options?.surface?.toLowerCase();
  const isTelegram = surface === 'telegram';
  const commands = cfg ? listChatCommandsForConfig(cfg, { skillCommands }) : listChatCommands({ skillCommands });
  const pluginCommands = listPluginCommands();
  const items = buildCommandItems(commands, pluginCommands);
  if (!isTelegram) {
    const lines2 = ['\u2139\uFE0F Slash commands', ''];
    lines2.push(formatCommandList(items));
    return {
      text: lines2.join('\n').trim(),
      totalPages: 1,
      currentPage: 1,
      hasNext: false,
      hasPrev: false
    };
  }
  const totalCommands = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCommands / COMMANDS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * COMMANDS_PER_PAGE;
  const endIndex = startIndex + COMMANDS_PER_PAGE;
  const pageItems = items.slice(startIndex, endIndex);
  const lines = [`\u2139\uFE0F Commands (${currentPage}/${totalPages})`, ''];
  lines.push(formatCommandList(pageItems));
  return {
    text: lines.join('\n').trim(),
    totalPages,
    currentPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
}
export {
  buildCommandsMessage,
  buildCommandsMessagePaginated,
  buildHelpMessage,
  buildStatusMessage,
  formatContextUsageShort,
  formatTokenCount
};
