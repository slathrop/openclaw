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
const getSlackTestState = () => slackTestState;
const getSlackHandlers = () => globalThis.__slackHandlers;
const getSlackClient = () => globalThis.__slackClient;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function waitForSlackEvent(name) {
  for (let i = 0; i < 10; i += 1) {
    if (getSlackHandlers()?.has(name)) {
      return;
    }
    await flush();
  }
}
const defaultSlackTestConfig = () => ({
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
});
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
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: () => slackTestState.config
  };
});
vi.mock('../auto-reply/reply.js', () => ({
  getReplyFromConfig: (...args) => slackTestState.replyMock(...args)
}));
vi.mock('./resolve-channels.js', () => ({
  resolveSlackChannelAllowlist: async ({ entries }) => entries.map((input) => ({ input, resolved: false }))
}));
vi.mock('./resolve-users.js', () => ({
  resolveSlackUserAllowlist: async ({ entries }) => entries.map((input) => ({ input, resolved: false }))
}));
vi.mock('./send.js', () => ({
  sendMessageSlack: (...args) => slackTestState.sendMock(...args)
}));
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: (...args) => slackTestState.readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args) => slackTestState.upsertPairingRequestMock(...args)
}));
vi.mock('../config/sessions.js', () => ({
  resolveStorePath: vi.fn(() => '/tmp/openclaw-sessions.json'),
  updateLastRoute: (...args) => slackTestState.updateLastRouteMock(...args),
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
      add: (...args) => slackTestState.reactMock(...args)
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
export {
  defaultSlackTestConfig,
  flush,
  getSlackClient,
  getSlackHandlers,
  getSlackTestState,
  resetSlackTestState,
  waitForSlackEvent
};
