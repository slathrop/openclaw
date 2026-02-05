import { stripReasoningTagsFromText } from '../../../src/shared/text/reasoning-tags.js';
function formatMs(ms) {
  if (!ms && ms !== 0) {
    return 'n/a';
  }
  return new Date(ms).toLocaleString();
}
function formatAgo(ms) {
  if (!ms && ms !== 0) {
    return 'n/a';
  }
  const diff = Date.now() - ms;
  const absDiff = Math.abs(diff);
  const suffix = diff < 0 ? 'from now' : 'ago';
  const sec = Math.round(absDiff / 1e3);
  if (sec < 60) {
    return diff < 0 ? 'just now' : `${sec}s ago`;
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return `${min}m ${suffix}`;
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return `${hr}h ${suffix}`;
  }
  const day = Math.round(hr / 24);
  return `${day}d ${suffix}`;
}
function formatDurationMs(ms) {
  if (!ms && ms !== 0) {
    return 'n/a';
  }
  if (ms < 1e3) {
    return `${ms}ms`;
  }
  const sec = Math.round(ms / 1e3);
  if (sec < 60) {
    return `${sec}s`;
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return `${min}m`;
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return `${hr}h`;
  }
  const day = Math.round(hr / 24);
  return `${day}d`;
}
function formatList(values) {
  if (!values || values.length === 0) {
    return 'none';
  }
  return values.filter((v) => Boolean(v && v.trim())).join(', ');
}
function clampText(value, max = 120) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}\u2026`;
}
function truncateText(value, max) {
  if (value.length <= max) {
    return { text: value, truncated: false, total: value.length };
  }
  return {
    text: value.slice(0, Math.max(0, max)),
    truncated: true,
    total: value.length
  };
}
function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function parseList(input) {
  return input.split(/[,\n]/).map((v) => v.trim()).filter((v) => v.length > 0);
}
function stripThinkingTags(value) {
  return stripReasoningTagsFromText(value, { mode: 'preserve', trim: 'start' });
}
export {
  clampText,
  formatAgo,
  formatDurationMs,
  formatList,
  formatMs,
  parseList,
  stripThinkingTags,
  toNumber,
  truncateText
};
