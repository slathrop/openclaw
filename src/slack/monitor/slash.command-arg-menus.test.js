const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSlackMonitorSlashCommands } from './slash.js';
const dispatchMock = vi.fn();
const readAllowFromStoreMock = vi.fn();
const upsertPairingRequestMock = vi.fn();
const resolveAgentRouteMock = vi.fn();
vi.mock('../../auto-reply/reply/provider-dispatcher.js', () => ({
  dispatchReplyWithDispatcher: /* @__PURE__ */ __name((...args) => dispatchMock(...args), 'dispatchReplyWithDispatcher')
}));
vi.mock('../../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: /* @__PURE__ */ __name((...args) => readAllowFromStoreMock(...args), 'readChannelAllowFromStore'),
  upsertChannelPairingRequest: /* @__PURE__ */ __name((...args) => upsertPairingRequestMock(...args), 'upsertChannelPairingRequest')
}));
vi.mock('../../routing/resolve-route.js', () => ({
  resolveAgentRoute: /* @__PURE__ */ __name((...args) => resolveAgentRouteMock(...args), 'resolveAgentRoute')
}));
vi.mock('../../agents/identity.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveEffectiveMessagesConfig: /* @__PURE__ */ __name(() => ({ responsePrefix: '' }), 'resolveEffectiveMessagesConfig')
  };
});
function encodeValue(parts) {
  return [
    'cmdarg',
    encodeURIComponent(parts.command),
    encodeURIComponent(parts.arg),
    encodeURIComponent(parts.value),
    encodeURIComponent(parts.userId)
  ].join('|');
}
__name(encodeValue, 'encodeValue');
function createHarness() {
  const commands = /* @__PURE__ */ new Map();
  const actions = /* @__PURE__ */ new Map();
  const postEphemeral = vi.fn().mockResolvedValue({ ok: true });
  const app = {
    client: { chat: { postEphemeral } },
    command: /* @__PURE__ */ __name((name, handler) => {
      commands.set(name, handler);
    }, 'command'),
    action: /* @__PURE__ */ __name((id, handler) => {
      actions.set(id, handler);
    }, 'action')
  };
  const ctx = {
    cfg: { commands: { native: true } },
    runtime: {},
    botToken: 'bot-token',
    botUserId: 'bot',
    teamId: 'T1',
    allowFrom: ['*'],
    dmEnabled: true,
    dmPolicy: 'open',
    groupDmEnabled: false,
    groupDmChannels: [],
    defaultRequireMention: true,
    groupPolicy: 'open',
    useAccessGroups: false,
    channelsConfig: void 0,
    slashCommand: {
      enabled: true,
      name: 'openclaw',
      ephemeral: true,
      sessionPrefix: 'slack:slash'
    },
    textLimit: 4e3,
    app,
    isChannelAllowed: /* @__PURE__ */ __name(() => true, 'isChannelAllowed'),
    resolveChannelName: /* @__PURE__ */ __name(async () => ({ name: 'dm', type: 'im' }), 'resolveChannelName'),
    resolveUserName: /* @__PURE__ */ __name(async () => ({ name: 'Ada' }), 'resolveUserName')
  };
  const account = { accountId: 'acct', config: { commands: { native: true } } };
  return { commands, actions, postEphemeral, ctx, account };
}
__name(createHarness, 'createHarness');
beforeEach(() => {
  dispatchMock.mockReset().mockResolvedValue({ counts: { final: 1, tool: 0, block: 0 } });
  readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  upsertPairingRequestMock.mockReset().mockResolvedValue({ code: 'PAIRCODE', created: true });
  resolveAgentRouteMock.mockReset().mockReturnValue({
    agentId: 'main',
    sessionKey: 'session:1',
    accountId: 'acct'
  });
});
describe('Slack native command argument menus', () => {
  it('shows a button menu when required args are omitted', async () => {
    const { commands, ctx, account } = createHarness();
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = commands.get('/usage');
    if (!handler) {
      throw new Error('Missing /usage handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    const ack = vi.fn().mockResolvedValue(void 0);
    await handler({
      command: {
        user_id: 'U1',
        user_name: 'Ada',
        channel_id: 'C1',
        channel_name: 'directmessage',
        text: '',
        trigger_id: 't1'
      },
      ack,
      respond
    });
    expect(respond).toHaveBeenCalledTimes(1);
    const payload = respond.mock.calls[0]?.[0];
    expect(payload.blocks?.[0]?.type).toBe('section');
    expect(payload.blocks?.[1]?.type).toBe('actions');
  });
  it('dispatches the command when a menu button is clicked', async () => {
    const { actions, ctx, account } = createHarness();
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = actions.get('openclaw_cmdarg');
    if (!handler) {
      throw new Error('Missing arg-menu action handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      ack: vi.fn().mockResolvedValue(void 0),
      action: {
        value: encodeValue({ command: 'usage', arg: 'mode', value: 'tokens', userId: 'U1' })
      },
      body: {
        user: { id: 'U1', name: 'Ada' },
        channel: { id: 'C1', name: 'directmessage' },
        trigger_id: 't1'
      },
      respond
    });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const call = dispatchMock.mock.calls[0]?.[0];
    expect(call.ctx?.Body).toBe('/usage tokens');
  });
  it('rejects menu clicks from other users', async () => {
    const { actions, ctx, account } = createHarness();
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = actions.get('openclaw_cmdarg');
    if (!handler) {
      throw new Error('Missing arg-menu action handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      ack: vi.fn().mockResolvedValue(void 0),
      action: {
        value: encodeValue({ command: 'usage', arg: 'mode', value: 'tokens', userId: 'U1' })
      },
      body: {
        user: { id: 'U2', name: 'Eve' },
        channel: { id: 'C1', name: 'directmessage' },
        trigger_id: 't1'
      },
      respond
    });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith({
      text: 'That menu is for another user.',
      response_type: 'ephemeral'
    });
  });
  it('falls back to postEphemeral with token when respond is unavailable', async () => {
    const { actions, postEphemeral, ctx, account } = createHarness();
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = actions.get('openclaw_cmdarg');
    if (!handler) {
      throw new Error('Missing arg-menu action handler');
    }
    await handler({
      ack: vi.fn().mockResolvedValue(void 0),
      action: { value: 'garbage' },
      body: { user: { id: 'U1' }, channel: { id: 'C1' } }
    });
    expect(postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'bot-token',
        channel: 'C1',
        user: 'U1'
      })
    );
  });
  it('treats malformed percent-encoding as an invalid button (no throw)', async () => {
    const { actions, postEphemeral, ctx, account } = createHarness();
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = actions.get('openclaw_cmdarg');
    if (!handler) {
      throw new Error('Missing arg-menu action handler');
    }
    await handler({
      ack: vi.fn().mockResolvedValue(void 0),
      action: { value: 'cmdarg|%E0%A4%A|mode|on|U1' },
      body: { user: { id: 'U1' }, channel: { id: 'C1' } }
    });
    expect(postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'bot-token',
        channel: 'C1',
        user: 'U1',
        text: 'Sorry, that button is no longer valid.'
      })
    );
  });
});
