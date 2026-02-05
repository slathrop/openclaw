 
import { formatRawAssistantErrorForUi } from '../agents/pi-embedded-helpers.js';
import { formatTokenCount } from '../utils/usage-format.js';
function resolveFinalAssistantText(params) {
  const finalText = params.finalText ?? '';
  if (finalText.trim()) {
    return finalText;
  }
  const streamedText = params.streamedText ?? '';
  if (streamedText.trim()) {
    return streamedText;
  }
  return '(no output)';
}
function composeThinkingAndContent(params) {
  const thinkingText = params.thinkingText?.trim() ?? '';
  const contentText = params.contentText?.trim() ?? '';
  const parts = [];
  if (params.showThinking && thinkingText) {
    parts.push(`[thinking]
${thinkingText}`);
  }
  if (contentText) {
    parts.push(contentText);
  }
  return parts.join('\n\n').trim();
}
function extractThinkingFromMessage(message) {
  if (!message || typeof message !== 'object') {
    return '';
  }
  const record = message;
  const content = record.content;
  if (typeof content === 'string') {
    return '';
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const rec = block;
    if (rec.type === 'thinking' && typeof rec.thinking === 'string') {
      parts.push(rec.thinking);
    }
  }
  return parts.join('\n').trim();
}
function extractContentFromMessage(message) {
  if (!message || typeof message !== 'object') {
    return '';
  }
  const record = message;
  const content = record.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    const stopReason = typeof record.stopReason === 'string' ? record.stopReason : '';
    if (stopReason === 'error') {
      const errorMessage = typeof record.errorMessage === 'string' ? record.errorMessage : '';
      return formatRawAssistantErrorForUi(errorMessage);
    }
    return '';
  }
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const rec = block;
    if (rec.type === 'text' && typeof rec.text === 'string') {
      parts.push(rec.text);
    }
  }
  if (parts.length === 0) {
    const stopReason = typeof record.stopReason === 'string' ? record.stopReason : '';
    if (stopReason === 'error') {
      const errorMessage = typeof record.errorMessage === 'string' ? record.errorMessage : '';
      return formatRawAssistantErrorForUi(errorMessage);
    }
  }
  return parts.join('\n').trim();
}
function extractTextBlocks(content, opts) {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const thinkingParts = [];
  const textParts = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const record = block;
    if (record.type === 'text' && typeof record.text === 'string') {
      textParts.push(record.text);
    }
    if (opts?.includeThinking && record.type === 'thinking' && typeof record.thinking === 'string') {
      thinkingParts.push(record.thinking);
    }
  }
  return composeThinkingAndContent({
    thinkingText: thinkingParts.join('\n').trim(),
    contentText: textParts.join('\n').trim(),
    showThinking: opts?.includeThinking ?? false
  });
}
function extractTextFromMessage(message, opts) {
  if (!message || typeof message !== 'object') {
    return '';
  }
  const record = message;
  const text = extractTextBlocks(record.content, opts);
  if (text) {
    return text;
  }
  const stopReason = typeof record.stopReason === 'string' ? record.stopReason : '';
  if (stopReason !== 'error') {
    return '';
  }
  const errorMessage = typeof record.errorMessage === 'string' ? record.errorMessage : '';
  return formatRawAssistantErrorForUi(errorMessage);
}
function isCommandMessage(message) {
  if (!message || typeof message !== 'object') {
    return false;
  }
  return message.command === true;
}
function formatTokens(total, context) {
  if (total === null || total === undefined && context === null || context === undefined) {
    return 'tokens ?';
  }
  const totalLabel = total === null || total === undefined ? '?' : formatTokenCount(total);
  if (context === null || context === undefined) {
    return `tokens ${totalLabel}`;
  }
  const pct = typeof total === 'number' && context > 0 ? Math.min(999, Math.round(total / context * 100)) : null;
  return `tokens ${totalLabel}/${formatTokenCount(context)}${pct !== null ? ` (${pct}%)` : ''}`;
}
function formatContextUsageLine(params) {
  const totalLabel = typeof params.total === 'number' ? formatTokenCount(params.total) : '?';
  const ctxLabel = typeof params.context === 'number' ? formatTokenCount(params.context) : '?';
  const pct = typeof params.percent === 'number' ? Math.min(999, Math.round(params.percent)) : null;
  const remainingLabel = typeof params.remaining === 'number' ? `${formatTokenCount(params.remaining)} left` : null;
  const pctLabel = pct !== null ? `${pct}%` : null;
  const extra = [remainingLabel, pctLabel].filter(Boolean).join(', ');
  return `tokens ${totalLabel}/${ctxLabel}${extra ? ` (${extra})` : ''}`;
}
function asString(value, fallback = '') {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}
export {
  asString,
  composeThinkingAndContent,
  extractContentFromMessage,
  extractTextFromMessage,
  extractThinkingFromMessage,
  formatContextUsageLine,
  formatTokens,
  isCommandMessage,
  resolveFinalAssistantText
};
