import { ChannelType, MessageType } from '@buape/carbon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiscordMessageHandler } from './monitor.js';
import { __resetDiscordChannelInfoCacheForTest } from './monitor/message-utils.js';
import { __resetDiscordThreadStarterCacheForTest } from './monitor/threading.js';
const sendMock = vi.fn();
const reactMock = vi.fn();
const updateLastRouteMock = vi.fn();
const dispatchMock = vi.fn();
const readAllowFromStoreMock = vi.fn();
const upsertPairingRequestMock = vi.fn();
vi.mock('./send.js', () => ({
  sendMessageDiscord: (...args) => sendMock(...args),
  reactMessageDiscord: async (...args) => {
    reactMock(...args);
  }
}));
vi.mock('../auto-reply/dispatch.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    dispatchInboundMessage: (...args) => dispatchMock(...args),
    dispatchInboundMessageWithDispatcher: (...args) => dispatchMock(...args),
    dispatchInboundMessageWithBufferedDispatcher: (...args) => dispatchMock(...args)
  };
});
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: (...args) => readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args) => upsertPairingRequestMock(...args)
}));
vi.mock('../config/sessions.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveStorePath: vi.fn(() => '/tmp/openclaw-sessions.json'),
    updateLastRoute: (...args) => updateLastRouteMock(...args),
    resolveSessionKey: vi.fn()
  };
});
beforeEach(() => {
  sendMock.mockReset().mockResolvedValue(void 0);
  updateLastRouteMock.mockReset();
  dispatchMock.mockReset().mockImplementation(async ({ dispatcher }) => {
    dispatcher.sendFinalReply({ text: 'hi' });
    return { queuedFinal: true, counts: { tool: 0, block: 0, final: 1 } };
  });
  readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  upsertPairingRequestMock.mockReset().mockResolvedValue({ code: 'PAIRCODE', created: true });
  __resetDiscordChannelInfoCacheForTest();
  __resetDiscordThreadStarterCacheForTest();
});
describe('discord tool result dispatch', () => {
  it('sends status replies with responsePrefix', async () => {
    const cfg = {
      agents: {
        defaults: {
          model: 'anthropic/claude-opus-4-5',
          workspace: '/tmp/openclaw'
        }
      },
      session: { store: '/tmp/openclaw-sessions.json' },
      messages: { responsePrefix: 'PFX' },
      channels: { discord: { dm: { enabled: true, policy: 'open' } } }
    };
    const runtimeError = vi.fn();
    const handler = createDiscordMessageHandler({
      cfg,
      discordConfig: cfg.channels.discord,
      accountId: 'default',
      token: 'token',
      runtime: {
        log: vi.fn(),
        error: runtimeError,
        exit: (code) => {
          throw new Error(`exit ${code}`);
        }
      },
      botUserId: 'bot-id',
      guildHistories: /* @__PURE__ */ new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1e4,
      textLimit: 2e3,
      replyToMode: 'off',
      dmEnabled: true,
      groupDmEnabled: false
    });
    const client = {
      fetchChannel: vi.fn().mockResolvedValue({
        type: ChannelType.DM,
        name: 'dm'
      })
    };
    await handler(
      {
        message: {
          id: 'm1',
          content: '/status',
          channelId: 'c1',
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: 'u1', bot: false, username: 'Ada' }
        },
        author: { id: 'u1', bot: false, username: 'Ada' },
        guild_id: null
      },
      client
    );
    expect(runtimeError).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[1]).toMatch(/^PFX /);
  }, 3e4);
  it('caches channel info lookups between messages', async () => {
    const cfg = {
      agents: {
        defaults: {
          model: 'anthropic/claude-opus-4-5',
          workspace: '/tmp/openclaw'
        }
      },
      session: { store: '/tmp/openclaw-sessions.json' },
      channels: { discord: { dm: { enabled: true, policy: 'open' } } }
    };
    const handler = createDiscordMessageHandler({
      cfg,
      discordConfig: cfg.channels.discord,
      accountId: 'default',
      token: 'token',
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
        exit: (code) => {
          throw new Error(`exit ${code}`);
        }
      },
      botUserId: 'bot-id',
      guildHistories: /* @__PURE__ */ new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1e4,
      textLimit: 2e3,
      replyToMode: 'off',
      dmEnabled: true,
      groupDmEnabled: false
    });
    const fetchChannel = vi.fn().mockResolvedValue({
      type: ChannelType.DM,
      name: 'dm'
    });
    const client = { fetchChannel };
    const baseMessage = {
      content: 'hello',
      channelId: 'cache-channel-1',
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type: MessageType.Default,
      attachments: [],
      embeds: [],
      mentionedEveryone: false,
      mentionedUsers: [],
      mentionedRoles: [],
      author: { id: 'u-cache', bot: false, username: 'Ada' }
    };
    await handler(
      {
        message: { ...baseMessage, id: 'm-cache-1' },
        author: baseMessage.author,
        guild_id: null
      },
      client
    );
    await handler(
      {
        message: { ...baseMessage, id: 'm-cache-2' },
        author: baseMessage.author,
        guild_id: null
      },
      client
    );
    expect(fetchChannel).toHaveBeenCalledTimes(1);
  });
  it('includes forwarded message snapshots in body', async () => {
    let capturedBody = '';
    dispatchMock.mockImplementationOnce(async ({ ctx, dispatcher }) => {
      capturedBody = ctx.Body ?? '';
      dispatcher.sendFinalReply({ text: 'ok' });
      return { queuedFinal: true, counts: { final: 1 } };
    });
    const cfg = {
      agents: {
        defaults: {
          model: 'anthropic/claude-opus-4-5',
          workspace: '/tmp/openclaw'
        }
      },
      session: { store: '/tmp/openclaw-sessions.json' },
      channels: { discord: { dm: { enabled: true, policy: 'open' } } }
    };
    const handler = createDiscordMessageHandler({
      cfg,
      discordConfig: cfg.channels.discord,
      accountId: 'default',
      token: 'token',
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
        exit: (code) => {
          throw new Error(`exit ${code}`);
        }
      },
      botUserId: 'bot-id',
      guildHistories: /* @__PURE__ */ new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1e4,
      textLimit: 2e3,
      replyToMode: 'off',
      dmEnabled: true,
      groupDmEnabled: false
    });
    const client = {
      fetchChannel: vi.fn().mockResolvedValue({
        type: ChannelType.DM,
        name: 'dm'
      })
    };
    await handler(
      {
        message: {
          id: 'm-forward-1',
          content: '',
          channelId: 'c-forward-1',
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: 'u1', bot: false, username: 'Ada' },
          rawData: {
            message_snapshots: [
              {
                message: {
                  content: 'forwarded hello',
                  embeds: [],
                  attachments: [],
                  author: {
                    id: 'u2',
                    username: 'Bob',
                    discriminator: '0'
                  }
                }
              }
            ]
          }
        },
        author: { id: 'u1', bot: false, username: 'Ada' },
        guild_id: null
      },
      client
    );
    expect(capturedBody).toContain('[Forwarded message from @Bob]');
    expect(capturedBody).toContain('forwarded hello');
  });
  it('uses channel id allowlists for non-thread channels with categories', async () => {
    const { createDiscordMessageHandler: createDiscordMessageHandler2 } = await import('./monitor.js');
    let capturedCtx;
    dispatchMock.mockImplementationOnce(async ({ ctx, dispatcher }) => {
      capturedCtx = ctx;
      dispatcher.sendFinalReply({ text: 'hi' });
      return { queuedFinal: true, counts: { final: 1 } };
    });
    const cfg = {
      agents: {
        defaults: {
          model: 'anthropic/claude-opus-4-5',
          workspace: '/tmp/openclaw'
        }
      },
      session: { store: '/tmp/openclaw-sessions.json' },
      channels: {
        discord: {
          dm: { enabled: true, policy: 'open' },
          guilds: {
            '*': {
              requireMention: false,
              channels: { c1: { allow: true } }
            }
          }
        }
      },
      routing: { allowFrom: [] }
    };
    const handler = createDiscordMessageHandler2({
      cfg,
      discordConfig: cfg.channels.discord,
      accountId: 'default',
      token: 'token',
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
        exit: (code) => {
          throw new Error(`exit ${code}`);
        }
      },
      botUserId: 'bot-id',
      guildHistories: /* @__PURE__ */ new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1e4,
      textLimit: 2e3,
      replyToMode: 'off',
      dmEnabled: true,
      groupDmEnabled: false,
      guildEntries: {
        '*': { requireMention: false, channels: { c1: { allow: true } } }
      }
    });
    const client = {
      fetchChannel: vi.fn().mockResolvedValue({
        type: ChannelType.GuildText,
        name: 'general',
        parentId: 'category-1'
      }),
      rest: { get: vi.fn() }
    };
    await handler(
      {
        message: {
          id: 'm-category',
          content: 'hello',
          channelId: 'c1',
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: 'u1', bot: false, username: 'Ada', tag: 'Ada#1' }
        },
        author: { id: 'u1', bot: false, username: 'Ada', tag: 'Ada#1' },
        member: { displayName: 'Ada' },
        guild: { id: 'g1', name: 'Guild' },
        guild_id: 'g1'
      },
      client
    );
    expect(capturedCtx?.SessionKey).toBe('agent:main:discord:channel:c1');
  });
  it('prefixes group bodies with sender label', async () => {
    const { createDiscordMessageHandler: createDiscordMessageHandler2 } = await import('./monitor.js');
    let capturedBody = '';
    dispatchMock.mockImplementationOnce(async ({ ctx, dispatcher }) => {
      capturedBody = ctx.Body ?? '';
      dispatcher.sendFinalReply({ text: 'ok' });
      return { queuedFinal: true, counts: { final: 1 } };
    });
    const cfg = {
      agents: {
        defaults: {
          model: 'anthropic/claude-opus-4-5',
          workspace: '/tmp/openclaw'
        }
      },
      session: { store: '/tmp/openclaw-sessions.json' },
      channels: {
        discord: {
          dm: { enabled: true, policy: 'open' },
          guilds: {
            '*': {
              requireMention: false,
              channels: { c1: { allow: true } }
            }
          }
        }
      },
      routing: { allowFrom: [] }
    };
    const handler = createDiscordMessageHandler2({
      cfg,
      discordConfig: cfg.channels.discord,
      accountId: 'default',
      token: 'token',
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
        exit: (code) => {
          throw new Error(`exit ${code}`);
        }
      },
      botUserId: 'bot-id',
      guildHistories: /* @__PURE__ */ new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1e4,
      textLimit: 2e3,
      replyToMode: 'off',
      dmEnabled: true,
      groupDmEnabled: false,
      guildEntries: {
        '*': { requireMention: false, channels: { c1: { allow: true } } }
      }
    });
    const client = {
      fetchChannel: vi.fn().mockResolvedValue({
        type: ChannelType.GuildText,
        name: 'general',
        parentId: 'category-1'
      }),
      rest: { get: vi.fn() }
    };
    await handler(
      {
        message: {
          id: 'm-prefix',
          content: 'hello',
          channelId: 'c1',
          timestamp: (/* @__PURE__ */ new Date('2026-01-17T00:00:00Z')).toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: 'u1', bot: false, username: 'Ada', discriminator: '1234' }
        },
        author: { id: 'u1', bot: false, username: 'Ada', discriminator: '1234' },
        member: { displayName: 'Ada' },
        guild: { id: 'g1', name: 'Guild' },
        guild_id: 'g1'
      },
      client
    );
    expect(capturedBody).toContain('Ada (Ada#1234): hello');
  });
  it('replies with pairing code and sender id when dmPolicy is pairing', async () => {
    const { createDiscordMessageHandler: createDiscordMessageHandler2 } = await import('./monitor.js');
    const cfg = {
      agents: {
        defaults: {
          model: 'anthropic/claude-opus-4-5',
          workspace: '/tmp/openclaw'
        }
      },
      session: { store: '/tmp/openclaw-sessions.json' },
      channels: {
        discord: { dm: { enabled: true, policy: 'pairing', allowFrom: [] } }
      }
    };
    const handler = createDiscordMessageHandler2({
      cfg,
      discordConfig: cfg.channels.discord,
      accountId: 'default',
      token: 'token',
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
        exit: (code) => {
          throw new Error(`exit ${code}`);
        }
      },
      botUserId: 'bot-id',
      guildHistories: /* @__PURE__ */ new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1e4,
      textLimit: 2e3,
      replyToMode: 'off',
      dmEnabled: true,
      groupDmEnabled: false
    });
    const client = {
      fetchChannel: vi.fn().mockResolvedValue({
        type: ChannelType.DM,
        name: 'dm'
      })
    };
    await handler(
      {
        message: {
          id: 'm1',
          content: 'hello',
          channelId: 'c1',
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: 'u2', bot: false, username: 'Ada' }
        },
        author: { id: 'u2', bot: false, username: 'Ada' },
        guild_id: null
      },
      client
    );
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(upsertPairingRequestMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(String(sendMock.mock.calls[0]?.[1] ?? '')).toContain('Your Discord user id: u2');
    expect(String(sendMock.mock.calls[0]?.[1] ?? '')).toContain('Pairing code: PAIRCODE');
  }, 1e4);
});
