/**
 * Config environment variable collection.
 *
 * Extracts user-defined environment variables from config's `env` section,
 * merging both env.vars and top-level env entries (excluding reserved keys).
 */

/**
 * Collects environment variables defined in the config's env section.
 * @param {import('./types.js').OpenClawConfig} [cfg]
 * @returns {Record<string, string>}
 */
export function collectConfigEnvVars(cfg) {
  const envConfig = cfg?.env;
  if (!envConfig) {
    return {};
  }

  const entries = {};

  if (envConfig.vars) {
    for (const [key, value] of Object.entries(envConfig.vars)) {
      if (!value) {
        continue;
      }
      entries[key] = value;
    }
  }

  for (const [key, value] of Object.entries(envConfig)) {
    if (key === 'shellEnv' || key === 'vars') {
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      continue;
    }
    entries[key] = value;
  }

  return entries;
}
