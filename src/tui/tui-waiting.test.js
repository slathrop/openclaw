import { describe, expect, it } from 'vitest';
import { buildWaitingStatusMessage, pickWaitingPhrase } from './tui-waiting.js';
const theme = {
  dim: (s) => `<d>${s}</d>`,
  bold: (s) => `<b>${s}</b>`,
  accentSoft: (s) => `<a>${s}</a>`
  // oxlint-disable-next-line typescript/no-explicit-any
};
describe('tui-waiting', () => {
  it('pickWaitingPhrase rotates every 10 ticks', () => {
    const phrases = ['a', 'b', 'c'];
    expect(pickWaitingPhrase(0, phrases)).toBe('a');
    expect(pickWaitingPhrase(9, phrases)).toBe('a');
    expect(pickWaitingPhrase(10, phrases)).toBe('b');
    expect(pickWaitingPhrase(20, phrases)).toBe('c');
    expect(pickWaitingPhrase(30, phrases)).toBe('a');
  });
  it('buildWaitingStatusMessage includes shimmer markup and metadata', () => {
    const msg = buildWaitingStatusMessage({
      theme,
      tick: 1,
      elapsed: '3s',
      connectionStatus: 'connected',
      phrases: ['hello']
    });
    expect(msg).toContain('connected');
    expect(msg).toContain('3s');
    expect(msg).toContain('h');
    expect(msg).toContain('e');
    expect(msg).toContain('l');
    expect(msg).toContain('o');
    expect(msg).toContain('<b><a>');
    expect(msg).toContain('<d>');
  });
});
