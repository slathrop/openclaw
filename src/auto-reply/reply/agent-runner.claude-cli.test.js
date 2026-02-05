import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { onAgentEvent } from '../../infra/agent-events.js';
import { createMockTypingController } from './test-helpers.js';
const runEmbeddedPiAgentMock = vi.fn();
const runCliAgentMock = vi.fn();
vi.mock('../../agents/model-fallback.js', () => ({
  runWithModelFallback: async ({
    provider,
    model,
    run
  }) => ({
    result: await run(provider, model),
    provider,
    model
  })
}));
vi.mock('../../agents/pi-embedded.js', () => ({
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: (params) => runEmbeddedPiAgentMock(params)
}));
vi.mock('../../agents/cli-runner.js', () => ({
  runCliAgent: (params) => runCliAgentMock(params)
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
function createRun() {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: 'webchat',
    OriginatingTo: 'session:1',
    AccountId: 'primary',
    MessageSid: 'msg'
  };
  const resolvedQueue = { mode: 'interrupt' };
  const followupRun = {
    prompt: 'hello',
    summaryLine: 'hello',
    enqueuedAt: Date.now(),
    run: {
      sessionId: 'session',
      sessionKey: 'main',
      messageProvider: 'webchat',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      config: {},
      skillsSnapshot: {},
      provider: 'claude-cli',
      model: 'opus-4.5',
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
    defaultModel: 'claude-cli/opus-4.5',
    resolvedVerboseLevel: 'off',
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: 'message_end',
    shouldInjectGroupIntro: false,
    typingMode: 'instant'
  });
}
describe('runReplyAgent claude-cli routing', () => {
  it('uses claude-cli runner for claude-cli provider', async () => {
    const randomSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('run-1');
    const lifecyclePhases = [];
    const unsubscribe = onAgentEvent((evt) => {
      if (evt.runId !== 'run-1') {
        return;
      }
      if (evt.stream !== 'lifecycle') {
        return;
      }
      const phase = evt.data?.phase;
      if (typeof phase === 'string') {
        lifecyclePhases.push(phase);
      }
    });
    runCliAgentMock.mockResolvedValueOnce({
      payloads: [{ text: 'ok' }],
      meta: {
        agentMeta: {
          provider: 'claude-cli',
          model: 'opus-4.5'
        }
      }
    });
    const result = await createRun();
    unsubscribe();
    randomSpy.mockRestore();
    expect(runCliAgentMock).toHaveBeenCalledTimes(1);
    expect(runEmbeddedPiAgentMock).not.toHaveBeenCalled();
    expect(lifecyclePhases).toEqual(['start', 'end']);
    expect(result).toMatchObject({ text: 'ok' });
  });
});
