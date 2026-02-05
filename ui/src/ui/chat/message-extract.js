import { stripThinkingTags } from '../format.js';
const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;
const ENVELOPE_CHANNELS = [
  'WebChat',
  'WhatsApp',
  'Telegram',
  'Signal',
  'Slack',
  'Discord',
  'iMessage',
  'Teams',
  'Matrix',
  'Zalo',
  'Zalo Personal',
  'BlueBubbles'
];
const textCache = /* @__PURE__ */ new WeakMap();
const thinkingCache = /* @__PURE__ */ new WeakMap();
function looksLikeEnvelopeHeader(header) {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) {
    return true;
  }
  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) {
    return true;
  }
  return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
}
function stripEnvelope(text) {
  const match = text.match(ENVELOPE_PREFIX);
  if (!match) {
    return text;
  }
  const header = match[1] ?? '';
  if (!looksLikeEnvelopeHeader(header)) {
    return text;
  }
  return text.slice(match[0].length);
}
function extractText(message) {
  const m = message;
  const role = typeof m.role === 'string' ? m.role : '';
  const content = m.content;
  if (typeof content === 'string') {
    const processed = role === 'assistant' ? stripThinkingTags(content) : stripEnvelope(content);
    return processed;
  }
  if (Array.isArray(content)) {
    const parts = content.map((p) => {
      const item = p;
      if (item.type === 'text' && typeof item.text === 'string') {
        return item.text;
      }
      return null;
    }).filter((v) => typeof v === 'string');
    if (parts.length > 0) {
      const joined = parts.join('\n');
      const processed = role === 'assistant' ? stripThinkingTags(joined) : stripEnvelope(joined);
      return processed;
    }
  }
  if (typeof m.text === 'string') {
    const processed = role === 'assistant' ? stripThinkingTags(m.text) : stripEnvelope(m.text);
    return processed;
  }
  return null;
}
function extractTextCached(message) {
  if (!message || typeof message !== 'object') {
    return extractText(message);
  }
  const obj = message;
  if (textCache.has(obj)) {
    return textCache.get(obj) ?? null;
  }
  const value = extractText(message);
  textCache.set(obj, value);
  return value;
}
function extractThinking(message) {
  const m = message;
  const content = m.content;
  const parts = [];
  if (Array.isArray(content)) {
    for (const p of content) {
      const item = p;
      if (item.type === 'thinking' && typeof item.thinking === 'string') {
        const cleaned = item.thinking.trim();
        if (cleaned) {
          parts.push(cleaned);
        }
      }
    }
  }
  if (parts.length > 0) {
    return parts.join('\n');
  }
  const rawText = extractRawText(message);
  if (!rawText) {
    return null;
  }
  const matches = [
    ...rawText.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)
  ];
  const extracted = matches.map((m2) => (m2[1] ?? '').trim()).filter(Boolean);
  return extracted.length > 0 ? extracted.join('\n') : null;
}
function extractThinkingCached(message) {
  if (!message || typeof message !== 'object') {
    return extractThinking(message);
  }
  const obj = message;
  if (thinkingCache.has(obj)) {
    return thinkingCache.get(obj) ?? null;
  }
  const value = extractThinking(message);
  thinkingCache.set(obj, value);
  return value;
}
function extractRawText(message) {
  const m = message;
  const content = m.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content.map((p) => {
      const item = p;
      if (item.type === 'text' && typeof item.text === 'string') {
        return item.text;
      }
      return null;
    }).filter((v) => typeof v === 'string');
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }
  if (typeof m.text === 'string') {
    return m.text;
  }
  return null;
}
function formatReasoningMarkdown(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => `_${line}_`);
  return lines.length ? ['_Reasoning:_', ...lines].join('\n') : '';
}
export {
  extractRawText,
  extractText,
  extractTextCached,
  extractThinking,
  extractThinkingCached,
  formatReasoningMarkdown,
  stripEnvelope
};
