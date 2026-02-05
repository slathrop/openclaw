import { describe, expect, it } from 'vitest';
import { resolveAuthProfileOrder } from './auth-profiles.js';
describe('resolveAuthProfileOrder', () => {
  // eslint-disable-next-line no-unused-vars
  const _store = {
    version: 1,
    profiles: {
      'anthropic:default': {
        type: 'api_key',
        provider: 'anthropic',
        key: 'sk-default'
      },
      'anthropic:work': {
        type: 'api_key',
        provider: 'anthropic',
        key: 'sk-work'
      }
    }
  };
  // eslint-disable-next-line no-unused-vars
  const _cfg = {
    auth: {
      profiles: {
        'anthropic:default': { provider: 'anthropic', mode: 'api_key' },
        'anthropic:work': { provider: 'anthropic', mode: 'api_key' }
      }
    }
  };
  it('orders by lastUsed when no explicit order exists', () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          'anthropic:a': {
            type: 'oauth',
            provider: 'anthropic',
            access: 'access-token',
            refresh: 'refresh-token',
            expires: Date.now() + 6e4
          },
          'anthropic:b': {
            type: 'api_key',
            provider: 'anthropic',
            key: 'sk-b'
          },
          'anthropic:c': {
            type: 'api_key',
            provider: 'anthropic',
            key: 'sk-c'
          }
        },
        usageStats: {
          'anthropic:a': { lastUsed: 200 },
          'anthropic:b': { lastUsed: 100 },
          'anthropic:c': { lastUsed: 300 }
        }
      },
      provider: 'anthropic'
    });
    expect(order).toEqual(['anthropic:a', 'anthropic:b', 'anthropic:c']);
  });
  it('pushes cooldown profiles to the end, ordered by cooldown expiry', () => {
    const now = Date.now();
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          'anthropic:ready': {
            type: 'api_key',
            provider: 'anthropic',
            key: 'sk-ready'
          },
          'anthropic:cool1': {
            type: 'oauth',
            provider: 'anthropic',
            access: 'access-token',
            refresh: 'refresh-token',
            expires: now + 6e4
          },
          'anthropic:cool2': {
            type: 'api_key',
            provider: 'anthropic',
            key: 'sk-cool'
          }
        },
        usageStats: {
          'anthropic:ready': { lastUsed: 50 },
          'anthropic:cool1': { cooldownUntil: now + 5e3 },
          'anthropic:cool2': { cooldownUntil: now + 1e3 }
        }
      },
      provider: 'anthropic'
    });
    expect(order).toEqual(['anthropic:ready', 'anthropic:cool2', 'anthropic:cool1']);
  });
});
