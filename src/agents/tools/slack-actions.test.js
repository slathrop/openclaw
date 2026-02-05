import { describe, expect, it, vi } from 'vitest';
import { handleSlackAction } from './slack-actions.js';
const deleteSlackMessage = vi.fn(async () => ({}));
const editSlackMessage = vi.fn(async () => ({}));
const getSlackMemberInfo = vi.fn(async () => ({}));
const listSlackEmojis = vi.fn(async () => ({}));
const listSlackPins = vi.fn(async () => ({}));
const listSlackReactions = vi.fn(async () => ({}));
const pinSlackMessage = vi.fn(async () => ({}));
const reactSlackMessage = vi.fn(async () => ({}));
const readSlackMessages = vi.fn(async () => ({}));
const removeOwnSlackReactions = vi.fn(async () => ['thumbsup']);
const removeSlackReaction = vi.fn(async () => ({}));
const sendSlackMessage = vi.fn(async () => ({}));
const unpinSlackMessage = vi.fn(async () => ({}));
vi.mock('../../slack/actions.js', () => ({
  deleteSlackMessage: (...args) => deleteSlackMessage(...args),
  editSlackMessage: (...args) => editSlackMessage(...args),
  getSlackMemberInfo: (...args) => getSlackMemberInfo(...args),
  listSlackEmojis: (...args) => listSlackEmojis(...args),
  listSlackPins: (...args) => listSlackPins(...args),
  listSlackReactions: (...args) => listSlackReactions(...args),
  pinSlackMessage: (...args) => pinSlackMessage(...args),
  reactSlackMessage: (...args) => reactSlackMessage(...args),
  readSlackMessages: (...args) => readSlackMessages(...args),
  removeOwnSlackReactions: (...args) => removeOwnSlackReactions(...args),
  removeSlackReaction: (...args) => removeSlackReaction(...args),
  sendSlackMessage: (...args) => sendSlackMessage(...args),
  unpinSlackMessage: (...args) => unpinSlackMessage(...args)
}));
describe('handleSlackAction', () => {
  it('adds reactions', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    await handleSlackAction(
      {
        action: 'react',
        channelId: 'C1',
        messageId: '123.456',
        emoji: '\u2705'
      },
      cfg
    );
    expect(reactSlackMessage).toHaveBeenCalledWith('C1', '123.456', '\u2705');
  });
  it('strips channel: prefix for channelId params', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    await handleSlackAction(
      {
        action: 'react',
        channelId: 'channel:C1',
        messageId: '123.456',
        emoji: '\u2705'
      },
      cfg
    );
    expect(reactSlackMessage).toHaveBeenCalledWith('C1', '123.456', '\u2705');
  });
  it('removes reactions on empty emoji', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    await handleSlackAction(
      {
        action: 'react',
        channelId: 'C1',
        messageId: '123.456',
        emoji: ''
      },
      cfg
    );
    expect(removeOwnSlackReactions).toHaveBeenCalledWith('C1', '123.456');
  });
  it('removes reactions when remove flag set', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    await handleSlackAction(
      {
        action: 'react',
        channelId: 'C1',
        messageId: '123.456',
        emoji: '\u2705',
        remove: true
      },
      cfg
    );
    expect(removeSlackReaction).toHaveBeenCalledWith('C1', '123.456', '\u2705');
  });
  it('rejects removes without emoji', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    await expect(
      handleSlackAction(
        {
          action: 'react',
          channelId: 'C1',
          messageId: '123.456',
          emoji: '',
          remove: true
        },
        cfg
      )
    ).rejects.toThrow(/Emoji is required/);
  });
  it('respects reaction gating', async () => {
    const cfg = {
      channels: { slack: { botToken: 'tok', actions: { reactions: false } } }
    };
    await expect(
      handleSlackAction(
        {
          action: 'react',
          channelId: 'C1',
          messageId: '123.456',
          emoji: '\u2705'
        },
        cfg
      )
    ).rejects.toThrow(/Slack reactions are disabled/);
  });
  it('passes threadTs to sendSlackMessage for thread replies', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    await handleSlackAction(
      {
        action: 'sendMessage',
        to: 'channel:C123',
        content: 'Hello thread',
        threadTs: '1234567890.123456'
      },
      cfg
    );
    expect(sendSlackMessage).toHaveBeenCalledWith('channel:C123', 'Hello thread', {
      mediaUrl: void 0,
      threadTs: '1234567890.123456'
    });
  });
  it('auto-injects threadTs from context when replyToMode=all', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    await handleSlackAction(
      {
        action: 'sendMessage',
        to: 'channel:C123',
        content: 'Auto-threaded'
      },
      cfg,
      {
        currentChannelId: 'C123',
        currentThreadTs: '1111111111.111111',
        replyToMode: 'all'
      }
    );
    expect(sendSlackMessage).toHaveBeenCalledWith('channel:C123', 'Auto-threaded', {
      mediaUrl: void 0,
      threadTs: '1111111111.111111'
    });
  });
  it('replyToMode=first threads first message then stops', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    const hasRepliedRef = { value: false };
    const context = {
      currentChannelId: 'C123',
      currentThreadTs: '1111111111.111111',
      replyToMode: 'first',
      hasRepliedRef
    };
    await handleSlackAction(
      { action: 'sendMessage', to: 'channel:C123', content: 'First' },
      cfg,
      context
    );
    expect(sendSlackMessage).toHaveBeenLastCalledWith('channel:C123', 'First', {
      mediaUrl: void 0,
      threadTs: '1111111111.111111'
    });
    expect(hasRepliedRef.value).toBe(true);
    await handleSlackAction(
      { action: 'sendMessage', to: 'channel:C123', content: 'Second' },
      cfg,
      context
    );
    expect(sendSlackMessage).toHaveBeenLastCalledWith('channel:C123', 'Second', {
      mediaUrl: void 0,
      threadTs: void 0
    });
  });
  it('replyToMode=first marks hasRepliedRef even when threadTs is explicit', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    const hasRepliedRef = { value: false };
    const context = {
      currentChannelId: 'C123',
      currentThreadTs: '1111111111.111111',
      replyToMode: 'first',
      hasRepliedRef
    };
    await handleSlackAction(
      {
        action: 'sendMessage',
        to: 'channel:C123',
        content: 'Explicit',
        threadTs: '2222222222.222222'
      },
      cfg,
      context
    );
    expect(sendSlackMessage).toHaveBeenLastCalledWith('channel:C123', 'Explicit', {
      mediaUrl: void 0,
      threadTs: '2222222222.222222'
    });
    expect(hasRepliedRef.value).toBe(true);
    await handleSlackAction(
      { action: 'sendMessage', to: 'channel:C123', content: 'Second' },
      cfg,
      context
    );
    expect(sendSlackMessage).toHaveBeenLastCalledWith('channel:C123', 'Second', {
      mediaUrl: void 0,
      threadTs: void 0
    });
  });
  it('replyToMode=first without hasRepliedRef does not thread', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    await handleSlackAction({ action: 'sendMessage', to: 'channel:C123', content: 'No ref' }, cfg, {
      currentChannelId: 'C123',
      currentThreadTs: '1111111111.111111',
      replyToMode: 'first'
      // no hasRepliedRef
    });
    expect(sendSlackMessage).toHaveBeenCalledWith('channel:C123', 'No ref', {
      mediaUrl: void 0,
      threadTs: void 0
    });
  });
  it('does not auto-inject threadTs when replyToMode=off', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    await handleSlackAction(
      {
        action: 'sendMessage',
        to: 'channel:C123',
        content: 'Off mode'
      },
      cfg,
      {
        currentChannelId: 'C123',
        currentThreadTs: '1111111111.111111',
        replyToMode: 'off'
      }
    );
    expect(sendSlackMessage).toHaveBeenCalledWith('channel:C123', 'Off mode', {
      mediaUrl: void 0,
      threadTs: void 0
    });
  });
  it('does not auto-inject threadTs when sending to different channel', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    await handleSlackAction(
      {
        action: 'sendMessage',
        to: 'channel:C999',
        content: 'Different channel'
      },
      cfg,
      {
        currentChannelId: 'C123',
        currentThreadTs: '1111111111.111111',
        replyToMode: 'all'
      }
    );
    expect(sendSlackMessage).toHaveBeenCalledWith('channel:C999', 'Different channel', {
      mediaUrl: void 0,
      threadTs: void 0
    });
  });
  it('explicit threadTs overrides context threadTs', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    await handleSlackAction(
      {
        action: 'sendMessage',
        to: 'channel:C123',
        content: 'Explicit thread',
        threadTs: '2222222222.222222'
      },
      cfg,
      {
        currentChannelId: 'C123',
        currentThreadTs: '1111111111.111111',
        replyToMode: 'all'
      }
    );
    expect(sendSlackMessage).toHaveBeenCalledWith('channel:C123', 'Explicit thread', {
      mediaUrl: void 0,
      threadTs: '2222222222.222222'
    });
  });
  it('handles channel target without prefix when replyToMode=all', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    sendSlackMessage.mockClear();
    await handleSlackAction(
      {
        action: 'sendMessage',
        to: 'C123',
        content: 'No prefix'
      },
      cfg,
      {
        currentChannelId: 'C123',
        currentThreadTs: '1111111111.111111',
        replyToMode: 'all'
      }
    );
    expect(sendSlackMessage).toHaveBeenCalledWith('C123', 'No prefix', {
      mediaUrl: void 0,
      threadTs: '1111111111.111111'
    });
  });
  it('adds normalized timestamps to readMessages payloads', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    readSlackMessages.mockResolvedValueOnce({
      messages: [{ ts: '1735689600.456', text: 'hi' }],
      hasMore: false
    });
    const result = await handleSlackAction({ action: 'readMessages', channelId: 'C1' }, cfg);
    const payload = result.details;
    const expectedMs = Math.round(1735689600456e-3 * 1e3);
    expect(payload.messages[0].timestampMs).toBe(expectedMs);
    expect(payload.messages[0].timestampUtc).toBe(new Date(expectedMs).toISOString());
  });
  it('passes threadId through to readSlackMessages', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    readSlackMessages.mockClear();
    readSlackMessages.mockResolvedValueOnce({ messages: [], hasMore: false });
    await handleSlackAction(
      { action: 'readMessages', channelId: 'C1', threadId: '12345.6789' },
      cfg
    );
    const [, opts] = readSlackMessages.mock.calls[0] ?? [];
    expect(opts?.threadId).toBe('12345.6789');
  });
  it('adds normalized timestamps to pin payloads', async () => {
    const cfg = { channels: { slack: { botToken: 'tok' } } };
    listSlackPins.mockResolvedValueOnce([
      {
        type: 'message',
        message: { ts: '1735689600.789', text: 'pinned' }
      }
    ]);
    const result = await handleSlackAction({ action: 'listPins', channelId: 'C1' }, cfg);
    const payload = result.details;
    const expectedMs = Math.round(1735689600789e-3 * 1e3);
    expect(payload.pins[0].message?.timestampMs).toBe(expectedMs);
    expect(payload.pins[0].message?.timestampUtc).toBe(new Date(expectedMs).toISOString());
  });
  it('uses user token for reads when available', async () => {
    const cfg = {
      channels: { slack: { botToken: 'xoxb-1', userToken: 'xoxp-1' } }
    };
    readSlackMessages.mockClear();
    readSlackMessages.mockResolvedValueOnce({ messages: [], hasMore: false });
    await handleSlackAction({ action: 'readMessages', channelId: 'C1' }, cfg);
    const [, opts] = readSlackMessages.mock.calls[0] ?? [];
    expect(opts?.token).toBe('xoxp-1');
  });
  it('falls back to bot token for reads when user token missing', async () => {
    const cfg = {
      channels: { slack: { botToken: 'xoxb-1' } }
    };
    readSlackMessages.mockClear();
    readSlackMessages.mockResolvedValueOnce({ messages: [], hasMore: false });
    await handleSlackAction({ action: 'readMessages', channelId: 'C1' }, cfg);
    const [, opts] = readSlackMessages.mock.calls[0] ?? [];
    expect(opts?.token).toBeUndefined();
  });
  it('uses bot token for writes when userTokenReadOnly is true', async () => {
    const cfg = {
      channels: { slack: { botToken: 'xoxb-1', userToken: 'xoxp-1' } }
    };
    sendSlackMessage.mockClear();
    await handleSlackAction({ action: 'sendMessage', to: 'channel:C1', content: 'Hello' }, cfg);
    const [, , opts] = sendSlackMessage.mock.calls[0] ?? [];
    expect(opts?.token).toBeUndefined();
  });
  it('allows user token writes when bot token is missing', async () => {
    const cfg = {
      channels: {
        slack: { userToken: 'xoxp-1', userTokenReadOnly: false }
      }
    };
    sendSlackMessage.mockClear();
    await handleSlackAction({ action: 'sendMessage', to: 'channel:C1', content: 'Hello' }, cfg);
    const [, , opts] = sendSlackMessage.mock.calls[0] ?? [];
    expect(opts?.token).toBe('xoxp-1');
  });
});
