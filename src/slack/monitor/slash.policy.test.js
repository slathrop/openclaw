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
function createHarness(overrides) {
  const commands = /* @__PURE__ */ new Map();
  const postEphemeral = vi.fn().mockResolvedValue({ ok: true });
  const app = {
    client: { chat: { postEphemeral } },
    command: /* @__PURE__ */ __name((name, handler) => {
      commands.set(name, handler);
    }, 'command')
  };
  const channelId = overrides?.channelId ?? 'C_UNLISTED';
  const channelName = overrides?.channelName ?? 'unlisted';
  const ctx = {
    cfg: { commands: { native: false } },
    runtime: {},
    botToken: 'bot-token',
    botUserId: 'bot',
    teamId: 'T1',
    allowFrom: overrides?.allowFrom ?? ['*'],
    dmEnabled: true,
    dmPolicy: 'open',
    groupDmEnabled: false,
    groupDmChannels: [],
    defaultRequireMention: true,
    groupPolicy: overrides?.groupPolicy ?? 'open',
    useAccessGroups: overrides?.useAccessGroups ?? true,
    channelsConfig: overrides?.channelsConfig,
    slashCommand: {
      enabled: true,
      name: 'openclaw',
      ephemeral: true,
      sessionPrefix: 'slack:slash'
    },
    textLimit: 4e3,
    app,
    isChannelAllowed: /* @__PURE__ */ __name(() => true, 'isChannelAllowed'),
    resolveChannelName: overrides?.resolveChannelName ?? (async () => ({ name: channelName, type: 'channel' })),
    resolveUserName: /* @__PURE__ */ __name(async () => ({ name: 'Ada' }), 'resolveUserName')
  };
  const account = { accountId: 'acct', config: { commands: { native: false } } };
  return { commands, ctx, account, postEphemeral, channelId, channelName };
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
describe('slack slash commands channel policy', () => {
  it('allows unlisted channels when groupPolicy is open', async () => {
    const { commands, ctx, account, channelId, channelName } = createHarness({
      groupPolicy: 'open',
      channelsConfig: { C_LISTED: { requireMention: true } },
      channelId: 'C_UNLISTED',
      channelName: 'unlisted'
    });
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = [...commands.values()][0];
    if (!handler) {
      throw new Error('Missing slash handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      command: {
        user_id: 'U1',
        user_name: 'Ada',
        channel_id: channelId,
        channel_name: channelName,
        text: 'hello',
        trigger_id: 't1'
      },
      ack: vi.fn().mockResolvedValue(void 0),
      respond
    });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(respond).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: 'This channel is not allowed.' })
    );
  });
  it('blocks explicitly denied channels when groupPolicy is open', async () => {
    const { commands, ctx, account, channelId, channelName } = createHarness({
      groupPolicy: 'open',
      channelsConfig: { C_DENIED: { allow: false } },
      channelId: 'C_DENIED',
      channelName: 'denied'
    });
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = [...commands.values()][0];
    if (!handler) {
      throw new Error('Missing slash handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      command: {
        user_id: 'U1',
        user_name: 'Ada',
        channel_id: channelId,
        channel_name: channelName,
        text: 'hello',
        trigger_id: 't1'
      },
      ack: vi.fn().mockResolvedValue(void 0),
      respond
    });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith({
      text: 'This channel is not allowed.',
      response_type: 'ephemeral'
    });
  });
  it('blocks unlisted channels when groupPolicy is allowlist', async () => {
    const { commands, ctx, account, channelId, channelName } = createHarness({
      groupPolicy: 'allowlist',
      channelsConfig: { C_LISTED: { requireMention: true } },
      channelId: 'C_UNLISTED',
      channelName: 'unlisted'
    });
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = [...commands.values()][0];
    if (!handler) {
      throw new Error('Missing slash handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      command: {
        user_id: 'U1',
        user_name: 'Ada',
        channel_id: channelId,
        channel_name: channelName,
        text: 'hello',
        trigger_id: 't1'
      },
      ack: vi.fn().mockResolvedValue(void 0),
      respond
    });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith({
      text: 'This channel is not allowed.',
      response_type: 'ephemeral'
    });
  });
});
describe('slack slash commands access groups', () => {
  it('fails closed when channel type lookup returns empty for channels', async () => {
    const { commands, ctx, account, channelId, channelName } = createHarness({
      allowFrom: [],
      channelId: 'C_UNKNOWN',
      channelName: 'unknown',
      resolveChannelName: /* @__PURE__ */ __name(async () => ({}), 'resolveChannelName')
    });
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = [...commands.values()][0];
    if (!handler) {
      throw new Error('Missing slash handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      command: {
        user_id: 'U1',
        user_name: 'Ada',
        channel_id: channelId,
        channel_name: channelName,
        text: 'hello',
        trigger_id: 't1'
      },
      ack: vi.fn().mockResolvedValue(void 0),
      respond
    });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith({
      text: 'You are not authorized to use this command.',
      response_type: 'ephemeral'
    });
  });
  it('still treats D-prefixed channel ids as DMs when lookup fails', async () => {
    const { commands, ctx, account } = createHarness({
      allowFrom: [],
      channelId: 'D123',
      channelName: 'notdirectmessage',
      resolveChannelName: /* @__PURE__ */ __name(async () => ({}), 'resolveChannelName')
    });
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = [...commands.values()][0];
    if (!handler) {
      throw new Error('Missing slash handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      command: {
        user_id: 'U1',
        user_name: 'Ada',
        channel_id: 'D123',
        channel_name: 'notdirectmessage',
        text: 'hello',
        trigger_id: 't1'
      },
      ack: vi.fn().mockResolvedValue(void 0),
      respond
    });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(respond).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: 'You are not authorized to use this command.' })
    );
  });
  it('enforces access-group gating when lookup fails for private channels', async () => {
    const { commands, ctx, account, channelId, channelName } = createHarness({
      allowFrom: [],
      channelId: 'G123',
      channelName: 'private',
      resolveChannelName: /* @__PURE__ */ __name(async () => ({}), 'resolveChannelName')
    });
    registerSlackMonitorSlashCommands({ ctx, account });
    const handler = [...commands.values()][0];
    if (!handler) {
      throw new Error('Missing slash handler');
    }
    const respond = vi.fn().mockResolvedValue(void 0);
    await handler({
      command: {
        user_id: 'U1',
        user_name: 'Ada',
        channel_id: channelId,
        channel_name: channelName,
        text: 'hello',
        trigger_id: 't1'
      },
      ack: vi.fn().mockResolvedValue(void 0),
      respond
    });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith({
      text: 'You are not authorized to use this command.',
      response_type: 'ephemeral'
    });
  });
});
