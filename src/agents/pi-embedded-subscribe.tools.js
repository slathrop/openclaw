/**
 * @module pi-embedded-subscribe.tools
 * Tool result formatting and truncation for embedded Pi subscriptions.
 */
import { getChannelPlugin, normalizeChannelId } from '../channels/plugins/index.js';
import { normalizeTargetForProvider } from '../infra/outbound/target-normalization.js';
import { truncateUtf16Safe } from '../utils.js';
const TOOL_RESULT_MAX_CHARS = 8e3;
const TOOL_ERROR_MAX_CHARS = 400;
function truncateToolText(text) {
  if (text.length <= TOOL_RESULT_MAX_CHARS) {
    return text;
  }
  return `${truncateUtf16Safe(text, TOOL_RESULT_MAX_CHARS)}
\u2026(truncated)\u2026`;
}
function normalizeToolErrorText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return void 0;
  }
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  if (!firstLine) {
    return void 0;
  }
  return firstLine.length > TOOL_ERROR_MAX_CHARS ? `${truncateUtf16Safe(firstLine, TOOL_ERROR_MAX_CHARS)}\u2026` : firstLine;
}
function readErrorCandidate(value) {
  if (typeof value === 'string') {
    return normalizeToolErrorText(value);
  }
  if (!value || typeof value !== 'object') {
    return void 0;
  }
  const record = value;
  if (typeof record.message === 'string') {
    return normalizeToolErrorText(record.message);
  }
  if (typeof record.error === 'string') {
    return normalizeToolErrorText(record.error);
  }
  return void 0;
}
function extractErrorField(value) {
  if (!value || typeof value !== 'object') {
    return void 0;
  }
  const record = value;
  const direct = readErrorCandidate(record.error) ?? readErrorCandidate(record.message) ?? readErrorCandidate(record.reason);
  if (direct) {
    return direct;
  }
  const status = typeof record.status === 'string' ? record.status.trim() : '';
  return status ? normalizeToolErrorText(status) : void 0;
}
function sanitizeToolResult(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }
  const record = result;
  const content = Array.isArray(record.content) ? record.content : null;
  if (!content) {
    return record;
  }
  const sanitized = content.map((item) => {
    if (!item || typeof item !== 'object') {
      return item;
    }
    const entry = item;
    const type = typeof entry.type === 'string' ? entry.type : void 0;
    if (type === 'text' && typeof entry.text === 'string') {
      return { ...entry, text: truncateToolText(entry.text) };
    }
    if (type === 'image') {
      const data = typeof entry.data === 'string' ? entry.data : void 0;
      const bytes = data ? data.length : void 0;
      const cleaned = { ...entry };
      delete cleaned.data;
      return { ...cleaned, bytes, omitted: true };
    }
    return entry;
  });
  return { ...record, content: sanitized };
}
function extractToolResultText(result) {
  if (!result || typeof result !== 'object') {
    return void 0;
  }
  const record = result;
  const content = Array.isArray(record.content) ? record.content : null;
  if (!content) {
    return void 0;
  }
  const texts = content.map((item) => {
    if (!item || typeof item !== 'object') {
      return void 0;
    }
    const entry = item;
    if (entry.type !== 'text' || typeof entry.text !== 'string') {
      return void 0;
    }
    const trimmed = entry.text.trim();
    return trimmed ? trimmed : void 0;
  }).filter((value) => Boolean(value));
  if (texts.length === 0) {
    return void 0;
  }
  return texts.join('\n');
}
function isToolResultError(result) {
  if (!result || typeof result !== 'object') {
    return false;
  }
  const record = result;
  const details = record.details;
  if (!details || typeof details !== 'object') {
    return false;
  }
  const status = details.status;
  if (typeof status !== 'string') {
    return false;
  }
  const normalized = status.trim().toLowerCase();
  return normalized === 'error' || normalized === 'timeout';
}
function extractToolErrorMessage(result) {
  if (!result || typeof result !== 'object') {
    return void 0;
  }
  const record = result;
  const fromDetails = extractErrorField(record.details);
  if (fromDetails) {
    return fromDetails;
  }
  const fromRoot = extractErrorField(record);
  if (fromRoot) {
    return fromRoot;
  }
  const text = extractToolResultText(result);
  if (!text) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(text);
    const fromJson = extractErrorField(parsed);
    if (fromJson) {
      return fromJson;
    }
  } catch {
    // JSON parse failed -- fall through to plain-text normalization
  }
  return normalizeToolErrorText(text);
}
function extractMessagingToolSend(toolName, args) {
  const action = typeof args.action === 'string' ? args.action.trim() : '';
  const accountIdRaw = typeof args.accountId === 'string' ? args.accountId.trim() : void 0;
  const accountId = accountIdRaw ? accountIdRaw : void 0;
  if (toolName === 'message') {
    if (action !== 'send' && action !== 'thread-reply') {
      return void 0;
    }
    const toRaw = typeof args.to === 'string' ? args.to : void 0;
    if (!toRaw) {
      return void 0;
    }
    const providerRaw = typeof args.provider === 'string' ? args.provider.trim() : '';
    const channelRaw = typeof args.channel === 'string' ? args.channel.trim() : '';
    const providerHint = providerRaw || channelRaw;
    const providerId2 = providerHint ? normalizeChannelId(providerHint) : null;
    const provider = providerId2 ?? (providerHint ? providerHint.toLowerCase() : 'message');
    const to2 = normalizeTargetForProvider(provider, toRaw);
    return to2 ? { tool: toolName, provider, accountId, to: to2 } : void 0;
  }
  const providerId = normalizeChannelId(toolName);
  if (!providerId) {
    return void 0;
  }
  const plugin = getChannelPlugin(providerId);
  const extracted = plugin?.actions?.extractToolSend?.({ args });
  if (!extracted?.to) {
    return void 0;
  }
  const to = normalizeTargetForProvider(providerId, extracted.to);
  return to ? {
    tool: toolName,
    provider: providerId,
    accountId: extracted.accountId ?? accountId,
    to
  } : void 0;
}
export {
  extractMessagingToolSend,
  extractToolErrorMessage,
  extractToolResultText,
  isToolResultError,
  sanitizeToolResult
};
