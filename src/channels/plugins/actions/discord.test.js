import { describe, expect, it, vi } from 'vitest';
const sendMessageDiscord = vi.fn(
  async () => ({ ok: true })
);
const sendPollDiscord = vi.fn(
  async () => ({ ok: true })
);
vi.mock('../../../discord/send.js', async () => {
  const actual = await vi.importActual(
    '../../../discord/send.js'
  );
  return {
    ...actual,
    sendMessageDiscord: (...args) => sendMessageDiscord(...args),
    sendPollDiscord: (...args) => sendPollDiscord(...args)
  };
});
const loadHandleDiscordMessageAction = async () => {
  const mod = await import('./discord/handle-action.js');
  return mod.handleDiscordMessageAction;
};
const loadDiscordMessageActions = async () => {
  const mod = await import('./discord.js');
  return mod.discordMessageActions;
};
describe('discord message actions', () => {
  it('lists channel and upload actions by default', async () => {
    const cfg = { channels: { discord: { token: 'd0' } } };
    const discordMessageActions = await loadDiscordMessageActions();
    const actions = discordMessageActions.listActions?.({ cfg }) ?? [];
    expect(actions).toContain('emoji-upload');
    expect(actions).toContain('sticker-upload');
    expect(actions).toContain('channel-create');
  });
  it('respects disabled channel actions', async () => {
    const cfg = {
      channels: { discord: { token: 'd0', actions: { channels: false } } }
    };
    const discordMessageActions = await loadDiscordMessageActions();
    const actions = discordMessageActions.listActions?.({ cfg }) ?? [];
    expect(actions).not.toContain('channel-create');
  });
});
describe('handleDiscordMessageAction', () => {
  it('forwards context accountId for send', async () => {
    sendMessageDiscord.mockClear();
    const handleDiscordMessageAction = await loadHandleDiscordMessageAction();
    await handleDiscordMessageAction({
      action: 'send',
      params: {
        to: 'channel:123',
        message: 'hi'
      },
      cfg: {},
      accountId: 'ops'
    });
    expect(sendMessageDiscord).toHaveBeenCalledWith(
      'channel:123',
      'hi',
      expect.objectContaining({
        accountId: 'ops'
      })
    );
  });
  it('falls back to params accountId when context missing', async () => {
    sendPollDiscord.mockClear();
    const handleDiscordMessageAction = await loadHandleDiscordMessageAction();
    await handleDiscordMessageAction({
      action: 'poll',
      params: {
        to: 'channel:123',
        pollQuestion: 'Ready?',
        pollOption: ['Yes', 'No'],
        accountId: 'marve'
      },
      cfg: {}
    });
    expect(sendPollDiscord).toHaveBeenCalledWith(
      'channel:123',
      expect.objectContaining({
        question: 'Ready?',
        options: ['Yes', 'No']
      }),
      expect.objectContaining({
        accountId: 'marve'
      })
    );
  });
  it('forwards accountId for thread replies', async () => {
    sendMessageDiscord.mockClear();
    const handleDiscordMessageAction = await loadHandleDiscordMessageAction();
    await handleDiscordMessageAction({
      action: 'thread-reply',
      params: {
        channelId: '123',
        message: 'hi'
      },
      cfg: {},
      accountId: 'ops'
    });
    expect(sendMessageDiscord).toHaveBeenCalledWith(
      'channel:123',
      'hi',
      expect.objectContaining({
        accountId: 'ops'
      })
    );
  });
  it('accepts threadId for thread replies (tool compatibility)', async () => {
    sendMessageDiscord.mockClear();
    const handleDiscordMessageAction = await loadHandleDiscordMessageAction();
    await handleDiscordMessageAction({
      action: 'thread-reply',
      params: {
        // The `message` tool uses `threadId`.
        threadId: '999',
        // Include a conflicting channelId to ensure threadId takes precedence.
        channelId: '123',
        message: 'hi'
      },
      cfg: {},
      accountId: 'ops'
    });
    expect(sendMessageDiscord).toHaveBeenCalledWith(
      'channel:999',
      'hi',
      expect.objectContaining({
        accountId: 'ops'
      })
    );
  });
});
