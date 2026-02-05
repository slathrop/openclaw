import { describe, expect, it } from 'vitest';
import { parseDurationMs } from './parse-duration.js';
describe('parseDurationMs', () => {
  it('parses bare ms', () => {
    expect(parseDurationMs('10000')).toBe(1e4);
  });
  it('parses seconds suffix', () => {
    expect(parseDurationMs('10s')).toBe(1e4);
  });
  it('parses minutes suffix', () => {
    expect(parseDurationMs('1m')).toBe(6e4);
  });
  it('parses hours suffix', () => {
    expect(parseDurationMs('2h')).toBe(72e5);
  });
  it('parses days suffix', () => {
    expect(parseDurationMs('2d')).toBe(1728e5);
  });
  it('supports decimals', () => {
    expect(parseDurationMs('0.5s')).toBe(500);
  });
});
