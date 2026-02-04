/**
 * @module telegram-custom-commands
 * Telegram bot custom command configuration and validation.
 */

export const TELEGRAM_COMMAND_NAME_PATTERN = /^[a-z0-9_]{1,32}$/;

/**
 * @typedef {{ index: number, field: 'command' | 'description', message: string }} TelegramCustomCommandIssue
 */

/**
 * Normalizes a Telegram command name (strips leading slash, lowercases).
 * @param {string} value
 * @returns {string}
 */
export function normalizeTelegramCommandName(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return withoutSlash.trim().toLowerCase();
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeTelegramCommandDescription(value) {
  return value.trim();
}

/**
 * Resolves and validates custom Telegram commands from config.
 * @param {{ commands?: Array<{ command?: string | null, description?: string | null }> | null, reservedCommands?: Set<string>, checkReserved?: boolean, checkDuplicates?: boolean }} params
 * @returns {{ commands: Array<{ command: string, description: string }>, issues: TelegramCustomCommandIssue[] }}
 */
export function resolveTelegramCustomCommands(params) {
  const entries = Array.isArray(params.commands) ? params.commands : [];
  const reserved = params.reservedCommands ?? new Set();
  const checkReserved = params.checkReserved !== false;
  const checkDuplicates = params.checkDuplicates !== false;
  const seen = new Set();
  const resolved = [];
  const issues = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const normalized = normalizeTelegramCommandName(String(entry?.command ?? ''));
    if (!normalized) {
      issues.push({
        index,
        field: 'command',
        message: 'Telegram custom command is missing a command name.'
      });
      continue;
    }
    if (!TELEGRAM_COMMAND_NAME_PATTERN.test(normalized)) {
      issues.push({
        index,
        field: 'command',
        message: `Telegram custom command "/${normalized}" is invalid (use a-z, 0-9, underscore; max 32 chars).`
      });
      continue;
    }
    if (checkReserved && reserved.has(normalized)) {
      issues.push({
        index,
        field: 'command',
        message: `Telegram custom command "/${normalized}" conflicts with a native command.`
      });
      continue;
    }
    if (checkDuplicates && seen.has(normalized)) {
      issues.push({
        index,
        field: 'command',
        message: `Telegram custom command "/${normalized}" is duplicated.`
      });
      continue;
    }
    const description = normalizeTelegramCommandDescription(String(entry?.description ?? ''));
    if (!description) {
      issues.push({
        index,
        field: 'description',
        message: `Telegram custom command "/${normalized}" is missing a description.`
      });
      continue;
    }
    if (checkDuplicates) {
      seen.add(normalized);
    }
    resolved.push({ command: normalized, description });
  }

  return { commands: resolved, issues };
}
