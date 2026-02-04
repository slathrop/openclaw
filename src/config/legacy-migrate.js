/**
 * Legacy config migration with validation.
 *
 * Orchestrates the full migration flow: applies legacy migrations,
 * then validates the result with plugin support. Returns null config
 * if either no migrations were needed or if the migrated config still
 * has validation errors.
 */
import { applyLegacyMigrations } from './legacy.js';
import { validateConfigObjectWithPlugins } from './validation.js';

/**
 * Attempts to migrate a raw config and validate the result.
 * @param {unknown} raw
 * @returns {{ config: import('./types.js').OpenClawConfig | null, changes: string[] }}
 */
export function migrateLegacyConfig(raw) {
  const { next, changes } = applyLegacyMigrations(raw);
  if (!next) {
    return { config: null, changes: [] };
  }
  const validated = validateConfigObjectWithPlugins(next);
  if (!validated.ok) {
    changes.push('Migration applied, but config still invalid; fix remaining issues manually.');
    return { config: null, changes };
  }
  return { config: validated.config, changes };
}
