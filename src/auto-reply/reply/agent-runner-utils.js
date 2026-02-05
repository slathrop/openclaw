import { getChannelDock } from '../../channels/dock.js';
import { normalizeAnyChannelId, normalizeChannelId } from '../../channels/registry.js';
import { isReasoningTagProvider } from '../../utils/provider-utils.js';
import { estimateUsageCost, formatTokenCount, formatUsd } from '../../utils/usage-format.js';
const BUN_FETCH_SOCKET_ERROR_RE = /socket connection was closed unexpectedly/i;
function buildThreadingToolContext(params) {
  const { sessionCtx, config, hasRepliedRef } = params;
  if (!config) {
    return {};
  }
  const rawProvider = sessionCtx.Provider?.trim().toLowerCase();
  if (!rawProvider) {
    return {};
  }
  const provider = normalizeChannelId(rawProvider) ?? normalizeAnyChannelId(rawProvider);
  const dock = provider ? getChannelDock(provider) : void 0;
  if (!dock?.threading?.buildToolContext) {
    return {
      currentChannelId: sessionCtx.To?.trim() || void 0,
      currentChannelProvider: provider ?? rawProvider,
      hasRepliedRef
    };
  }
  const context = dock.threading.buildToolContext({
    cfg: config,
    accountId: sessionCtx.AccountId,
    context: {
      Channel: sessionCtx.Provider,
      From: sessionCtx.From,
      To: sessionCtx.To,
      ChatType: sessionCtx.ChatType,
      ReplyToId: sessionCtx.ReplyToId,
      ThreadLabel: sessionCtx.ThreadLabel,
      MessageThreadId: sessionCtx.MessageThreadId
    },
    hasRepliedRef
  }) ?? {};
  return {
    ...context,
    currentChannelProvider: provider
    // guaranteed non-null since dock exists
  };
}
const isBunFetchSocketError = (message) => Boolean(message && BUN_FETCH_SOCKET_ERROR_RE.test(message));
const formatBunFetchSocketError = (message) => {
  const trimmed = message.trim();
  return [
    '\u26A0\uFE0F LLM connection failed. This could be due to server issues, network problems, or context length exceeded (e.g., with local LLMs like LM Studio). Original error:',
    '```',
    trimmed || 'Unknown error',
    '```'
  ].join('\n');
};
const formatResponseUsageLine = (params) => {
  const usage = params.usage;
  if (!usage) {
    return null;
  }
  const input = usage.input;
  const output = usage.output;
  if (typeof input !== 'number' && typeof output !== 'number') {
    return null;
  }
  const inputLabel = typeof input === 'number' ? formatTokenCount(input) : '?';
  const outputLabel = typeof output === 'number' ? formatTokenCount(output) : '?';
  const cost = params.showCost && typeof input === 'number' && typeof output === 'number' ? estimateUsageCost({
    usage: {
      input,
      output,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite
    },
    cost: params.costConfig
  }) : void 0;
  const costLabel = params.showCost ? formatUsd(cost) : void 0;
  const suffix = costLabel ? ` \xB7 est ${costLabel}` : '';
  return `Usage: ${inputLabel} in / ${outputLabel} out${suffix}`;
};
const appendUsageLine = (payloads, line) => {
  let index = -1;
  for (let i = payloads.length - 1; i >= 0; i -= 1) {
    if (payloads[i]?.text) {
      index = i;
      break;
    }
  }
  if (index === -1) {
    return [...payloads, { text: line }];
  }
  const existing = payloads[index];
  const existingText = existing.text ?? '';
  const separator = existingText.endsWith('\n') ? '' : '\n';
  const next = {
    ...existing,
    text: `${existingText}${separator}${line}`
  };
  const updated = payloads.slice();
  updated[index] = next;
  return updated;
};
const resolveEnforceFinalTag = (run, provider) => Boolean(run.enforceFinalTag || isReasoningTagProvider(provider));
export {
  appendUsageLine,
  buildThreadingToolContext,
  formatBunFetchSocketError,
  formatResponseUsageLine,
  isBunFetchSocketError,
  resolveEnforceFinalTag
};
