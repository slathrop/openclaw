import { describe, expect, it, vi } from 'vitest';
import { agentHandlers } from './agent.js';
const mocks = vi.hoisted(() => ({
  loadSessionEntry: vi.fn(),
  updateSessionStore: vi.fn(),
  agentCommand: vi.fn(),
  registerAgentRunContext: vi.fn(),
  loadConfigReturn: {}
}));
vi.mock('../session-utils.js', () => ({
  loadSessionEntry: mocks.loadSessionEntry
}));
vi.mock('../../config/sessions.js', async () => {
  const actual = await vi.importActual(
    '../../config/sessions.js'
  );
  return {
    ...actual,
    updateSessionStore: mocks.updateSessionStore,
    resolveAgentIdFromSessionKey: () => 'main',
    resolveExplicitAgentSessionKey: () => void 0,
    resolveAgentMainSessionKey: () => 'agent:main:main'
  };
});
vi.mock('../../commands/agent.js', () => ({
  agentCommand: mocks.agentCommand
}));
vi.mock('../../config/config.js', () => ({
  loadConfig: () => mocks.loadConfigReturn
}));
vi.mock('../../agents/agent-scope.js', () => ({
  listAgentIds: () => ['main']
}));
vi.mock('../../infra/agent-events.js', () => ({
  registerAgentRunContext: mocks.registerAgentRunContext,
  onAgentEvent: vi.fn()
}));
vi.mock('../../sessions/send-policy.js', () => ({
  resolveSendPolicy: () => 'allow'
}));
vi.mock('../../utils/delivery-context.js', async () => {
  const actual = await vi.importActual(
    '../../utils/delivery-context.js'
  );
  return {
    ...actual,
    normalizeSessionDeliveryFields: () => ({})
  };
});
const makeContext = () => ({
  dedupe: /* @__PURE__ */ new Map(),
  addChatRun: vi.fn(),
  logGateway: { info: vi.fn(), error: vi.fn() }
});
describe('gateway agent handler', () => {
  it('preserves cliSessionIds from existing session entry', async () => {
    const existingCliSessionIds = { 'claude-cli': 'abc-123-def' };
    const existingClaudeCliSessionId = 'abc-123-def';
    mocks.loadSessionEntry.mockReturnValue({
      cfg: {},
      storePath: '/tmp/sessions.json',
      entry: {
        sessionId: 'existing-session-id',
        updatedAt: Date.now(),
        cliSessionIds: existingCliSessionIds,
        claudeCliSessionId: existingClaudeCliSessionId
      },
      canonicalKey: 'agent:main:main'
    });
    let capturedEntry;
    mocks.updateSessionStore.mockImplementation(async (_path, updater) => {
      const store = {};
      await updater(store);
      capturedEntry = store['agent:main:main'];
    });
    mocks.agentCommand.mockResolvedValue({
      payloads: [{ text: 'ok' }],
      meta: { durationMs: 100 }
    });
    const respond = vi.fn();
    await agentHandlers.agent({
      params: {
        message: 'test',
        agentId: 'main',
        sessionKey: 'agent:main:main',
        idempotencyKey: 'test-idem'
      },
      respond,
      context: makeContext(),
      req: { type: 'req', id: '1', method: 'agent' },
      client: null,
      isWebchatConnect: () => false
    });
    expect(mocks.updateSessionStore).toHaveBeenCalled();
    expect(capturedEntry).toBeDefined();
    expect(capturedEntry?.cliSessionIds).toEqual(existingCliSessionIds);
    expect(capturedEntry?.claudeCliSessionId).toBe(existingClaudeCliSessionId);
  });
  it('injects a timestamp into the message passed to agentCommand', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(/* @__PURE__ */ new Date('2026-01-29T01:30:00.000Z'));
    mocks.agentCommand.mockReset();
    mocks.loadConfigReturn = {
      agents: {
        defaults: {
          userTimezone: 'America/New_York'
        }
      }
    };
    mocks.loadSessionEntry.mockReturnValue({
      cfg: mocks.loadConfigReturn,
      storePath: '/tmp/sessions.json',
      entry: {
        sessionId: 'existing-session-id',
        updatedAt: Date.now()
      },
      canonicalKey: 'agent:main:main'
    });
    mocks.updateSessionStore.mockResolvedValue(void 0);
    mocks.agentCommand.mockResolvedValue({
      payloads: [{ text: 'ok' }],
      meta: { durationMs: 100 }
    });
    const respond = vi.fn();
    await agentHandlers.agent({
      params: {
        message: 'Is it the weekend?',
        agentId: 'main',
        sessionKey: 'agent:main:main',
        idempotencyKey: 'test-timestamp-inject'
      },
      respond,
      context: makeContext(),
      req: { type: 'req', id: 'ts-1', method: 'agent' },
      client: null,
      isWebchatConnect: () => false
    });
    await vi.waitFor(() => expect(mocks.agentCommand).toHaveBeenCalled());
    const callArgs = mocks.agentCommand.mock.calls[0][0];
    expect(callArgs.message).toBe('[Wed 2026-01-28 20:30 EST] Is it the weekend?');
    mocks.loadConfigReturn = {};
    vi.useRealTimers();
  });
  it('handles missing cliSessionIds gracefully', async () => {
    mocks.loadSessionEntry.mockReturnValue({
      cfg: {},
      storePath: '/tmp/sessions.json',
      entry: {
        sessionId: 'existing-session-id',
        updatedAt: Date.now()
        // No cliSessionIds or claudeCliSessionId
      },
      canonicalKey: 'agent:main:main'
    });
    let capturedEntry;
    mocks.updateSessionStore.mockImplementation(async (_path, updater) => {
      const store = {};
      await updater(store);
      capturedEntry = store['agent:main:main'];
    });
    mocks.agentCommand.mockResolvedValue({
      payloads: [{ text: 'ok' }],
      meta: { durationMs: 100 }
    });
    const respond = vi.fn();
    await agentHandlers.agent({
      params: {
        message: 'test',
        agentId: 'main',
        sessionKey: 'agent:main:main',
        idempotencyKey: 'test-idem-2'
      },
      respond,
      context: makeContext(),
      req: { type: 'req', id: '2', method: 'agent' },
      client: null,
      isWebchatConnect: () => false
    });
    expect(mocks.updateSessionStore).toHaveBeenCalled();
    expect(capturedEntry).toBeDefined();
    expect(capturedEntry?.cliSessionIds).toBeUndefined();
    expect(capturedEntry?.claudeCliSessionId).toBeUndefined();
  });
});
