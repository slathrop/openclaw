import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatToolAggregate, formatToolPrefix, shortenMeta, shortenPath } from './tool-meta.js';
describe('tool meta formatting', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  it('shortens paths under HOME', () => {
    vi.stubEnv('HOME', '/Users/test');
    expect(shortenPath('/Users/test')).toBe('~');
    expect(shortenPath('/Users/test/a/b.txt')).toBe('~/a/b.txt');
    expect(shortenPath('/opt/x')).toBe('/opt/x');
  });
  it('shortens meta strings with optional colon suffix', () => {
    vi.stubEnv('HOME', '/Users/test');
    expect(shortenMeta('/Users/test/a.txt')).toBe('~/a.txt');
    expect(shortenMeta('/Users/test/a.txt:12')).toBe('~/a.txt:12');
    expect(shortenMeta('cd /Users/test/dir && ls')).toBe('cd ~/dir && ls');
    expect(shortenMeta('')).toBe('');
  });
  it('formats aggregates with grouping and brace-collapse', () => {
    vi.stubEnv('HOME', '/Users/test');
    const out = formatToolAggregate('  fs  ', [
      '/Users/test/dir/a.txt',
      '/Users/test/dir/b.txt',
      'note',
      'a\u2192b'
    ]);
    expect(out).toMatch(/^🧩 Fs/);
    expect(out).toContain('~/dir/{a.txt, b.txt}');
    expect(out).toContain('note');
    expect(out).toContain('a\u2192b');
  });
  it('wraps aggregate meta in backticks when markdown is enabled', () => {
    vi.stubEnv('HOME', '/Users/test');
    const out = formatToolAggregate('fs', ['/Users/test/dir/a.txt'], { markdown: true });
    expect(out).toContain('`~/dir/a.txt`');
  });
  it('keeps exec flags outside markdown and moves them to the front', () => {
    vi.stubEnv('HOME', '/Users/test');
    const out = formatToolAggregate('exec', ['cd /Users/test/dir && gemini 2>&1 \xB7 elevated'], {
      markdown: true
    });
    expect(out).toBe('\u{1F6E0}\uFE0F Exec: elevated \xB7 `cd ~/dir && gemini 2>&1`');
  });
  it('formats prefixes with default labels', () => {
    vi.stubEnv('HOME', '/Users/test');
    expect(formatToolPrefix(void 0, void 0)).toBe('\u{1F9E9} Tool');
    expect(formatToolPrefix('x', '/Users/test/a.txt')).toBe('\u{1F9E9} X: ~/a.txt');
  });
});
