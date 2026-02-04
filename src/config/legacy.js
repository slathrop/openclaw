/**
 * Legacy config detection and migration entry point.
 *
 * findLegacyConfigIssues() scans a raw config for deprecated keys
 * (checked against LEGACY_CONFIG_RULES) and returns user-facing warnings.
 * applyLegacyMigrations() applies the ordered migration pipeline to
 * transform legacy config structures into the current format.
 */
import { LEGACY_CONFIG_MIGRATIONS } from './legacy.migrations.js';
import { LEGACY_CONFIG_RULES } from './legacy.rules.js';

/**
 * Scans a raw config object for deprecated legacy keys.
 * @param {unknown} raw
 * @returns {Array<{ path: string, message: string }>}
 */
export function findLegacyConfigIssues(raw) {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const root = raw;
  const issues = [];
  for (const rule of LEGACY_CONFIG_RULES) {
    let cursor = root;
    for (const key of rule.path) {
      if (!cursor || typeof cursor !== 'object') {
        cursor = undefined;
        break;
      }
      cursor = cursor[key];
    }
    if (cursor !== undefined && (!rule.match || rule.match(cursor, root))) {
      issues.push({ path: rule.path.join('.'), message: rule.message });
    }
  }
  return issues;
}

/**
 * Applies the ordered legacy migration pipeline to a raw config.
 * @param {unknown} raw
 * @returns {{ next: Record<string, unknown> | null, changes: string[] }}
 */
export function applyLegacyMigrations(raw) {
  if (!raw || typeof raw !== 'object') {
    return { next: null, changes: [] };
  }
  const next = structuredClone(raw);
  const changes = [];
  for (const migration of LEGACY_CONFIG_MIGRATIONS) {
    migration.apply(next, changes);
  }
  if (changes.length === 0) {
    return { next: null, changes: [] };
  }
  return { next, changes };
}
