/**
 * Themed prompt styling helpers.
 *
 * Applies lobster palette accent colors to prompt messages,
 * titles, and hints when running in a rich terminal environment.
 */
import { isRich, theme } from './theme.js';

/** @param {string} message */
export const stylePromptMessage = (message) =>
  isRich() ? theme.accent(message) : message;

/** @param {string} [title] */
export const stylePromptTitle = (title) =>
  title && isRich() ? theme.heading(title) : title;

/** @param {string} [hint] */
export const stylePromptHint = (hint) =>
  hint && isRich() ? theme.muted(hint) : hint;
