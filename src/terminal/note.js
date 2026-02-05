/**
 * Styled note display with word wrapping.
 *
 * Wraps text to fit terminal width while preserving bullet indentation,
 * then displays it using clack's note component with themed title styling.
 */
import { note as clackNote } from '@clack/prompts';
import { visibleWidth } from './ansi.js';
import { stylePromptTitle } from './prompt-style.js';

const splitLongWord = (word, maxLen) => {
  if (maxLen <= 0) {
    return [word];
  }
  const chars = Array.from(word);
  const parts = [];
  for (let i = 0; i < chars.length; i += maxLen) {
    parts.push(chars.slice(i, i + maxLen).join(''));
  }
  return parts.length > 0 ? parts : [word];
};

const wrapLine = (line, maxWidth) => {
  if (line.trim().length === 0) {
    return [line];
  }
  const match = line.match(/^(\s*)([-*\u2022]\s+)?(.*)$/);
  const indent = match?.[1] ?? '';
  const bullet = match?.[2] ?? '';
  const content = match?.[3] ?? '';
  const firstPrefix = `${indent}${bullet}`;
  const nextPrefix = `${indent}${bullet ? ' '.repeat(bullet.length) : ''}`;
  const firstWidth = Math.max(10, maxWidth - visibleWidth(firstPrefix));
  const nextWidth = Math.max(10, maxWidth - visibleWidth(nextPrefix));

  const words = content.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  let prefix = firstPrefix;
  let available = firstWidth;

  for (const word of words) {
    if (!current) {
      if (visibleWidth(word) > available) {
        const parts = splitLongWord(word, available);
        const first = parts.shift() ?? '';
        lines.push(prefix + first);
        prefix = nextPrefix;
        available = nextWidth;
        for (const part of parts) {
          lines.push(prefix + part);
        }
        continue;
      }
      current = word;
      continue;
    }

    const candidate = `${current} ${word}`;
    if (visibleWidth(candidate) <= available) {
      current = candidate;
      continue;
    }

    lines.push(prefix + current);
    prefix = nextPrefix;
    available = nextWidth;

    if (visibleWidth(word) > available) {
      const parts = splitLongWord(word, available);
      const first = parts.shift() ?? '';
      lines.push(prefix + first);
      for (const part of parts) {
        lines.push(prefix + part);
      }
      current = '';
      continue;
    }
    current = word;
  }

  if (current || words.length === 0) {
    lines.push(prefix + current);
  }

  return lines;
};

/**
 * @param {string} message
 * @param {object} [options]
 * @param {number} [options.maxWidth]
 * @param {number} [options.columns]
 * @returns {string}
 */
export const wrapNoteMessage = (message, options = {}) => {
  const columns = options.columns ?? process.stdout.columns ?? 80;
  const maxWidth = options.maxWidth ?? Math.max(40, Math.min(88, columns - 10));
  return message
    .split('\n')
    .flatMap((line) => wrapLine(line, maxWidth))
    .join('\n');
};

/**
 * @param {string} message
 * @param {string} [title]
 */
export const note = (message, title) => {
  clackNote(wrapNoteMessage(message), stylePromptTitle(title));
};
