import { describe, expect, it } from 'vitest';
import { DEFAULT_BOOTSTRAP_MAX_CHARS, resolveBootstrapMaxChars } from './pi-embedded-helpers.js';
import { DEFAULT_AGENTS_FILENAME } from './workspace.js';
// eslint-disable-next-line no-unused-vars
const _makeFile = (overrides) => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: '/tmp/AGENTS.md',
  content: '',
  missing: false,
  ...overrides
});
describe('resolveBootstrapMaxChars', () => {
  it('returns default when unset', () => {
    expect(resolveBootstrapMaxChars()).toBe(DEFAULT_BOOTSTRAP_MAX_CHARS);
  });
  it('uses configured value when valid', () => {
    const cfg = {
      agents: { defaults: { bootstrapMaxChars: 12345 } }
    };
    expect(resolveBootstrapMaxChars(cfg)).toBe(12345);
  });
  it('falls back when invalid', () => {
    const cfg = {
      agents: { defaults: { bootstrapMaxChars: -1 } }
    };
    expect(resolveBootstrapMaxChars(cfg)).toBe(DEFAULT_BOOTSTRAP_MAX_CHARS);
  });
});
