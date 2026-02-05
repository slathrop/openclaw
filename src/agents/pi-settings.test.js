import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR,
  ensurePiCompactionReserveTokens,
  resolveCompactionReserveTokensFloor
} from './pi-settings.js';
describe('ensurePiCompactionReserveTokens', () => {
  it('bumps reserveTokens when below floor', () => {
    const settingsManager = {
      getCompactionReserveTokens: () => 16384,
      applyOverrides: vi.fn()
    };
    const result = ensurePiCompactionReserveTokens({ settingsManager });
    expect(result).toEqual({
      didOverride: true,
      reserveTokens: DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR
    });
    expect(settingsManager.applyOverrides).toHaveBeenCalledWith({
      compaction: { reserveTokens: DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR }
    });
  });
  it('does not override when already above floor', () => {
    const settingsManager = {
      getCompactionReserveTokens: () => 32e3,
      applyOverrides: vi.fn()
    };
    const result = ensurePiCompactionReserveTokens({ settingsManager });
    expect(result).toEqual({ didOverride: false, reserveTokens: 32e3 });
    expect(settingsManager.applyOverrides).not.toHaveBeenCalled();
  });
});
describe('resolveCompactionReserveTokensFloor', () => {
  it('returns the default when config is missing', () => {
    expect(resolveCompactionReserveTokensFloor()).toBe(DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR);
  });
  it('accepts configured floors, including zero', () => {
    expect(
      resolveCompactionReserveTokensFloor({
        agents: { defaults: { compaction: { reserveTokensFloor: 24e3 } } }
      })
    ).toBe(24e3);
    expect(
      resolveCompactionReserveTokensFloor({
        agents: { defaults: { compaction: { reserveTokensFloor: 0 } } }
      })
    ).toBe(0);
  });
});
