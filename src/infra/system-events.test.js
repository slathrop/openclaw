import {beforeEach, describe, expect, it} from 'vitest';
import {prependSystemEvents} from '../auto-reply/reply/session-updates.js';
import {resolveMainSessionKey} from '../config/sessions.js';
import {enqueueSystemEvent, peekSystemEvents, resetSystemEventsForTest} from './system-events.js';

const cfg = {};
const mainKey = resolveMainSessionKey(cfg);

describe('system events (session routing)', () => {
  beforeEach(() => {
    resetSystemEventsForTest();
  });

  it('does not leak session-scoped events into main', async () => {
    enqueueSystemEvent('Discord reaction added: \u2705', {
      sessionKey: 'discord:group:123',
      contextKey: 'discord:reaction:added:msg:user:\u2705'
    });

    expect(peekSystemEvents(mainKey)).toEqual([]);
    expect(peekSystemEvents('discord:group:123')).toEqual(['Discord reaction added: \u2705']);

    const main = await prependSystemEvents({
      cfg,
      sessionKey: mainKey,
      isMainSession: true,
      isNewSession: false,
      prefixedBodyBase: 'hello'
    });
    expect(main).toBe('hello');
    expect(peekSystemEvents('discord:group:123')).toEqual(['Discord reaction added: \u2705']);

    const discord = await prependSystemEvents({
      cfg,
      sessionKey: 'discord:group:123',
      isMainSession: false,
      isNewSession: false,
      prefixedBodyBase: 'hi'
    });
    expect(discord).toMatch(/^System: \[[^\]]+\] Discord reaction added: \u2705\n\nhi$/);
    expect(peekSystemEvents('discord:group:123')).toEqual([]);
  });

  it('requires an explicit session key', () => {
    expect(() => enqueueSystemEvent('Node: Mac Studio', {sessionKey: ' '})).toThrow('sessionKey');
  });
});
