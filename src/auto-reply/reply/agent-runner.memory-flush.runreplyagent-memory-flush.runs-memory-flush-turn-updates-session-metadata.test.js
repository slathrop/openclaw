import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MEMORY_FLUSH_PROMPT } from './memory-flush.js';
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
vi.mock('../../agents/cli-runner.js', () => ({
  runCliAgent: (params) => runCliAgentMock(params)
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
async function seedSessionStore(params) {
  await fs.mkdir(path.dirname(params.storePath), { recursive: true });
  await fs.writeFile(
    params.storePath,
    JSON.stringify({ [params.sessionKey]: params.entry }, null, 2),
    'utf-8'
  );
}
function createBaseRun(params) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: 'whatsapp',
    OriginatingTo: '+15550001111',
    AccountId: 'primary',
    MessageSid: 'msg'
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
      messageProvider: 'whatsapp',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      config: params.config ?? {},
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
  const run = {
    ...followupRun.run,
    ...params.runOverrides,
    config: params.config ?? followupRun.run.config
  };
  return {
    typing,
    sessionCtx,
    resolvedQueue,
    followupRun: { ...followupRun, run }
  };
}
describe('runReplyAgent memory flush', () => {
  it('runs a memory flush turn and updates session metadata', async () => {
    runEmbeddedPiAgentMock.mockReset();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-flush-'));
    const storePath = path.join(tmp, 'sessions.json');
    const sessionKey = 'main';
    const sessionEntry = {
      sessionId: 'session',
      updatedAt: Date.now(),
      totalTokens: 8e4,
      compactionCount: 1
    };
    await seedSessionStore({ storePath, sessionKey, entry: sessionEntry });
    const calls = [];
    runEmbeddedPiAgentMock.mockImplementation(async (params) => {
      calls.push({ prompt: params.prompt });
      if (params.prompt === DEFAULT_MEMORY_FLUSH_PROMPT) {
        return { payloads: [], meta: {} };
      }
      return {
        payloads: [{ text: 'ok' }],
        meta: { agentMeta: { usage: { input: 1, output: 1 } } }
      };
    });
    const { typing, sessionCtx, resolvedQueue, followupRun } = createBaseRun({
      storePath,
      sessionEntry
    });
    await runReplyAgent({
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
      sessionStore: { [sessionKey]: sessionEntry },
      sessionKey,
      storePath,
      defaultModel: 'anthropic/claude-opus-4-5',
      agentCfgContextTokens: 1e5,
      resolvedVerboseLevel: 'off',
      isNewSession: false,
      blockStreamingEnabled: false,
      resolvedBlockStreamingBreak: 'message_end',
      shouldInjectGroupIntro: false,
      typingMode: 'instant'
    });
    expect(calls.map((call) => call.prompt)).toEqual([DEFAULT_MEMORY_FLUSH_PROMPT, 'hello']);
    const stored = JSON.parse(await fs.readFile(storePath, 'utf-8'));
    expect(stored[sessionKey].memoryFlushAt).toBeTypeOf('number');
    expect(stored[sessionKey].memoryFlushCompactionCount).toBe(1);
  });
  it('skips memory flush when disabled in config', async () => {
    runEmbeddedPiAgentMock.mockReset();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-flush-'));
    const storePath = path.join(tmp, 'sessions.json');
    const sessionKey = 'main';
    const sessionEntry = {
      sessionId: 'session',
      updatedAt: Date.now(),
      totalTokens: 8e4,
      compactionCount: 1
    };
    await seedSessionStore({ storePath, sessionKey, entry: sessionEntry });
    // eslint-disable-next-line no-unused-vars
    runEmbeddedPiAgentMock.mockImplementation(async (_params) => ({
      payloads: [{ text: 'ok' }],
      meta: { agentMeta: { usage: { input: 1, output: 1 } } }
    }));
    const { typing, sessionCtx, resolvedQueue, followupRun } = createBaseRun({
      storePath,
      sessionEntry,
      config: {
        agents: {
          defaults: { compaction: { memoryFlush: { enabled: false } } }
        }
      }
    });
    await runReplyAgent({
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
      sessionStore: { [sessionKey]: sessionEntry },
      sessionKey,
      storePath,
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
    expect(call?.prompt).toBe('hello');
    const stored = JSON.parse(await fs.readFile(storePath, 'utf-8'));
    expect(stored[sessionKey].memoryFlushAt).toBeUndefined();
  });
});
