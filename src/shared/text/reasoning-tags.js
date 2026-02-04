/**
 * Reasoning tag extraction and stripping utilities.
 *
 * Strips <think>, <thinking>, <thought>, <antthinking>, and <final> tags
 * from model output while preserving tags inside code blocks.
 */

/**
 * @typedef {'strict' | 'preserve'} ReasoningTagMode
 */

/**
 * @typedef {'none' | 'start' | 'both'} ReasoningTagTrim
 */

const QUICK_TAG_RE = /<\s*\/?\s*(?:think(?:ing)?|thought|antthinking|final)\b/i;
const FINAL_TAG_RE = /<\s*\/?\s*final\b[^<>]*>/gi;
const THINKING_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\b[^<>]*>/gi;

/**
 * Finds code regions (fenced and inline) in the given text.
 * @param {string} text
 * @returns {Array<{start: number, end: number}>}
 */
function findCodeRegions(text) {
  const regions = [];

  const fencedRe = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2(?:\n|$)|$)/g;
  for (const match of text.matchAll(fencedRe)) {
    const start = (match.index ?? 0) + match[1].length;
    regions.push({start, end: start + match[0].length - match[1].length});
  }

  const inlineRe = /`+[^`]+`+/g;
  for (const match of text.matchAll(inlineRe)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const insideFenced = regions.some((r) => start >= r.start && end <= r.end);
    if (!insideFenced) {
      regions.push({start, end});
    }
  }

  regions.sort((a, b) => a.start - b.start);
  return regions;
}

/**
 * Returns true if the given position falls inside a code region.
 * @param {number} pos
 * @param {Array<{start: number, end: number}>} regions
 * @returns {boolean}
 */
function isInsideCode(pos, regions) {
  return regions.some((r) => pos >= r.start && pos < r.end);
}

/**
 * Applies whitespace trimming based on the specified mode.
 * @param {string} value
 * @param {ReasoningTagTrim} mode
 * @returns {string}
 */
function applyTrim(value, mode) {
  if (mode === 'none') {
    return value;
  }
  if (mode === 'start') {
    return value.trimStart();
  }
  return value.trim();
}

/**
 * Strips reasoning tags from text while preserving tags inside code blocks.
 * @param {string} text
 * @param {object} [options]
 * @param {ReasoningTagMode} [options.mode]
 * @param {ReasoningTagTrim} [options.trim]
 * @returns {string}
 */
export function stripReasoningTagsFromText(text, options) {
  if (!text) {
    return text;
  }
  if (!QUICK_TAG_RE.test(text)) {
    return text;
  }

  const mode = options?.mode ?? 'strict';
  const trimMode = options?.trim ?? 'both';

  let cleaned = text;
  if (FINAL_TAG_RE.test(cleaned)) {
    FINAL_TAG_RE.lastIndex = 0;
    const finalMatches = [];
    const preCodeRegions = findCodeRegions(cleaned);
    for (const match of cleaned.matchAll(FINAL_TAG_RE)) {
      const start = match.index ?? 0;
      finalMatches.push({
        start,
        length: match[0].length,
        inCode: isInsideCode(start, preCodeRegions)
      });
    }

    for (let i = finalMatches.length - 1; i >= 0; i--) {
      const m = finalMatches[i];
      if (!m.inCode) {
        cleaned = cleaned.slice(0, m.start) + cleaned.slice(m.start + m.length);
      }
    }
  } else {
    FINAL_TAG_RE.lastIndex = 0;
  }

  const codeRegions = findCodeRegions(cleaned);

  THINKING_TAG_RE.lastIndex = 0;
  let result = '';
  let lastIndex = 0;
  let inThinking = false;

  for (const match of cleaned.matchAll(THINKING_TAG_RE)) {
    const idx = match.index ?? 0;
    const isClose = match[1] === '/';

    if (isInsideCode(idx, codeRegions)) {
      continue;
    }

    if (!inThinking) {
      result += cleaned.slice(lastIndex, idx);
      if (!isClose) {
        inThinking = true;
      }
    } else if (isClose) {
      inThinking = false;
    }

    lastIndex = idx + match[0].length;
  }

  if (!inThinking || mode === 'preserve') {
    result += cleaned.slice(lastIndex);
  }

  return applyTrim(result, trimMode);
}
