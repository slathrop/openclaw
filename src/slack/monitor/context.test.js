import { describe, expect, it } from 'vitest';
import { createSlackMonitorContext, normalizeSlackChannelType } from './context.js';
const baseParams = () => ({
  cfg: {},
  accountId: 'default',
  botToken: 'token',
  app: { client: {} },
  runtime: {},
  botUserId: 'B1',
  teamId: 'T1',
  apiAppId: 'A1',
  historyLimit: 0,
  sessionScope: 'per-sender',
  mainKey: 'main',
  dmEnabled: true,
  dmPolicy: 'open',
  allowFrom: [],
  groupDmEnabled: true,
  groupDmChannels: [],
  defaultRequireMention: true,
  groupPolicy: 'open',
  useAccessGroups: false,
  reactionMode: 'off',
  reactionAllowlist: [],
  replyToMode: 'off',
  slashCommand: {
    enabled: false,
    name: 'openclaw',
    sessionPrefix: 'slack:slash',
    ephemeral: true
  },
  textLimit: 4e3,
  ackReactionScope: 'group-mentions',
  mediaMaxBytes: 1,
  removeAckAfterReply: false
});
describe('normalizeSlackChannelType', () => {
  it('infers channel types from ids when missing', () => {
    expect(normalizeSlackChannelType(void 0, 'C123')).toBe('channel');
    expect(normalizeSlackChannelType(void 0, 'D123')).toBe('im');
    expect(normalizeSlackChannelType(void 0, 'G123')).toBe('group');
  });
  it('prefers explicit channel_type values', () => {
    expect(normalizeSlackChannelType('mpim', 'C123')).toBe('mpim');
  });
});
describe('resolveSlackSystemEventSessionKey', () => {
  it('defaults missing channel_type to channel sessions', () => {
    const ctx = createSlackMonitorContext(baseParams());
    expect(ctx.resolveSlackSystemEventSessionKey({ channelId: 'C123' })).toBe(
      'agent:main:slack:channel:c123'
    );
  });
});
describe('isChannelAllowed with groupPolicy and channelsConfig', () => {
  it('allows unlisted channels when groupPolicy is open even with channelsConfig entries', () => {
    const ctx = createSlackMonitorContext({
      ...baseParams(),
      groupPolicy: 'open',
      channelsConfig: {
        C_LISTED: { requireMention: true }
      }
    });
    expect(ctx.isChannelAllowed({ channelId: 'C_LISTED', channelType: 'channel' })).toBe(true);
    expect(ctx.isChannelAllowed({ channelId: 'C_UNLISTED', channelType: 'channel' })).toBe(true);
  });
  it('blocks unlisted channels when groupPolicy is allowlist', () => {
    const ctx = createSlackMonitorContext({
      ...baseParams(),
      groupPolicy: 'allowlist',
      channelsConfig: {
        C_LISTED: { requireMention: true }
      }
    });
    expect(ctx.isChannelAllowed({ channelId: 'C_LISTED', channelType: 'channel' })).toBe(true);
    expect(ctx.isChannelAllowed({ channelId: 'C_UNLISTED', channelType: 'channel' })).toBe(false);
  });
  it('blocks explicitly denied channels even when groupPolicy is open', () => {
    const ctx = createSlackMonitorContext({
      ...baseParams(),
      groupPolicy: 'open',
      channelsConfig: {
        C_ALLOWED: { allow: true },
        C_DENIED: { allow: false }
      }
    });
    expect(ctx.isChannelAllowed({ channelId: 'C_ALLOWED', channelType: 'channel' })).toBe(true);
    expect(ctx.isChannelAllowed({ channelId: 'C_DENIED', channelType: 'channel' })).toBe(false);
    expect(ctx.isChannelAllowed({ channelId: 'C_UNLISTED', channelType: 'channel' })).toBe(true);
  });
  it('allows all channels when groupPolicy is open and channelsConfig is empty', () => {
    const ctx = createSlackMonitorContext({
      ...baseParams(),
      groupPolicy: 'open',
      channelsConfig: void 0
    });
    expect(ctx.isChannelAllowed({ channelId: 'C_ANY', channelType: 'channel' })).toBe(true);
  });
});
