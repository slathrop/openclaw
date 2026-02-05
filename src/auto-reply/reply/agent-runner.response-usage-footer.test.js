import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  const sessionEntry = {
    sessionId: 'session',
    updatedAt: Date.now(),
    responseUsage: params.responseUsage
  };
  const followupRun = {
    prompt: 'hello',
    summaryLine: 'hello',
    enqueuedAt: Date.now(),
    run: {
      agentId: 'main',
      agentDir: '/tmp/agent',
      sessionId: 'session',
      sessionKey: params.sessionKey,
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
    sessionEntry,
    sessionKey: params.sessionKey,
    defaultModel: 'anthropic/claude-opus-4-5',
    resolvedVerboseLevel: 'off',
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: 'message_end',
    shouldInjectGroupIntro: false,
    typingMode: 'instant'
  });
}
describe('runReplyAgent response usage footer', () => {
  beforeEach(() => {
    runEmbeddedPiAgentMock.mockReset();
    runWithModelFallbackMock.mockReset();
  });
  it('appends session key when responseUsage=full', async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: 'ok' }],
      meta: {
        agentMeta: {
          provider: 'anthropic',
          model: 'claude',
          usage: { input: 12, output: 3 }
        }
      }
    });
    runWithModelFallbackMock.mockImplementationOnce(
      async ({ run }) => ({
        result: await run('anthropic', 'claude'),
        provider: 'anthropic',
        model: 'claude'
      })
    );
    const sessionKey = 'agent:main:whatsapp:dm:+1000';
    const res = await createRun({ responseUsage: 'full', sessionKey });
    const payload = Array.isArray(res) ? res[0] : res;
    expect(String(payload?.text ?? '')).toContain('Usage:');
    expect(String(payload?.text ?? '')).toContain(`\xB7 session ${sessionKey}`);
  });
  it('does not append session key when responseUsage=tokens', async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: 'ok' }],
      meta: {
        agentMeta: {
          provider: 'anthropic',
          model: 'claude',
          usage: { input: 12, output: 3 }
        }
      }
    });
    runWithModelFallbackMock.mockImplementationOnce(
      async ({ run }) => ({
        result: await run('anthropic', 'claude'),
        provider: 'anthropic',
        model: 'claude'
      })
    );
    const sessionKey = 'agent:main:whatsapp:dm:+1000';
    const res = await createRun({ responseUsage: 'tokens', sessionKey });
    const payload = Array.isArray(res) ? res[0] : res;
    expect(String(payload?.text ?? '')).toContain('Usage:');
    expect(String(payload?.text ?? '')).not.toContain('\xB7 session ');
  });
});
