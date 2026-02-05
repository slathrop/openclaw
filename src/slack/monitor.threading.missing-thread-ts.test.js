const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
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
const getSlackHandlers = /* @__PURE__ */ __name(() => globalThis.__slackHandlers, 'getSlackHandlers');
const getSlackClient = /* @__PURE__ */ __name(() => globalThis.__slackClient, 'getSlackClient');
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: /* @__PURE__ */ __name(() => config, 'loadConfig')
  };
});
vi.mock('../auto-reply/reply.js', () => ({
  getReplyFromConfig: /* @__PURE__ */ __name((...args) => replyMock(...args), 'getReplyFromConfig')
}));
vi.mock('./resolve-channels.js', () => ({
  resolveSlackChannelAllowlist: /* @__PURE__ */ __name(async ({ entries }) => entries.map((input) => ({ input, resolved: false })), 'resolveSlackChannelAllowlist')
}));
vi.mock('./resolve-users.js', () => ({
  resolveSlackUserAllowlist: /* @__PURE__ */ __name(async ({ entries }) => entries.map((input) => ({ input, resolved: false })), 'resolveSlackUserAllowlist')
}));
vi.mock('./send.js', () => ({
  sendMessageSlack: /* @__PURE__ */ __name((...args) => sendMock(...args), 'sendMessageSlack')
}));
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: /* @__PURE__ */ __name((...args) => readAllowFromStoreMock(...args), 'readChannelAllowFromStore'),
  upsertChannelPairingRequest: /* @__PURE__ */ __name((...args) => upsertPairingRequestMock(...args), 'upsertChannelPairingRequest')
}));
vi.mock('../config/sessions.js', () => ({
  resolveStorePath: vi.fn(() => '/tmp/openclaw-sessions.json'),
  updateLastRoute: /* @__PURE__ */ __name((...args) => updateLastRouteMock(...args), 'updateLastRoute'),
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
      add: /* @__PURE__ */ __name((...args) => reactMock(...args), 'add')
    }
  };
  globalThis.__slackClient = client;
  class App {
    static {
      __name(this, 'App');
    }
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
    static {
      __name(this, 'HTTPReceiver');
    }
    requestListener = vi.fn();
  }
  return { App, HTTPReceiver, default: { App, HTTPReceiver } };
});
const flush = /* @__PURE__ */ __name(() => new Promise((resolve) => setTimeout(resolve, 0)), 'flush');
async function waitForEvent(name) {
  for (let i = 0; i < 10; i += 1) {
    if (getSlackHandlers()?.has(name)) {
      return;
    }
    await flush();
  }
}
__name(waitForEvent, 'waitForEvent');
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
