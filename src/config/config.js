/**
 * Config barrel module -- re-exports the public config API surface.
 *
 * Aggregates config I/O, legacy migration, paths, runtime overrides,
 * types, validation, and schema exports into a single entry point.
 */
export {
  createConfigIO,
  loadConfig,
  parseConfigJson5,
  readConfigFileSnapshot,
  resolveConfigSnapshotHash,
  writeConfigFile
} from './io.js';
export { migrateLegacyConfig } from './legacy-migrate.js';
export * from './paths.js';
export * from './runtime-overrides.js';
export * from './types.js';
export { validateConfigObject, validateConfigObjectWithPlugins } from './validation.js';
export { OpenClawSchema } from './zod-schema.js';
