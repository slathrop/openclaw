const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { vi } from 'vitest';
const slackTestState = vi.hoisted(() => ({
  config: {},
  sendMock: vi.fn(),
  replyMock: vi.fn(),
  updateLastRouteMock: vi.fn(),
  reactMock: vi.fn(),
  readAllowFromStoreMock: vi.fn(),
  upsertPairingRequestMock: vi.fn()
}));
const getSlackTestState = /* @__PURE__ */ __name(() => slackTestState, 'getSlackTestState');
const getSlackHandlers = /* @__PURE__ */ __name(() => globalThis.__slackHandlers, 'getSlackHandlers');
const getSlackClient = /* @__PURE__ */ __name(() => globalThis.__slackClient, 'getSlackClient');
const flush = /* @__PURE__ */ __name(() => new Promise((resolve) => setTimeout(resolve, 0)), 'flush');
async function waitForSlackEvent(name) {
  for (let i = 0; i < 10; i += 1) {
    if (getSlackHandlers()?.has(name)) {
      return;
    }
    await flush();
  }
}
__name(waitForSlackEvent, 'waitForSlackEvent');
const defaultSlackTestConfig = /* @__PURE__ */ __name(() => ({
  messages: {
    responsePrefix: 'PFX',
    ackReaction: '\u{1F440}',
    ackReactionScope: 'group-mentions'
  },
  channels: {
    slack: {
      dm: { enabled: true, policy: 'open', allowFrom: ['*'] },
      groupPolicy: 'open'
    }
  }
}), 'defaultSlackTestConfig');
function resetSlackTestState(config = defaultSlackTestConfig()) {
  slackTestState.config = config;
  slackTestState.sendMock.mockReset().mockResolvedValue(void 0);
  slackTestState.replyMock.mockReset();
  slackTestState.updateLastRouteMock.mockReset();
  slackTestState.reactMock.mockReset();
  slackTestState.readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  slackTestState.upsertPairingRequestMock.mockReset().mockResolvedValue({
    code: 'PAIRCODE',
    created: true
  });
  getSlackHandlers()?.clear();
}
__name(resetSlackTestState, 'resetSlackTestState');
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: /* @__PURE__ */ __name(() => slackTestState.config, 'loadConfig')
  };
});
vi.mock('../auto-reply/reply.js', () => ({
  getReplyFromConfig: /* @__PURE__ */ __name((...args) => slackTestState.replyMock(...args), 'getReplyFromConfig')
}));
vi.mock('./resolve-channels.js', () => ({
  resolveSlackChannelAllowlist: /* @__PURE__ */ __name(async ({ entries }) => entries.map((input) => ({ input, resolved: false })), 'resolveSlackChannelAllowlist')
}));
vi.mock('./resolve-users.js', () => ({
  resolveSlackUserAllowlist: /* @__PURE__ */ __name(async ({ entries }) => entries.map((input) => ({ input, resolved: false })), 'resolveSlackUserAllowlist')
}));
vi.mock('./send.js', () => ({
  sendMessageSlack: /* @__PURE__ */ __name((...args) => slackTestState.sendMock(...args), 'sendMessageSlack')
}));
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: /* @__PURE__ */ __name((...args) => slackTestState.readAllowFromStoreMock(...args), 'readChannelAllowFromStore'),
  upsertChannelPairingRequest: /* @__PURE__ */ __name((...args) => slackTestState.upsertPairingRequestMock(...args), 'upsertChannelPairingRequest')
}));
vi.mock('../config/sessions.js', () => ({
  resolveStorePath: vi.fn(() => '/tmp/openclaw-sessions.json'),
  updateLastRoute: /* @__PURE__ */ __name((...args) => slackTestState.updateLastRouteMock(...args), 'updateLastRoute'),
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
        channel: { name: 'dm', is_im: true }
      }),
      replies: vi.fn().mockResolvedValue({ messages: [] })
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
      add: /* @__PURE__ */ __name((...args) => slackTestState.reactMock(...args), 'add')
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
export {
  defaultSlackTestConfig,
  flush,
  getSlackClient,
  getSlackHandlers,
  getSlackTestState,
  resetSlackTestState,
  waitForSlackEvent
};
