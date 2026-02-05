import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MEMORY_FLUSH_PROMPT } from './memory-flush.js';
import { createMockTypingController } from './test-helpers.js';
const runEmbeddedPiAgentMock = vi.fn();
const runWithModelFallbackMock = vi.fn();
vi.mock('../../agents/model-fallback.js', () => ({
  runWithModelFallback: (params) => runWithModelFallbackMock(params)
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
function createRun(params) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: 'whatsapp',
    OriginatingTo: '+15550001111',
    AccountId: 'primary',
    MessageSid: 'msg'
  };
  const resolvedQueue = { mode: 'interrupt' };
  const sessionKey = params?.sessionKey ?? 'main';
  const followupRun = {
    prompt: 'hello',
    summaryLine: 'hello',
    enqueuedAt: Date.now(),
    run: {
      agentId: 'main',
      agentDir: '/tmp/agent',
      sessionId: 'session',
      sessionKey,
      messageProvider: 'whatsapp',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      config: {},
      skillsSnapshot: {},
      provider: 'anthropic',
      model: 'claude',
      thinkLevel: 'low',
      verboseLevel: 'off',
      elevatedLevel: 'off',
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: 'off'
      },
      timeoutMs: 1e3,
      blockReplyBreak: 'message_end'
    }
  };
  return runReplyAgent({
    commandBody: 'hello',
    followupRun,
    queueKey: 'main',
    resolvedQueue,
    shouldSteer: false,
    shouldFollowup: false,
    isActive: false,
    isStreaming: false,
    typing,
    sessionCtx,
    sessionEntry: params?.sessionEntry,
    sessionKey,
    defaultModel: 'anthropic/claude-opus-4-5',
    agentCfgContextTokens: params?.agentCfgContextTokens,
    resolvedVerboseLevel: 'off',
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: 'message_end',
    shouldInjectGroupIntro: false,
    typingMode: 'instant'
  });
}
describe('runReplyAgent fallback reasoning tags', () => {
  beforeEach(() => {
    runEmbeddedPiAgentMock.mockReset();
    runWithModelFallbackMock.mockReset();
  });
  it('enforces <final> when the fallback provider requires reasoning tags', async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: 'ok' }],
      meta: {}
    });
    runWithModelFallbackMock.mockImplementationOnce(
      async ({ run }) => ({
        result: await run('google-antigravity', 'gemini-3'),
        provider: 'google-antigravity',
        model: 'gemini-3'
      })
    );
    await createRun();
    const call = runEmbeddedPiAgentMock.mock.calls[0]?.[0];
    expect(call?.enforceFinalTag).toBe(true);
  });
  it('enforces <final> during memory flush on fallback providers', async () => {
    runEmbeddedPiAgentMock.mockImplementation(async (params) => {
      if (params.prompt === DEFAULT_MEMORY_FLUSH_PROMPT) {
        return { payloads: [], meta: {} };
      }
      return { payloads: [{ text: 'ok' }], meta: {} };
    });
    runWithModelFallbackMock.mockImplementation(
      async ({ run }) => ({
        result: await run('google-antigravity', 'gemini-3'),
        provider: 'google-antigravity',
        model: 'gemini-3'
      })
    );
    await createRun({
      sessionEntry: {
        sessionId: 'session',
        updatedAt: Date.now(),
        totalTokens: 1e6,
        compactionCount: 0
      }
    });
    const flushCall = runEmbeddedPiAgentMock.mock.calls.find(
      ([params]) => params?.prompt === DEFAULT_MEMORY_FLUSH_PROMPT
    )?.[0];
    expect(flushCall?.enforceFinalTag).toBe(true);
  });
});
