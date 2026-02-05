import { describe, expect, it } from 'vitest';
import { normalizeTextForComparison } from './pi-embedded-helpers.js';
import { DEFAULT_AGENTS_FILENAME } from './workspace.js';
// eslint-disable-next-line no-unused-vars
const _makeFile = (overrides) => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: '/tmp/AGENTS.md',
  content: '',
  missing: false,
  ...overrides
});
describe('normalizeTextForComparison', () => {
  it('lowercases text', () => {
    expect(normalizeTextForComparison('Hello World')).toBe('hello world');
  });
  it('trims whitespace', () => {
    expect(normalizeTextForComparison('  hello  ')).toBe('hello');
  });
  it('collapses multiple spaces', () => {
    expect(normalizeTextForComparison('hello    world')).toBe('hello world');
  });
  it('strips emoji', () => {
    expect(normalizeTextForComparison('Hello \u{1F44B} World \u{1F30D}')).toBe('hello world');
  });
  it('handles mixed normalization', () => {
    expect(normalizeTextForComparison('  Hello \u{1F44B}   WORLD  \u{1F30D}  ')).toBe('hello world');
  });
});
