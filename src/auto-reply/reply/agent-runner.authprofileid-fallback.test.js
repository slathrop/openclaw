import { describe, expect, it, vi } from 'vitest';
import { createMockTypingController } from './test-helpers.js';
const runEmbeddedPiAgentMock = vi.fn();
vi.mock('../../agents/model-fallback.js', () => ({
  runWithModelFallback: async ({
    run
  }) => ({
    // Force a cross-provider fallback candidate
    result: await run('openai-codex', 'gpt-5.2'),
    provider: 'openai-codex',
    model: 'gpt-5.2'
  })
}));
vi.mock('../../agents/pi-embedded.js', () => ({
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: (params) => runEmbeddedPiAgentMock(params)
}));
vi.mock('./queue.js', async () => {
  const actual = await vi.importActual('./queue.js');
  return {
    ...actual,
    enqueueFollowupRun: vi.fn(),
    scheduleFollowupDrain: vi.fn()
  };
});
import { runReplyAgent } from './agent-runner.js';
function createBaseRun(params) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: 'telegram',
    OriginatingTo: 'chat',
    AccountId: 'primary',
    MessageSid: 'msg',
    Surface: 'telegram'
  };
  const resolvedQueue = { mode: 'interrupt' };
  const followupRun = {
    prompt: 'hello',
    summaryLine: 'hello',
    enqueuedAt: Date.now(),
    run: {
      agentId: 'main',
      agentDir: '/tmp/agent',
      sessionId: 'session',
      sessionKey: 'main',
      messageProvider: 'telegram',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      config: {},
      skillsSnapshot: {},
      provider: 'anthropic',
      model: 'claude-opus',
      authProfileId: 'anthropic:openclaw',
      authProfileIdSource: 'manual',
      thinkLevel: 'low',
      verboseLevel: 'off',
      elevatedLevel: 'off',
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: 'off'
      },
      timeoutMs: 5e3,
      blockReplyBreak: 'message_end'
    }
  };
  return {
    typing,
    sessionCtx,
    resolvedQueue,
    followupRun: {
      ...followupRun,
      run: { ...followupRun.run, ...params.runOverrides }
    }
  };
}
describe('authProfileId fallback scoping', () => {
  it('drops authProfileId when provider changes during fallback', async () => {
    runEmbeddedPiAgentMock.mockReset();
    runEmbeddedPiAgentMock.mockResolvedValue({ payloads: [{ text: 'ok' }], meta: {} });
    const sessionKey = 'main';
    const sessionEntry = {
      sessionId: 'session',
      updatedAt: Date.now(),
      totalTokens: 1,
      compactionCount: 0
    };
    const { typing, sessionCtx, resolvedQueue, followupRun } = createBaseRun({
      runOverrides: {
        provider: 'anthropic',
        model: 'claude-opus',
        authProfileId: 'anthropic:openclaw',
        authProfileIdSource: 'manual'
      }
    });
    await runReplyAgent({
      commandBody: 'hello',
      followupRun,
      queueKey: sessionKey,
      resolvedQueue,
      shouldSteer: false,
      shouldFollowup: false,
      isActive: false,
      isStreaming: false,
      typing,
      sessionCtx,
      sessionEntry,
      sessionStore: { [sessionKey]: sessionEntry },
      sessionKey,
      storePath: void 0,
      defaultModel: 'anthropic/claude-opus-4-5',
      agentCfgContextTokens: 1e5,
      resolvedVerboseLevel: 'off',
      isNewSession: false,
      blockStreamingEnabled: false,
      resolvedBlockStreamingBreak: 'message_end',
      shouldInjectGroupIntro: false,
      typingMode: 'instant'
    });
    expect(runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
    const call = runEmbeddedPiAgentMock.mock.calls[0]?.[0];
    expect(call.provider).toBe('openai-codex');
    expect(call.authProfileId).toBeUndefined();
    expect(call.authProfileIdSource).toBeUndefined();
  });
});
