import { describe, expect, it } from 'vitest';
import { resolveDiscordOwnerAllowFrom } from './allow-list.js';

describe('resolveDiscordOwnerAllowFrom', () => {
  it('returns undefined when no allowlist is configured', () => {
    const result = resolveDiscordOwnerAllowFrom({
      channelConfig: { allowed: true },
      sender: { id: '123' }
    });

    expect(result).toBeUndefined();
  });

  it('skips wildcard matches for owner allowFrom', () => {
    const result = resolveDiscordOwnerAllowFrom({
      channelConfig: { allowed: true, users: ['*'] },
      sender: { id: '123' }
    });

    expect(result).toBeUndefined();
  });

  it('returns a matching user id entry', () => {
    const result = resolveDiscordOwnerAllowFrom({
      channelConfig: { allowed: true, users: ['123'] },
      sender: { id: '123' }
    });

    expect(result).toEqual(['123']);
  });

  it('returns the normalized name slug for name matches', () => {
    const result = resolveDiscordOwnerAllowFrom({
      channelConfig: { allowed: true, users: ['Some User'] },
      sender: { id: '999', name: 'Some User' }
    });

    expect(result).toEqual(['some-user']);
  });
});
