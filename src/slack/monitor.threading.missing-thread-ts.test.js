import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetInboundDedupe } from '../auto-reply/reply/inbound-dedupe.js';
const { monitorSlackProvider } = await import('./monitor.js');
const sendMock = vi.fn();
const replyMock = vi.fn();
const updateLastRouteMock = vi.fn();
const reactMock = vi.fn();
let config = {};
const readAllowFromStoreMock = vi.fn();
const upsertPairingRequestMock = vi.fn();
const getSlackHandlers = () => globalThis.__slackHandlers;
const getSlackClient = () => globalThis.__slackClient;
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: () => config
  };
});
vi.mock('../auto-reply/reply.js', () => ({
  getReplyFromConfig: (...args) => replyMock(...args)
}));
vi.mock('./resolve-channels.js', () => ({
  resolveSlackChannelAllowlist: async ({ entries }) => entries.map((input) => ({ input, resolved: false }))
}));
vi.mock('./resolve-users.js', () => ({
  resolveSlackUserAllowlist: async ({ entries }) => entries.map((input) => ({ input, resolved: false }))
}));
vi.mock('./send.js', () => ({
  sendMessageSlack: (...args) => sendMock(...args)
}));
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: (...args) => readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args) => upsertPairingRequestMock(...args)
}));
vi.mock('../config/sessions.js', () => ({
  resolveStorePath: vi.fn(() => '/tmp/openclaw-sessions.json'),
  updateLastRoute: (...args) => updateLastRouteMock(...args),
  resolveSessionKey: vi.fn(),
  readSessionUpdatedAt: vi.fn(() => void 0),
  recordSessionMetaFromInbound: vi.fn().mockResolvedValue(void 0)
}));
vi.mock('@slack/bolt', () => {
  const handlers = /* @__PURE__ */ new Map();
  globalThis.__slackHandlers = handlers;
  const client = {
    auth: { test: vi.fn().mockResolvedValue({ user_id: 'bot-user' }) },
    conversations: {
      info: vi.fn().mockResolvedValue({
        channel: { name: 'general', is_channel: true }
      }),
      replies: vi.fn().mockResolvedValue({ messages: [] }),
      history: vi.fn().mockResolvedValue({ messages: [] })
    },
    users: {
      info: vi.fn().mockResolvedValue({
        user: { profile: { display_name: 'Ada' } }
      })
    },
    assistant: {
      threads: {
        setStatus: vi.fn().mockResolvedValue({ ok: true })
      }
    },
    reactions: {
      add: (...args) => reactMock(...args)
    }
  };
  globalThis.__slackClient = client;
  class App {
    client = client;
    event(name, handler) {
      handlers.set(name, handler);
    }
    command() {
    }
    start = vi.fn().mockResolvedValue(void 0);
    stop = vi.fn().mockResolvedValue(void 0);
  }
  class HTTPReceiver {
    requestListener = vi.fn();
  }
  return { App, HTTPReceiver, default: { App, HTTPReceiver } };
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function waitForEvent(name) {
  for (let i = 0; i < 10; i += 1) {
    if (getSlackHandlers()?.has(name)) {
      return;
    }
    await flush();
  }
}
beforeEach(() => {
  resetInboundDedupe();
  getSlackHandlers()?.clear();
  config = {
    messages: { responsePrefix: 'PFX' },
    channels: {
      slack: {
        dm: { enabled: true, policy: 'open', allowFrom: ['*'] },
        groupPolicy: 'open',
        channels: { C1: { allow: true, requireMention: false } }
      }
    }
  };
  sendMock.mockReset().mockResolvedValue(void 0);
  replyMock.mockReset();
  updateLastRouteMock.mockReset();
  reactMock.mockReset();
  readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  upsertPairingRequestMock.mockReset().mockResolvedValue({ code: 'PAIRCODE', created: true });
});
describe('monitorSlackProvider threading', () => {
  it('recovers missing thread_ts when parent_user_id is present', async () => {
    replyMock.mockResolvedValue({ text: 'thread reply' });
    const client = getSlackClient();
    if (!client) {
      throw new Error('Slack client not registered');
    }
    const conversations = client.conversations;
    conversations.history.mockResolvedValueOnce({
      messages: [{ ts: '456', thread_ts: '111.222' }]
    });
    const controller = new AbortController();
    const run = monitorSlackProvider({
      botToken: 'bot-token',
      appToken: 'app-token',
      abortSignal: controller.signal
    });
    await waitForEvent('message');
    const handler = getSlackHandlers()?.get('message');
    if (!handler) {
      throw new Error('Slack message handler not registered');
    }
    await handler({
      event: {
        type: 'message',
        user: 'U1',
        text: 'hello',
        ts: '456',
        parent_user_id: 'U2',
        channel: 'C1',
        channel_type: 'channel'
      }
    });
    await flush();
    controller.abort();
    await run;
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][2]).toMatchObject({ threadTs: '111.222' });
  });
});
