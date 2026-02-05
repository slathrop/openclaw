import { describe, expect, it } from 'vitest';
import {
  allocateCdpPort,
  allocateColor,
  CDP_PORT_RANGE_END,
  CDP_PORT_RANGE_START,
  getUsedColors,
  getUsedPorts,
  isValidProfileName,
  PROFILE_COLORS
} from './profiles.js';
describe('profile name validation', () => {
  it('accepts valid lowercase names', () => {
    expect(isValidProfileName('openclaw')).toBe(true);
    expect(isValidProfileName('work')).toBe(true);
    expect(isValidProfileName('my-profile')).toBe(true);
    expect(isValidProfileName('test123')).toBe(true);
    expect(isValidProfileName('a')).toBe(true);
    expect(isValidProfileName('a-b-c-1-2-3')).toBe(true);
    expect(isValidProfileName('1test')).toBe(true);
  });
  it('rejects empty or missing names', () => {
    expect(isValidProfileName('')).toBe(false);
    expect(isValidProfileName(null)).toBe(false);
    expect(isValidProfileName(void 0)).toBe(false);
  });
  it('rejects names that are too long', () => {
    const longName = 'a'.repeat(65);
    expect(isValidProfileName(longName)).toBe(false);
    const maxName = 'a'.repeat(64);
    expect(isValidProfileName(maxName)).toBe(true);
  });
  it('rejects uppercase letters', () => {
    expect(isValidProfileName('MyProfile')).toBe(false);
    expect(isValidProfileName('PROFILE')).toBe(false);
    expect(isValidProfileName('Work')).toBe(false);
  });
  it('rejects spaces and special characters', () => {
    expect(isValidProfileName('my profile')).toBe(false);
    expect(isValidProfileName('my_profile')).toBe(false);
    expect(isValidProfileName('my.profile')).toBe(false);
    expect(isValidProfileName('my/profile')).toBe(false);
    expect(isValidProfileName('my@profile')).toBe(false);
  });
  it('rejects names starting with hyphen', () => {
    expect(isValidProfileName('-invalid')).toBe(false);
    expect(isValidProfileName('--double')).toBe(false);
  });
});
describe('port allocation', () => {
  it('allocates first port when none used', () => {
    const usedPorts = /* @__PURE__ */ new Set();
    expect(allocateCdpPort(usedPorts)).toBe(CDP_PORT_RANGE_START);
  });
  it('allocates within an explicit range', () => {
    const usedPorts = /* @__PURE__ */ new Set();
    expect(allocateCdpPort(usedPorts, { start: 2e4, end: 20002 })).toBe(2e4);
    usedPorts.add(2e4);
    expect(allocateCdpPort(usedPorts, { start: 2e4, end: 20002 })).toBe(20001);
  });
  it('skips used ports and returns next available', () => {
    const usedPorts = /* @__PURE__ */ new Set([CDP_PORT_RANGE_START, CDP_PORT_RANGE_START + 1]);
    expect(allocateCdpPort(usedPorts)).toBe(CDP_PORT_RANGE_START + 2);
  });
  it('finds first gap in used ports', () => {
    const usedPorts = /* @__PURE__ */ new Set([
      CDP_PORT_RANGE_START,
      CDP_PORT_RANGE_START + 2
      // gap at +1
    ]);
    expect(allocateCdpPort(usedPorts)).toBe(CDP_PORT_RANGE_START + 1);
  });
  it('returns null when all ports are exhausted', () => {
    const usedPorts = /* @__PURE__ */ new Set();
    for (let port = CDP_PORT_RANGE_START; port <= CDP_PORT_RANGE_END; port++) {
      usedPorts.add(port);
    }
    expect(allocateCdpPort(usedPorts)).toBeNull();
  });
  it('handles ports outside range in used set', () => {
    const usedPorts = /* @__PURE__ */ new Set([1, 2, 3, 5e4]);
    expect(allocateCdpPort(usedPorts)).toBe(CDP_PORT_RANGE_START);
  });
});
describe('getUsedPorts', () => {
  it('returns empty set for undefined profiles', () => {
    expect(getUsedPorts(void 0)).toEqual(/* @__PURE__ */ new Set());
  });
  it('returns empty set for empty profiles object', () => {
    expect(getUsedPorts({})).toEqual(/* @__PURE__ */ new Set());
  });
  it('extracts ports from profile configs', () => {
    const profiles = {
      openclaw: { cdpPort: 18792 },
      work: { cdpPort: 18793 },
      personal: { cdpPort: 18795 }
    };
    const used = getUsedPorts(profiles);
    expect(used).toEqual(/* @__PURE__ */ new Set([18792, 18793, 18795]));
  });
  it('extracts ports from cdpUrl when cdpPort is missing', () => {
    const profiles = {
      remote: { cdpUrl: 'http://10.0.0.42:9222' },
      secure: { cdpUrl: 'https://example.com:9443' }
    };
    const used = getUsedPorts(profiles);
    expect(used).toEqual(/* @__PURE__ */ new Set([9222, 9443]));
  });
  it('ignores invalid cdpUrl values', () => {
    const profiles = {
      bad: { cdpUrl: 'notaurl' }
    };
    const used = getUsedPorts(profiles);
    expect(used.size).toBe(0);
  });
});
describe('port collision prevention', () => {
  it('raw config vs resolved config - shows the data source difference', async () => {
    const { resolveBrowserConfig } = await import('./config.js');
    const rawConfigProfiles = void 0;
    const usedFromRaw = getUsedPorts(rawConfigProfiles);
    expect(usedFromRaw.size).toBe(0);
    const resolved = resolveBrowserConfig({});
    const usedFromResolved = getUsedPorts(resolved.profiles);
    expect(usedFromResolved.has(CDP_PORT_RANGE_START)).toBe(true);
  });
  it('create-profile must use resolved config to avoid port collision', async () => {
    const { resolveBrowserConfig } = await import('./config.js');
    const rawConfig = { browser: {} };
    const buggyUsedPorts = getUsedPorts(rawConfig.browser?.profiles);
    const buggyAllocatedPort = allocateCdpPort(buggyUsedPorts);
    expect(buggyAllocatedPort).toBe(CDP_PORT_RANGE_START);
    const resolved = resolveBrowserConfig(rawConfig.browser);
    const fixedUsedPorts = getUsedPorts(resolved.profiles);
    const fixedAllocatedPort = allocateCdpPort(fixedUsedPorts);
    expect(fixedAllocatedPort).toBe(CDP_PORT_RANGE_START + 1);
  });
});
describe('color allocation', () => {
  it('allocates first color when none used', () => {
    const usedColors = /* @__PURE__ */ new Set();
    expect(allocateColor(usedColors)).toBe(PROFILE_COLORS[0]);
  });
  it('allocates next unused color from palette', () => {
    const usedColors = /* @__PURE__ */ new Set([PROFILE_COLORS[0].toUpperCase()]);
    expect(allocateColor(usedColors)).toBe(PROFILE_COLORS[1]);
  });
  it('skips multiple used colors', () => {
    const usedColors = /* @__PURE__ */ new Set([
      PROFILE_COLORS[0].toUpperCase(),
      PROFILE_COLORS[1].toUpperCase(),
      PROFILE_COLORS[2].toUpperCase()
    ]);
    expect(allocateColor(usedColors)).toBe(PROFILE_COLORS[3]);
  });
  it('handles case-insensitive color matching', () => {
    const usedColors = /* @__PURE__ */ new Set(['#ff4500']);
    expect(allocateColor(usedColors)).toBe(PROFILE_COLORS[0]);
  });
  it('cycles when all colors are used', () => {
    const usedColors = new Set(PROFILE_COLORS.map((c) => c.toUpperCase()));
    const result = allocateColor(usedColors);
    expect(PROFILE_COLORS).toContain(result);
  });
  it('cycles based on count when palette exhausted', () => {
    const usedColors = /* @__PURE__ */ new Set([
      ...PROFILE_COLORS.map((c) => c.toUpperCase()),
      '#AAAAAA',
      '#BBBBBB'
    ]);
    const result = allocateColor(usedColors);
    expect(result).toBe(PROFILE_COLORS[2]);
  });
});
describe('getUsedColors', () => {
  it('returns empty set for undefined profiles', () => {
    expect(getUsedColors(void 0)).toEqual(/* @__PURE__ */ new Set());
  });
  it('returns empty set for empty profiles object', () => {
    expect(getUsedColors({})).toEqual(/* @__PURE__ */ new Set());
  });
  it('extracts and uppercases colors from profile configs', () => {
    const profiles = {
      openclaw: { color: '#ff4500' },
      work: { color: '#0066CC' }
    };
    const used = getUsedColors(profiles);
    expect(used).toEqual(/* @__PURE__ */ new Set(['#FF4500', '#0066CC']));
  });
});
