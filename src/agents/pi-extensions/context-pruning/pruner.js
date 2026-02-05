/**
 * Core pruning algorithm for context window management.
 * @module agents/pi-extensions/context-pruning/pruner
 */
import { makeToolPrunablePredicate } from './tools.js';
const CHARS_PER_TOKEN_ESTIMATE = 4;
const IMAGE_CHAR_ESTIMATE = 8e3;
function asText(text) {
  return { type: 'text', text };
}
function collectTextSegments(content) {
  const parts = [];
  for (const block of content) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  return parts;
}
function estimateJoinedTextLength(parts) {
  if (parts.length === 0) {
    return 0;
  }
  let len = 0;
  for (const p of parts) {
    len += p.length;
  }
  len += Math.max(0, parts.length - 1);
  return len;
}
function takeHeadFromJoinedText(parts, maxChars) {
  if (maxChars <= 0 || parts.length === 0) {
    return '';
  }
  let remaining = maxChars;
  let out = '';
  for (let i = 0; i < parts.length && remaining > 0; i++) {
    if (i > 0) {
      out += '\n';
      remaining -= 1;
      if (remaining <= 0) {
        break;
      }
    }
    const p = parts[i];
    if (p.length <= remaining) {
      out += p;
      remaining -= p.length;
    } else {
      out += p.slice(0, remaining);
      remaining = 0;
    }
  }
  return out;
}
function takeTailFromJoinedText(parts, maxChars) {
  if (maxChars <= 0 || parts.length === 0) {
    return '';
  }
  let remaining = maxChars;
  const out = [];
  for (let i = parts.length - 1; i >= 0 && remaining > 0; i--) {
    const p = parts[i];
    if (p.length <= remaining) {
      out.push(p);
      remaining -= p.length;
    } else {
      out.push(p.slice(p.length - remaining));
      remaining = 0;
      break;
    }
    if (remaining > 0 && i > 0) {
      out.push('\n');
      remaining -= 1;
    }
  }
  out.reverse();
  return out.join('');
}
function hasImageBlocks(content) {
  for (const block of content) {
    if (block.type === 'image') {
      return true;
    }
  }
  return false;
}
function estimateMessageChars(message) {
  if (message.role === 'user') {
    const content = message.content;
    if (typeof content === 'string') {
      return content.length;
    }
    let chars = 0;
    for (const b of content) {
      if (b.type === 'text') {
        chars += b.text.length;
      }
      if (b.type === 'image') {
        chars += IMAGE_CHAR_ESTIMATE;
      }
    }
    return chars;
  }
  if (message.role === 'assistant') {
    let chars = 0;
    for (const b of message.content) {
      if (b.type === 'text') {
        chars += b.text.length;
      }
      if (b.type === 'thinking') {
        chars += b.thinking.length;
      }
      if (b.type === 'toolCall') {
        try {
          chars += JSON.stringify(b.arguments ?? {}).length;
        } catch {
          chars += 128;
        }
      }
    }
    return chars;
  }
  if (message.role === 'toolResult') {
    let chars = 0;
    for (const b of message.content) {
      if (b.type === 'text') {
        chars += b.text.length;
      }
      if (b.type === 'image') {
        chars += IMAGE_CHAR_ESTIMATE;
      }
    }
    return chars;
  }
  return 256;
}
function estimateContextChars(messages) {
  return messages.reduce((sum, m) => sum + estimateMessageChars(m), 0);
}
function findAssistantCutoffIndex(messages, keepLastAssistants) {
  if (keepLastAssistants <= 0) {
    return messages.length;
  }
  let remaining = keepLastAssistants;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'assistant') {
      continue;
    }
    remaining--;
    if (remaining === 0) {
      return i;
    }
  }
  return null;
}
function findFirstUserIndex(messages) {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.role === 'user') {
      return i;
    }
  }
  return null;
}
function softTrimToolResultMessage(params) {
  const { msg, settings } = params;
  if (hasImageBlocks(msg.content)) {
    return null;
  }
  const parts = collectTextSegments(msg.content);
  const rawLen = estimateJoinedTextLength(parts);
  if (rawLen <= settings.softTrim.maxChars) {
    return null;
  }
  const headChars = Math.max(0, settings.softTrim.headChars);
  const tailChars = Math.max(0, settings.softTrim.tailChars);
  if (headChars + tailChars >= rawLen) {
    return null;
  }
  const head = takeHeadFromJoinedText(parts, headChars);
  const tail = takeTailFromJoinedText(parts, tailChars);
  const trimmed = `${head}
...
${tail}`;
  const note = `

[Tool result trimmed: kept first ${headChars} chars and last ${tailChars} chars of ${rawLen} chars.]`;
  return { ...msg, content: [asText(trimmed + note)] };
}
function pruneContextMessages(params) {
  const { messages, settings, ctx } = params;
  const contextWindowTokens = typeof params.contextWindowTokensOverride === 'number' && Number.isFinite(params.contextWindowTokensOverride) && params.contextWindowTokensOverride > 0 ? params.contextWindowTokensOverride : ctx.model?.contextWindow;
  if (!contextWindowTokens || contextWindowTokens <= 0) {
    return messages;
  }
  const charWindow = contextWindowTokens * CHARS_PER_TOKEN_ESTIMATE;
  if (charWindow <= 0) {
    return messages;
  }
  const cutoffIndex = findAssistantCutoffIndex(messages, settings.keepLastAssistants);
  if (cutoffIndex === null) {
    return messages;
  }
  const firstUserIndex = findFirstUserIndex(messages);
  const pruneStartIndex = firstUserIndex === null ? messages.length : firstUserIndex;
  const isToolPrunable = params.isToolPrunable ?? makeToolPrunablePredicate(settings.tools);
  const totalCharsBefore = estimateContextChars(messages);
  let totalChars = totalCharsBefore;
  let ratio = totalChars / charWindow;
  if (ratio < settings.softTrimRatio) {
    return messages;
  }
  const prunableToolIndexes = [];
  let next = null;
  for (let i = pruneStartIndex; i < cutoffIndex; i++) {
    const msg = messages[i];
    if (!msg || msg.role !== 'toolResult') {
      continue;
    }
    if (!isToolPrunable(msg.toolName)) {
      continue;
    }
    if (hasImageBlocks(msg.content)) {
      continue;
    }
    prunableToolIndexes.push(i);
    const updated = softTrimToolResultMessage({
      msg,
      settings
    });
    if (!updated) {
      continue;
    }
    const beforeChars = estimateMessageChars(msg);
    const afterChars = estimateMessageChars(updated);
    totalChars += afterChars - beforeChars;
    if (!next) {
      next = messages.slice();
    }
    next[i] = updated;
  }
  const outputAfterSoftTrim = next ?? messages;
  ratio = totalChars / charWindow;
  if (ratio < settings.hardClearRatio) {
    return outputAfterSoftTrim;
  }
  if (!settings.hardClear.enabled) {
    return outputAfterSoftTrim;
  }
  let prunableToolChars = 0;
  for (const i of prunableToolIndexes) {
    const msg = outputAfterSoftTrim[i];
    if (!msg || msg.role !== 'toolResult') {
      continue;
    }
    prunableToolChars += estimateMessageChars(msg);
  }
  if (prunableToolChars < settings.minPrunableToolChars) {
    return outputAfterSoftTrim;
  }
  for (const i of prunableToolIndexes) {
    if (ratio < settings.hardClearRatio) {
      break;
    }
    const msg = (next ?? messages)[i];
    if (!msg || msg.role !== 'toolResult') {
      continue;
    }
    const beforeChars = estimateMessageChars(msg);
    const cleared = {
      ...msg,
      content: [asText(settings.hardClear.placeholder)]
    };
    if (!next) {
      next = messages.slice();
    }
    next[i] = cleared;
    const afterChars = estimateMessageChars(cleared);
    totalChars += afterChars - beforeChars;
    ratio = totalChars / charWindow;
  }
  return next ?? messages;
}
export {
  pruneContextMessages
};
