import { findFenceSpanAt, isSafeFenceBreak, parseFenceSpans } from '../markdown/fences.js';
import { normalizeAccountId } from '../routing/session-key.js';
import { INTERNAL_MESSAGE_CHANNEL } from '../utils/message-channel.js';
const DEFAULT_CHUNK_LIMIT = 4e3;
const DEFAULT_CHUNK_MODE = 'length';
function resolveChunkLimitForProvider(cfgSection, accountId) {
  if (!cfgSection) {
    return void 0;
  }
  const normalizedAccountId = normalizeAccountId(accountId);
  const accounts = cfgSection.accounts;
  if (accounts && typeof accounts === 'object') {
    const direct = accounts[normalizedAccountId];
    if (typeof direct?.textChunkLimit === 'number') {
      return direct.textChunkLimit;
    }
    const matchKey = Object.keys(accounts).find(
      (key) => key.toLowerCase() === normalizedAccountId.toLowerCase()
    );
    const match = matchKey ? accounts[matchKey] : void 0;
    if (typeof match?.textChunkLimit === 'number') {
      return match.textChunkLimit;
    }
  }
  return cfgSection.textChunkLimit;
}
function resolveTextChunkLimit(cfg, provider, accountId, opts) {
  const fallback = typeof opts?.fallbackLimit === 'number' && opts.fallbackLimit > 0 ? opts.fallbackLimit : DEFAULT_CHUNK_LIMIT;
  const providerOverride = (() => {
    if (!provider || provider === INTERNAL_MESSAGE_CHANNEL) {
      return void 0;
    }
    const channelsConfig = cfg?.channels;
    const providerConfig = channelsConfig?.[provider] ?? cfg?.[provider];
    return resolveChunkLimitForProvider(providerConfig, accountId);
  })();
  if (typeof providerOverride === 'number' && providerOverride > 0) {
    return providerOverride;
  }
  return fallback;
}
function resolveChunkModeForProvider(cfgSection, accountId) {
  if (!cfgSection) {
    return void 0;
  }
  const normalizedAccountId = normalizeAccountId(accountId);
  const accounts = cfgSection.accounts;
  if (accounts && typeof accounts === 'object') {
    const direct = accounts[normalizedAccountId];
    if (direct?.chunkMode) {
      return direct.chunkMode;
    }
    const matchKey = Object.keys(accounts).find(
      (key) => key.toLowerCase() === normalizedAccountId.toLowerCase()
    );
    const match = matchKey ? accounts[matchKey] : void 0;
    if (match?.chunkMode) {
      return match.chunkMode;
    }
  }
  return cfgSection.chunkMode;
}
function resolveChunkMode(cfg, provider, accountId) {
  if (!provider || provider === INTERNAL_MESSAGE_CHANNEL) {
    return DEFAULT_CHUNK_MODE;
  }
  const channelsConfig = cfg?.channels;
  const providerConfig = channelsConfig?.[provider] ?? cfg?.[provider];
  const mode = resolveChunkModeForProvider(providerConfig, accountId);
  return mode ?? DEFAULT_CHUNK_MODE;
}
function chunkByNewline(text, maxLineLength, opts) {
  if (!text) {
    return [];
  }
  if (maxLineLength <= 0) {
    return text.trim() ? [text] : [];
  }
  const splitLongLines = opts?.splitLongLines !== false;
  const trimLines = opts?.trimLines !== false;
  const lines = splitByNewline(text, opts?.isSafeBreak);
  const chunks = [];
  let pendingBlankLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      pendingBlankLines += 1;
      continue;
    }
    const maxPrefix = Math.max(0, maxLineLength - 1);
    const cappedBlankLines = pendingBlankLines > 0 ? Math.min(pendingBlankLines, maxPrefix) : 0;
    const prefix = cappedBlankLines > 0 ? '\n'.repeat(cappedBlankLines) : '';
    pendingBlankLines = 0;
    const lineValue = trimLines ? trimmed : line;
    if (!splitLongLines || lineValue.length + prefix.length <= maxLineLength) {
      chunks.push(prefix + lineValue);
      continue;
    }
    const firstLimit = Math.max(1, maxLineLength - prefix.length);
    const first = lineValue.slice(0, firstLimit);
    chunks.push(prefix + first);
    const remaining = lineValue.slice(firstLimit);
    if (remaining) {
      chunks.push(...chunkText(remaining, maxLineLength));
    }
  }
  if (pendingBlankLines > 0 && chunks.length > 0) {
    chunks[chunks.length - 1] += '\n'.repeat(pendingBlankLines);
  }
  return chunks;
}
function chunkByParagraph(text, limit, opts) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  const splitLongParagraphs = opts?.splitLongParagraphs !== false;
  const normalized = text.replace(/\r\n?/g, '\n');
  const paragraphRe = /\n[\t ]*\n+/;
  if (!paragraphRe.test(normalized)) {
    if (normalized.length <= limit) {
      return [normalized];
    }
    if (!splitLongParagraphs) {
      return [normalized];
    }
    return chunkText(normalized, limit);
  }
  const spans = parseFenceSpans(normalized);
  const parts = [];
  const re = /\n[\t ]*\n+/g;
  let lastIndex = 0;
  for (const match of normalized.matchAll(re)) {
    const idx = match.index ?? 0;
    if (!isSafeFenceBreak(spans, idx)) {
      continue;
    }
    parts.push(normalized.slice(lastIndex, idx));
    lastIndex = idx + match[0].length;
  }
  parts.push(normalized.slice(lastIndex));
  const chunks = [];
  for (const part of parts) {
    const paragraph = part.replace(/\s+$/g, '');
    if (!paragraph.trim()) {
      continue;
    }
    if (paragraph.length <= limit) {
      chunks.push(paragraph);
    } else if (!splitLongParagraphs) {
      chunks.push(paragraph);
    } else {
      chunks.push(...chunkText(paragraph, limit));
    }
  }
  return chunks;
}
function chunkTextWithMode(text, limit, mode) {
  if (mode === 'newline') {
    return chunkByParagraph(text, limit);
  }
  return chunkText(text, limit);
}
function chunkMarkdownTextWithMode(text, limit, mode) {
  if (mode === 'newline') {
    const paragraphChunks = chunkByParagraph(text, limit, { splitLongParagraphs: false });
    const out = [];
    for (const chunk of paragraphChunks) {
      const nested = chunkMarkdownText(chunk, limit);
      if (!nested.length && chunk) {
        out.push(chunk);
      } else {
        out.push(...nested);
      }
    }
    return out;
  }
  return chunkMarkdownText(text, limit);
}
function splitByNewline(text, isSafeBreak = () => true) {
  const lines = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n' && isSafeBreak(i)) {
      lines.push(text.slice(start, i));
      start = i + 1;
    }
  }
  lines.push(text.slice(start));
  return lines;
}
function chunkText(text, limit) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  if (text.length <= limit) {
    return [text];
  }
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const { lastNewline, lastWhitespace } = scanParenAwareBreakpoints(window);
    let breakIdx = lastNewline > 0 ? lastNewline : lastWhitespace;
    if (breakIdx <= 0) {
      breakIdx = limit;
    }
    const rawChunk = remaining.slice(0, breakIdx);
    const chunk = rawChunk.trimEnd();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    const brokeOnSeparator = breakIdx < remaining.length && /\s/.test(remaining[breakIdx]);
    const nextStart = Math.min(remaining.length, breakIdx + (brokeOnSeparator ? 1 : 0));
    remaining = remaining.slice(nextStart).trimStart();
  }
  if (remaining.length) {
    chunks.push(remaining);
  }
  return chunks;
}
function chunkMarkdownText(text, limit) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  if (text.length <= limit) {
    return [text];
  }
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    const spans = parseFenceSpans(remaining);
    const window = remaining.slice(0, limit);
    const softBreak = pickSafeBreakIndex(window, spans);
    let breakIdx = softBreak > 0 ? softBreak : limit;
    const initialFence = isSafeFenceBreak(spans, breakIdx) ? void 0 : findFenceSpanAt(spans, breakIdx);
    let fenceToSplit = initialFence;
    if (initialFence) {
      const closeLine = `${initialFence.indent}${initialFence.marker}`;
      const maxIdxIfNeedNewline = limit - (closeLine.length + 1);
      if (maxIdxIfNeedNewline <= 0) {
        fenceToSplit = void 0;
        breakIdx = limit;
      } else {
        const minProgressIdx = Math.min(
          remaining.length,
          initialFence.start + initialFence.openLine.length + 2
        );
        const maxIdxIfAlreadyNewline = limit - closeLine.length;
        let pickedNewline = false;
        let lastNewline = remaining.lastIndexOf('\n', Math.max(0, maxIdxIfAlreadyNewline - 1));
        while (lastNewline !== -1) {
          const candidateBreak = lastNewline + 1;
          if (candidateBreak < minProgressIdx) {
            break;
          }
          const candidateFence = findFenceSpanAt(spans, candidateBreak);
          if (candidateFence && candidateFence.start === initialFence.start) {
            breakIdx = Math.max(1, candidateBreak);
            pickedNewline = true;
            break;
          }
          lastNewline = remaining.lastIndexOf('\n', lastNewline - 1);
        }
        if (!pickedNewline) {
          if (minProgressIdx > maxIdxIfAlreadyNewline) {
            fenceToSplit = void 0;
            breakIdx = limit;
          } else {
            breakIdx = Math.max(minProgressIdx, maxIdxIfNeedNewline);
          }
        }
      }
      const fenceAtBreak = findFenceSpanAt(spans, breakIdx);
      fenceToSplit = fenceAtBreak && fenceAtBreak.start === initialFence.start ? fenceAtBreak : void 0;
    }
    let rawChunk = remaining.slice(0, breakIdx);
    if (!rawChunk) {
      break;
    }
    const brokeOnSeparator = breakIdx < remaining.length && /\s/.test(remaining[breakIdx]);
    const nextStart = Math.min(remaining.length, breakIdx + (brokeOnSeparator ? 1 : 0));
    let next = remaining.slice(nextStart);
    if (fenceToSplit) {
      const closeLine = `${fenceToSplit.indent}${fenceToSplit.marker}`;
      rawChunk = rawChunk.endsWith('\n') ? `${rawChunk}${closeLine}` : `${rawChunk}
${closeLine}`;
      next = `${fenceToSplit.openLine}
${next}`;
    } else {
      next = stripLeadingNewlines(next);
    }
    chunks.push(rawChunk);
    remaining = next;
  }
  if (remaining.length) {
    chunks.push(remaining);
  }
  return chunks;
}
function stripLeadingNewlines(value) {
  let i = 0;
  while (i < value.length && value[i] === '\n') {
    i++;
  }
  return i > 0 ? value.slice(i) : value;
}
function pickSafeBreakIndex(window, spans) {
  const { lastNewline, lastWhitespace } = scanParenAwareBreakpoints(
    window,
    (index) => isSafeFenceBreak(spans, index)
  );
  if (lastNewline > 0) {
    return lastNewline;
  }
  if (lastWhitespace > 0) {
    return lastWhitespace;
  }
  return -1;
}
function scanParenAwareBreakpoints(window, isAllowed = () => true) {
  let lastNewline = -1;
  let lastWhitespace = -1;
  let depth = 0;
  for (let i = 0; i < window.length; i++) {
    if (!isAllowed(i)) {
      continue;
    }
    const char = window[i];
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')' && depth > 0) {
      depth -= 1;
      continue;
    }
    if (depth !== 0) {
      continue;
    }
    if (char === '\n') {
      lastNewline = i;
    } else if (/\s/.test(char)) {
      lastWhitespace = i;
    }
  }
  return { lastNewline, lastWhitespace };
}
export {
  chunkByNewline,
  chunkByParagraph,
  chunkMarkdownText,
  chunkMarkdownTextWithMode,
  chunkText,
  chunkTextWithMode,
  resolveChunkMode,
  resolveTextChunkLimit
};
