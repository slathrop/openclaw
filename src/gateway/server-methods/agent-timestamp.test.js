import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatZonedTimestamp } from '../../auto-reply/envelope.js';
import { injectTimestamp, timestampOptsFromConfig } from './agent-timestamp.js';
describe('injectTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(/* @__PURE__ */ new Date('2026-01-29T01:30:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('prepends a compact timestamp matching formatZonedTimestamp', () => {
    const result = injectTimestamp('Is it the weekend?', {
      timezone: 'America/New_York'
    });
    expect(result).toMatch(/^\[Wed 2026-01-28 20:30 EST\] Is it the weekend\?$/);
  });
  it('uses channel envelope format with DOW prefix', () => {
    const now = /* @__PURE__ */ new Date();
    const expected = formatZonedTimestamp(now, 'America/New_York');
    const result = injectTimestamp('hello', { timezone: 'America/New_York' });
    expect(result).toBe(`[Wed ${expected}] hello`);
  });
  it('always uses 24-hour format', () => {
    const result = injectTimestamp('hello', { timezone: 'America/New_York' });
    expect(result).toContain('20:30');
    expect(result).not.toContain('PM');
    expect(result).not.toContain('AM');
  });
  it('uses the configured timezone', () => {
    const result = injectTimestamp('hello', { timezone: 'America/Chicago' });
    expect(result).toMatch(/^\[Wed 2026-01-28 19:30 CST\]/);
  });
  it('defaults to UTC when no timezone specified', () => {
    const result = injectTimestamp('hello', {});
    expect(result).toMatch(/^\[Thu 2026-01-29 01:30/);
  });
  it('returns empty/whitespace messages unchanged', () => {
    expect(injectTimestamp('', { timezone: 'UTC' })).toBe('');
    expect(injectTimestamp('   ', { timezone: 'UTC' })).toBe('   ');
  });
  it('does NOT double-stamp messages with channel envelope timestamps', () => {
    const enveloped = '[Discord user1 2026-01-28 20:30 EST] hello there';
    const result = injectTimestamp(enveloped, { timezone: 'America/New_York' });
    expect(result).toBe(enveloped);
  });
  it('does NOT double-stamp messages already injected by us', () => {
    const alreadyStamped = '[Wed 2026-01-28 20:30 EST] hello there';
    const result = injectTimestamp(alreadyStamped, { timezone: 'America/New_York' });
    expect(result).toBe(alreadyStamped);
  });
  it('does NOT double-stamp messages with cron-injected timestamps', () => {
    const cronMessage = '[cron:abc123 my-job] do the thing\nCurrent time: Wednesday, January 28th, 2026 \u2014 8:30 PM (America/New_York)';
    const result = injectTimestamp(cronMessage, { timezone: 'America/New_York' });
    expect(result).toBe(cronMessage);
  });
  it('handles midnight correctly', () => {
    vi.setSystemTime(/* @__PURE__ */ new Date('2026-02-01T05:00:00.000Z'));
    const result = injectTimestamp('hello', { timezone: 'America/New_York' });
    expect(result).toMatch(/^\[Sun 2026-02-01 00:00 EST\]/);
  });
  it('handles date boundaries (just before midnight)', () => {
    vi.setSystemTime(/* @__PURE__ */ new Date('2026-02-01T04:59:00.000Z'));
    const result = injectTimestamp('hello', { timezone: 'America/New_York' });
    expect(result).toMatch(/^\[Sat 2026-01-31 23:59 EST\]/);
  });
  it('handles DST correctly (same UTC hour, different local time)', () => {
    vi.setSystemTime(/* @__PURE__ */ new Date('2026-01-15T05:00:00.000Z'));
    const winter = injectTimestamp('winter', { timezone: 'America/New_York' });
    expect(winter).toMatch(/^\[Thu 2026-01-15 00:00 EST\]/);
    vi.setSystemTime(/* @__PURE__ */ new Date('2026-07-15T04:00:00.000Z'));
    const summer = injectTimestamp('summer', { timezone: 'America/New_York' });
    expect(summer).toMatch(/^\[Wed 2026-07-15 00:00 EDT\]/);
  });
  it('accepts a custom now date', () => {
    const customDate = /* @__PURE__ */ new Date('2025-07-04T16:00:00.000Z');
    const result = injectTimestamp('fireworks?', {
      timezone: 'America/New_York',
      now: customDate
    });
    expect(result).toMatch(/^\[Fri 2025-07-04 12:00 EDT\]/);
  });
});
describe('timestampOptsFromConfig', () => {
  it('extracts timezone from config', () => {
    const opts = timestampOptsFromConfig({
      agents: {
        defaults: {
          userTimezone: 'America/Chicago'
        }
      }
      // oxlint-disable-next-line typescript/no-explicit-any
    });
    expect(opts.timezone).toBe('America/Chicago');
  });
  it('falls back gracefully with empty config', () => {
    const opts = timestampOptsFromConfig({});
    expect(opts.timezone).toBeDefined();
  });
});
