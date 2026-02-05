const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { describe, expect, it, vi } from 'vitest';
import { prepareSlackMessage } from './prepare.js';
describe('prepareSlackMessage sender prefix', () => {
  it('prefixes channel bodies with sender label', async () => {
    const ctx = {
      cfg: {
        agents: { defaults: { model: 'anthropic/claude-opus-4-5', workspace: '/tmp/openclaw' } },
        channels: { slack: {} }
      },
      accountId: 'default',
      botToken: 'xoxb',
      app: { client: {} },
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
        exit: /* @__PURE__ */ __name((code) => {
          throw new Error(`exit ${code}`);
        }, 'exit')
      },
      botUserId: 'BOT',
      teamId: 'T1',
      apiAppId: 'A1',
      historyLimit: 0,
      channelHistories: /* @__PURE__ */ new Map(),
      sessionScope: 'per-sender',
      mainKey: 'agent:main:main',
      dmEnabled: true,
      dmPolicy: 'open',
      allowFrom: [],
      groupDmEnabled: false,
      groupDmChannels: [],
      defaultRequireMention: true,
      groupPolicy: 'open',
      useAccessGroups: false,
      reactionMode: 'off',
      reactionAllowlist: [],
      replyToMode: 'off',
      threadHistoryScope: 'channel',
      threadInheritParent: false,
      slashCommand: { command: '/openclaw', enabled: true },
      textLimit: 2e3,
      ackReactionScope: 'off',
      mediaMaxBytes: 1e3,
      removeAckAfterReply: false,
      logger: { info: vi.fn() },
      markMessageSeen: /* @__PURE__ */ __name(() => false, 'markMessageSeen'),
      shouldDropMismatchedSlackEvent: /* @__PURE__ */ __name(() => false, 'shouldDropMismatchedSlackEvent'),
      resolveSlackSystemEventSessionKey: /* @__PURE__ */ __name(() => 'agent:main:slack:channel:c1', 'resolveSlackSystemEventSessionKey'),
      isChannelAllowed: /* @__PURE__ */ __name(() => true, 'isChannelAllowed'),
      resolveChannelName: /* @__PURE__ */ __name(async () => ({
        name: 'general',
        type: 'channel'
      }), 'resolveChannelName'),
      resolveUserName: /* @__PURE__ */ __name(async () => ({ name: 'Alice' }), 'resolveUserName'),
      setSlackThreadStatus: /* @__PURE__ */ __name(async () => void 0, 'setSlackThreadStatus')
    };
    const result = await prepareSlackMessage({
      ctx,
      account: { accountId: 'default', config: {} },
      message: {
        type: 'message',
        channel: 'C1',
        channel_type: 'channel',
        text: '<@BOT> hello',
        user: 'U1',
        ts: '1700000000.0001',
        event_ts: '1700000000.0001'
      },
      opts: { source: 'message', wasMentioned: true }
    });
    expect(result).not.toBeNull();
    const body = result?.ctxPayload.Body ?? '';
    expect(body).toContain('Alice (U1): <@BOT> hello');
  });
});
