/**
 * @module test-helpers
 * Shared test utilities for config module tests.
 */
import { vi } from 'vitest';
import { withTempHome as withTempHomeBase } from '../../test/helpers/temp-home.js';

/**
 * @param {(home: string) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withTempHome(fn) {
  return withTempHomeBase(fn, { prefix: 'openclaw-config-' });
}

/**
 * Helper to test env var overrides. Saves/restores env vars and resets modules.
 * @param {Record<string, string | undefined>} overrides
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withEnvOverride(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  vi.resetModules();
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    vi.resetModules();
  }
}
