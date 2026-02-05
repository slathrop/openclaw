import { describe, expect, it, vi } from 'vitest';
import { handleDiscordGuildAction } from './discord-actions-guild.js';
import { handleDiscordMessagingAction } from './discord-actions-messaging.js';
import { handleDiscordModerationAction } from './discord-actions-moderation.js';
const createChannelDiscord = vi.fn(async () => ({
  id: 'new-channel',
  name: 'test',
  type: 0
}));
const createThreadDiscord = vi.fn(async () => ({}));
const deleteChannelDiscord = vi.fn(async () => ({ ok: true, channelId: 'C1' }));
const deleteMessageDiscord = vi.fn(async () => ({}));
const editChannelDiscord = vi.fn(async () => ({
  id: 'C1',
  name: 'edited'
}));
const editMessageDiscord = vi.fn(async () => ({}));
const fetchMessageDiscord = vi.fn(async () => ({}));
const fetchChannelPermissionsDiscord = vi.fn(async () => ({}));
const fetchReactionsDiscord = vi.fn(async () => ({}));
const listGuildChannelsDiscord = vi.fn(async () => []);
const listPinsDiscord = vi.fn(async () => ({}));
const listThreadsDiscord = vi.fn(async () => ({}));
const moveChannelDiscord = vi.fn(async () => ({ ok: true }));
const pinMessageDiscord = vi.fn(async () => ({}));
const reactMessageDiscord = vi.fn(async () => ({}));
const readMessagesDiscord = vi.fn(async () => []);
const removeChannelPermissionDiscord = vi.fn(async () => ({ ok: true }));
const removeOwnReactionsDiscord = vi.fn(async () => ({ removed: ['\u{1F44D}'] }));
const removeReactionDiscord = vi.fn(async () => ({}));
const searchMessagesDiscord = vi.fn(async () => ({}));
const sendMessageDiscord = vi.fn(async () => ({}));
const sendPollDiscord = vi.fn(async () => ({}));
const sendStickerDiscord = vi.fn(async () => ({}));
const setChannelPermissionDiscord = vi.fn(async () => ({ ok: true }));
const unpinMessageDiscord = vi.fn(async () => ({}));
const timeoutMemberDiscord = vi.fn(async () => ({}));
const kickMemberDiscord = vi.fn(async () => ({}));
const banMemberDiscord = vi.fn(async () => ({}));
vi.mock('../../discord/send.js', () => ({
  banMemberDiscord: (...args) => banMemberDiscord(...args),
  createChannelDiscord: (...args) => createChannelDiscord(...args),
  createThreadDiscord: (...args) => createThreadDiscord(...args),
  deleteChannelDiscord: (...args) => deleteChannelDiscord(...args),
  deleteMessageDiscord: (...args) => deleteMessageDiscord(...args),
  editChannelDiscord: (...args) => editChannelDiscord(...args),
  editMessageDiscord: (...args) => editMessageDiscord(...args),
  fetchMessageDiscord: (...args) => fetchMessageDiscord(...args),
  fetchChannelPermissionsDiscord: (...args) => fetchChannelPermissionsDiscord(...args),
  fetchReactionsDiscord: (...args) => fetchReactionsDiscord(...args),
  kickMemberDiscord: (...args) => kickMemberDiscord(...args),
  listGuildChannelsDiscord: (...args) => listGuildChannelsDiscord(...args),
  listPinsDiscord: (...args) => listPinsDiscord(...args),
  listThreadsDiscord: (...args) => listThreadsDiscord(...args),
  moveChannelDiscord: (...args) => moveChannelDiscord(...args),
  pinMessageDiscord: (...args) => pinMessageDiscord(...args),
  reactMessageDiscord: (...args) => reactMessageDiscord(...args),
  readMessagesDiscord: (...args) => readMessagesDiscord(...args),
  removeChannelPermissionDiscord: (...args) => removeChannelPermissionDiscord(...args),
  removeOwnReactionsDiscord: (...args) => removeOwnReactionsDiscord(...args),
  removeReactionDiscord: (...args) => removeReactionDiscord(...args),
  searchMessagesDiscord: (...args) => searchMessagesDiscord(...args),
  sendMessageDiscord: (...args) => sendMessageDiscord(...args),
  sendPollDiscord: (...args) => sendPollDiscord(...args),
  sendStickerDiscord: (...args) => sendStickerDiscord(...args),
  setChannelPermissionDiscord: (...args) => setChannelPermissionDiscord(...args),
  timeoutMemberDiscord: (...args) => timeoutMemberDiscord(...args),
  unpinMessageDiscord: (...args) => unpinMessageDiscord(...args)
}));
const enableAllActions = () => true;
const disabledActions = (key) => key !== 'reactions';
const channelInfoEnabled = (key) => key === 'channelInfo';
const moderationEnabled = (key) => key === 'moderation';
describe('handleDiscordMessagingAction', () => {
  it('adds reactions', async () => {
    await handleDiscordMessagingAction(
      'react',
      {
        channelId: 'C1',
        messageId: 'M1',
        emoji: '\u2705'
      },
      enableAllActions
    );
    expect(reactMessageDiscord).toHaveBeenCalledWith('C1', 'M1', '\u2705');
  });
  it('forwards accountId for reactions', async () => {
    await handleDiscordMessagingAction(
      'react',
      {
        channelId: 'C1',
        messageId: 'M1',
        emoji: '\u2705',
        accountId: 'ops'
      },
      enableAllActions
    );
    expect(reactMessageDiscord).toHaveBeenCalledWith('C1', 'M1', '\u2705', { accountId: 'ops' });
  });
  it('removes reactions on empty emoji', async () => {
    await handleDiscordMessagingAction(
      'react',
      {
        channelId: 'C1',
        messageId: 'M1',
        emoji: ''
      },
      enableAllActions
    );
    expect(removeOwnReactionsDiscord).toHaveBeenCalledWith('C1', 'M1');
  });
  it('removes reactions when remove flag set', async () => {
    await handleDiscordMessagingAction(
      'react',
      {
        channelId: 'C1',
        messageId: 'M1',
        emoji: '\u2705',
        remove: true
      },
      enableAllActions
    );
    expect(removeReactionDiscord).toHaveBeenCalledWith('C1', 'M1', '\u2705');
  });
  it('rejects removes without emoji', async () => {
    await expect(
      handleDiscordMessagingAction(
        'react',
        {
          channelId: 'C1',
          messageId: 'M1',
          emoji: '',
          remove: true
        },
        enableAllActions
      )
    ).rejects.toThrow(/Emoji is required/);
  });
  it('respects reaction gating', async () => {
    await expect(
      handleDiscordMessagingAction(
        'react',
        {
          channelId: 'C1',
          messageId: 'M1',
          emoji: '\u2705'
        },
        disabledActions
      )
    ).rejects.toThrow(/Discord reactions are disabled/);
  });
  it('adds normalized timestamps to readMessages payloads', async () => {
    readMessagesDiscord.mockResolvedValueOnce([{ id: '1', timestamp: '2026-01-15T10:00:00.000Z' }]);
    const result = await handleDiscordMessagingAction(
      'readMessages',
      { channelId: 'C1' },
      enableAllActions
    );
    const payload = result.details;
    const expectedMs = Date.parse('2026-01-15T10:00:00.000Z');
    expect(payload.messages[0].timestampMs).toBe(expectedMs);
    expect(payload.messages[0].timestampUtc).toBe(new Date(expectedMs).toISOString());
  });
  it('adds normalized timestamps to fetchMessage payloads', async () => {
    fetchMessageDiscord.mockResolvedValueOnce({
      id: '1',
      timestamp: '2026-01-15T11:00:00.000Z'
    });
    const result = await handleDiscordMessagingAction(
      'fetchMessage',
      { guildId: 'G1', channelId: 'C1', messageId: 'M1' },
      enableAllActions
    );
    const payload = result.details;
    const expectedMs = Date.parse('2026-01-15T11:00:00.000Z');
    expect(payload.message?.timestampMs).toBe(expectedMs);
    expect(payload.message?.timestampUtc).toBe(new Date(expectedMs).toISOString());
  });
  it('adds normalized timestamps to listPins payloads', async () => {
    listPinsDiscord.mockResolvedValueOnce([{ id: '1', timestamp: '2026-01-15T12:00:00.000Z' }]);
    const result = await handleDiscordMessagingAction(
      'listPins',
      { channelId: 'C1' },
      enableAllActions
    );
    const payload = result.details;
    const expectedMs = Date.parse('2026-01-15T12:00:00.000Z');
    expect(payload.pins[0].timestampMs).toBe(expectedMs);
    expect(payload.pins[0].timestampUtc).toBe(new Date(expectedMs).toISOString());
  });
  it('adds normalized timestamps to searchMessages payloads', async () => {
    searchMessagesDiscord.mockResolvedValueOnce({
      total_results: 1,
      messages: [[{ id: '1', timestamp: '2026-01-15T13:00:00.000Z' }]]
    });
    const result = await handleDiscordMessagingAction(
      'searchMessages',
      { guildId: 'G1', content: 'hi' },
      enableAllActions
    );
    const payload = result.details;
    const expectedMs = Date.parse('2026-01-15T13:00:00.000Z');
    expect(payload.results?.messages?.[0]?.[0]?.timestampMs).toBe(expectedMs);
    expect(payload.results?.messages?.[0]?.[0]?.timestampUtc).toBe(
      new Date(expectedMs).toISOString()
    );
  });
});
const channelsEnabled = (key) => key === 'channels';
const channelsDisabled = () => false;
describe('handleDiscordGuildAction - channel management', () => {
  it('creates a channel', async () => {
    const result = await handleDiscordGuildAction(
      'channelCreate',
      {
        guildId: 'G1',
        name: 'test-channel',
        type: 0,
        topic: 'Test topic'
      },
      channelsEnabled
    );
    expect(createChannelDiscord).toHaveBeenCalledWith({
      guildId: 'G1',
      name: 'test-channel',
      type: 0,
      parentId: void 0,
      topic: 'Test topic',
      position: void 0,
      nsfw: void 0
    });
    expect(result.details).toMatchObject({ ok: true });
  });
  it('respects channel gating for channelCreate', async () => {
    await expect(
      handleDiscordGuildAction('channelCreate', { guildId: 'G1', name: 'test' }, channelsDisabled)
    ).rejects.toThrow(/Discord channel management is disabled/);
  });
  it('forwards accountId for channelList', async () => {
    await handleDiscordGuildAction(
      'channelList',
      { guildId: 'G1', accountId: 'ops' },
      channelInfoEnabled
    );
    expect(listGuildChannelsDiscord).toHaveBeenCalledWith('G1', { accountId: 'ops' });
  });
  it('edits a channel', async () => {
    await handleDiscordGuildAction(
      'channelEdit',
      {
        channelId: 'C1',
        name: 'new-name',
        topic: 'new topic'
      },
      channelsEnabled
    );
    expect(editChannelDiscord).toHaveBeenCalledWith({
      channelId: 'C1',
      name: 'new-name',
      topic: 'new topic',
      position: void 0,
      parentId: void 0,
      nsfw: void 0,
      rateLimitPerUser: void 0
    });
  });
  it('clears the channel parent when parentId is null', async () => {
    await handleDiscordGuildAction(
      'channelEdit',
      {
        channelId: 'C1',
        parentId: null
      },
      channelsEnabled
    );
    expect(editChannelDiscord).toHaveBeenCalledWith({
      channelId: 'C1',
      name: void 0,
      topic: void 0,
      position: void 0,
      parentId: null,
      nsfw: void 0,
      rateLimitPerUser: void 0
    });
  });
  it('clears the channel parent when clearParent is true', async () => {
    await handleDiscordGuildAction(
      'channelEdit',
      {
        channelId: 'C1',
        clearParent: true
      },
      channelsEnabled
    );
    expect(editChannelDiscord).toHaveBeenCalledWith({
      channelId: 'C1',
      name: void 0,
      topic: void 0,
      position: void 0,
      parentId: null,
      nsfw: void 0,
      rateLimitPerUser: void 0
    });
  });
  it('deletes a channel', async () => {
    await handleDiscordGuildAction('channelDelete', { channelId: 'C1' }, channelsEnabled);
    expect(deleteChannelDiscord).toHaveBeenCalledWith('C1');
  });
  it('moves a channel', async () => {
    await handleDiscordGuildAction(
      'channelMove',
      {
        guildId: 'G1',
        channelId: 'C1',
        parentId: 'P1',
        position: 5
      },
      channelsEnabled
    );
    expect(moveChannelDiscord).toHaveBeenCalledWith({
      guildId: 'G1',
      channelId: 'C1',
      parentId: 'P1',
      position: 5
    });
  });
  it('clears the channel parent on move when parentId is null', async () => {
    await handleDiscordGuildAction(
      'channelMove',
      {
        guildId: 'G1',
        channelId: 'C1',
        parentId: null
      },
      channelsEnabled
    );
    expect(moveChannelDiscord).toHaveBeenCalledWith({
      guildId: 'G1',
      channelId: 'C1',
      parentId: null,
      position: void 0
    });
  });
  it('clears the channel parent on move when clearParent is true', async () => {
    await handleDiscordGuildAction(
      'channelMove',
      {
        guildId: 'G1',
        channelId: 'C1',
        clearParent: true
      },
      channelsEnabled
    );
    expect(moveChannelDiscord).toHaveBeenCalledWith({
      guildId: 'G1',
      channelId: 'C1',
      parentId: null,
      position: void 0
    });
  });
  it('creates a category with type=4', async () => {
    await handleDiscordGuildAction(
      'categoryCreate',
      { guildId: 'G1', name: 'My Category' },
      channelsEnabled
    );
    expect(createChannelDiscord).toHaveBeenCalledWith({
      guildId: 'G1',
      name: 'My Category',
      type: 4,
      position: void 0
    });
  });
  it('edits a category', async () => {
    await handleDiscordGuildAction(
      'categoryEdit',
      { categoryId: 'CAT1', name: 'Renamed Category' },
      channelsEnabled
    );
    expect(editChannelDiscord).toHaveBeenCalledWith({
      channelId: 'CAT1',
      name: 'Renamed Category',
      position: void 0
    });
  });
  it('deletes a category', async () => {
    await handleDiscordGuildAction('categoryDelete', { categoryId: 'CAT1' }, channelsEnabled);
    expect(deleteChannelDiscord).toHaveBeenCalledWith('CAT1');
  });
  it('sets channel permissions for role', async () => {
    await handleDiscordGuildAction(
      'channelPermissionSet',
      {
        channelId: 'C1',
        targetId: 'R1',
        targetType: 'role',
        allow: '1024',
        deny: '2048'
      },
      channelsEnabled
    );
    expect(setChannelPermissionDiscord).toHaveBeenCalledWith({
      channelId: 'C1',
      targetId: 'R1',
      targetType: 0,
      allow: '1024',
      deny: '2048'
    });
  });
  it('sets channel permissions for member', async () => {
    await handleDiscordGuildAction(
      'channelPermissionSet',
      {
        channelId: 'C1',
        targetId: 'U1',
        targetType: 'member',
        allow: '1024'
      },
      channelsEnabled
    );
    expect(setChannelPermissionDiscord).toHaveBeenCalledWith({
      channelId: 'C1',
      targetId: 'U1',
      targetType: 1,
      allow: '1024',
      deny: void 0
    });
  });
  it('removes channel permissions', async () => {
    await handleDiscordGuildAction(
      'channelPermissionRemove',
      { channelId: 'C1', targetId: 'R1' },
      channelsEnabled
    );
    expect(removeChannelPermissionDiscord).toHaveBeenCalledWith('C1', 'R1');
  });
});
describe('handleDiscordModerationAction', () => {
  it('forwards accountId for timeout', async () => {
    await handleDiscordModerationAction(
      'timeout',
      {
        guildId: 'G1',
        userId: 'U1',
        durationMinutes: 5,
        accountId: 'ops'
      },
      moderationEnabled
    );
    expect(timeoutMemberDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: 'G1',
        userId: 'U1',
        durationMinutes: 5
      }),
      { accountId: 'ops' }
    );
  });
});
