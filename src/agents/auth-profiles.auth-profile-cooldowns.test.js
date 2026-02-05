import { describe, expect, it } from 'vitest';
import { calculateAuthProfileCooldownMs } from './auth-profiles.js';
describe('auth profile cooldowns', () => {
  it('applies exponential backoff with a 1h cap', () => {
    expect(calculateAuthProfileCooldownMs(1)).toBe(6e4);
    expect(calculateAuthProfileCooldownMs(2)).toBe(5 * 6e4);
    expect(calculateAuthProfileCooldownMs(3)).toBe(25 * 6e4);
    expect(calculateAuthProfileCooldownMs(4)).toBe(60 * 6e4);
    expect(calculateAuthProfileCooldownMs(5)).toBe(60 * 6e4);
  });
});
