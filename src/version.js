/**
 * @module version
 * OpenClaw version resolution.
 *
 * Provides a single source of truth for the current version. In production
 * bundles, rolldown injects __OPENCLAW_VERSION__ at build time via the
 * `define` config. In dev/test, falls back to package.json or build-info.json.
 */
import {createRequire} from 'node:module';

/**
 * Reads the version from the nearest package.json.
 * @returns {string | null}
 */
function readVersionFromPackageJson() {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads the version from a build-info.json sidecar file.
 * @returns {string | null}
 */
function readVersionFromBuildInfo() {
  try {
    const require = createRequire(import.meta.url);
    const candidates = ['../build-info.json', './build-info.json'];
    for (const candidate of candidates) {
      try {
        const info = require(candidate);
        if (info.version) {
          return info.version;
        }
      } catch {
        // ignore missing candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Single source of truth for the current OpenClaw version.
// - Embedded/bundled builds: injected define or env var.
// - Dev/npm builds: package.json.
/* eslint-disable no-undef -- __OPENCLAW_VERSION__ is injected by rolldown at build time */
export const VERSION =
  (typeof __OPENCLAW_VERSION__ === 'string' && __OPENCLAW_VERSION__) ||
  process.env.OPENCLAW_BUNDLED_VERSION ||
  readVersionFromPackageJson() ||
  readVersionFromBuildInfo() ||
  '0.0.0';
/* eslint-enable no-undef */
