import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  deliverOutboundPayloads: vi.fn(async () => []),
  getChannelPlugin: vi.fn(() => ({})),
  resolveOutboundTarget: vi.fn(() => ({ ok: true, to: '+15551234567' }))
}));
vi.mock('../channels/plugins/index.js', () => ({
  getChannelPlugin: mocks.getChannelPlugin,
  normalizeChannelId: (value) => value
}));
vi.mock('../infra/outbound/deliver.js', () => ({
  deliverOutboundPayloads: mocks.deliverOutboundPayloads
}));
vi.mock('../infra/outbound/targets.js', async () => {
  const actual = await vi.importActual(
    '../infra/outbound/targets.js'
  );
  return {
    ...actual,
    resolveOutboundTarget: mocks.resolveOutboundTarget
  };
});
describe('deliverAgentCommandResult', () => {
  beforeEach(() => {
    mocks.deliverOutboundPayloads.mockClear();
    mocks.resolveOutboundTarget.mockClear();
  });
  it('prefers explicit accountId for outbound delivery', async () => {
    const cfg = {};
    const deps = {};
    const runtime = {
      log: vi.fn(),
      error: vi.fn()
    };
    const sessionEntry = {
      lastAccountId: 'default'
    };
    const result = {
      payloads: [{ text: 'hi' }],
      meta: {}
    };
    const { deliverAgentCommandResult } = await import('./agent/delivery.js');
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: 'hello',
        deliver: true,
        channel: 'whatsapp',
        accountId: 'kev',
        to: '+15551234567'
      },
      sessionEntry,
      result,
      payloads: result.payloads
    });
    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'kev' })
    );
  });
  it('falls back to session accountId for implicit delivery', async () => {
    const cfg = {};
    const deps = {};
    const runtime = {
      log: vi.fn(),
      error: vi.fn()
    };
    const sessionEntry = {
      lastAccountId: 'legacy',
      lastChannel: 'whatsapp'
    };
    const result = {
      payloads: [{ text: 'hi' }],
      meta: {}
    };
    const { deliverAgentCommandResult } = await import('./agent/delivery.js');
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: 'hello',
        deliver: true,
        channel: 'whatsapp'
      },
      sessionEntry,
      result,
      payloads: result.payloads
    });
    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'legacy' })
    );
  });
  it('does not infer accountId for explicit delivery targets', async () => {
    const cfg = {};
    const deps = {};
    const runtime = {
      log: vi.fn(),
      error: vi.fn()
    };
    const sessionEntry = {
      lastAccountId: 'legacy'
    };
    const result = {
      payloads: [{ text: 'hi' }],
      meta: {}
    };
    const { deliverAgentCommandResult } = await import('./agent/delivery.js');
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: 'hello',
        deliver: true,
        channel: 'whatsapp',
        to: '+15551234567',
        deliveryTargetMode: 'explicit'
      },
      sessionEntry,
      result,
      payloads: result.payloads
    });
    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: void 0, mode: 'explicit' })
    );
    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: void 0 })
    );
  });
  it('skips session accountId when channel differs', async () => {
    const cfg = {};
    const deps = {};
    const runtime = {
      log: vi.fn(),
      error: vi.fn()
    };
    const sessionEntry = {
      lastAccountId: 'legacy',
      lastChannel: 'telegram'
    };
    const result = {
      payloads: [{ text: 'hi' }],
      meta: {}
    };
    const { deliverAgentCommandResult } = await import('./agent/delivery.js');
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: 'hello',
        deliver: true,
        channel: 'whatsapp'
      },
      sessionEntry,
      result,
      payloads: result.payloads
    });
    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: void 0, channel: 'whatsapp' })
    );
  });
  it('uses session last channel when none is provided', async () => {
    const cfg = {};
    const deps = {};
    const runtime = {
      log: vi.fn(),
      error: vi.fn()
    };
    const sessionEntry = {
      lastChannel: 'telegram',
      lastTo: '123'
    };
    const result = {
      payloads: [{ text: 'hi' }],
      meta: {}
    };
    const { deliverAgentCommandResult } = await import('./agent/delivery.js');
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: 'hello',
        deliver: true
      },
      sessionEntry,
      result,
      payloads: result.payloads
    });
    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', to: '123' })
    );
  });
  it('uses reply overrides for delivery routing', async () => {
    const cfg = {};
    const deps = {};
    const runtime = {
      log: vi.fn(),
      error: vi.fn()
    };
    const sessionEntry = {
      lastChannel: 'telegram',
      lastTo: '123',
      lastAccountId: 'legacy'
    };
    const result = {
      payloads: [{ text: 'hi' }],
      meta: {}
    };
    const { deliverAgentCommandResult } = await import('./agent/delivery.js');
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: 'hello',
        deliver: true,
        to: '+15551234567',
        replyTo: '#reports',
        replyChannel: 'slack',
        replyAccountId: 'ops'
      },
      sessionEntry,
      result,
      payloads: result.payloads
    });
    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'slack', to: '#reports', accountId: 'ops' })
    );
  });
  it('prefixes nested agent outputs with context', async () => {
    const cfg = {};
    const deps = {};
    const runtime = {
      log: vi.fn(),
      error: vi.fn()
    };
    const result = {
      payloads: [{ text: 'ANNOUNCE_SKIP' }],
      meta: {}
    };
    const { deliverAgentCommandResult } = await import('./agent/delivery.js');
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: 'hello',
        deliver: false,
        lane: 'nested',
        sessionKey: 'agent:main:main',
        runId: 'run-announce',
        messageChannel: 'webchat'
      },
      sessionEntry: void 0,
      result,
      payloads: result.payloads
    });
    expect(runtime.log).toHaveBeenCalledTimes(1);
    const line = String(runtime.log.mock.calls[0]?.[0]);
    expect(line).toContain('[agent:nested]');
    expect(line).toContain('session=agent:main:main');
    expect(line).toContain('run=run-announce');
    expect(line).toContain('channel=webchat');
    expect(line).toContain('ANNOUNCE_SKIP');
  });
});
