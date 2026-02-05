import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import './test-helpers/fast-coding-tools.js';
import { ensureOpenClawModelsJson } from './models-config.js';
vi.mock('@mariozechner/pi-ai', async () => {
  const actual = await vi.importActual('@mariozechner/pi-ai');
  const buildAssistantMessage = (model) => ({
    role: 'assistant',
    content: [{ type: 'text', text: 'ok' }],
    stopReason: 'stop',
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      }
    },
    timestamp: Date.now()
  });
  const buildAssistantErrorMessage = (model) => ({
    role: 'assistant',
    content: [],
    stopReason: 'error',
    errorMessage: 'boom',
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      }
    },
    timestamp: Date.now()
  });
  return {
    ...actual,
    complete: async (model) => {
      if (model.id === 'mock-error') {
        return buildAssistantErrorMessage(model);
      }
      return buildAssistantMessage(model);
    },
    completeSimple: async (model) => {
      if (model.id === 'mock-error') {
        return buildAssistantErrorMessage(model);
      }
      return buildAssistantMessage(model);
    },
    streamSimple: (model) => {
      const stream = new actual.AssistantMessageEventStream();
      queueMicrotask(() => {
        stream.push({
          type: 'done',
          reason: 'stop',
          message: model.id === 'mock-error' ? buildAssistantErrorMessage(model) : buildAssistantMessage(model)
        });
        stream.end();
      });
      return stream;
    }
  };
});
let runEmbeddedPiAgent;
let tempRoot;
let agentDir;
let workspaceDir;
let sessionCounter = 0;
beforeAll(async () => {
  vi.useRealTimers();
  ({ runEmbeddedPiAgent } = await import('./pi-embedded-runner.js'));
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-embedded-agent-'));
  agentDir = path.join(tempRoot, 'agent');
  workspaceDir = path.join(tempRoot, 'workspace');
  await fs.mkdir(agentDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });
}, 2e4);
afterAll(async () => {
  if (!tempRoot) {
    return;
  }
  await fs.rm(tempRoot, { recursive: true, force: true });
  tempRoot = void 0;
});
const makeOpenAiConfig = (modelIds) => ({
  models: {
    providers: {
      openai: {
        api: 'openai-responses',
        apiKey: 'sk-test',
        baseUrl: 'https://example.com',
        models: modelIds.map((id) => ({
          id,
          name: `Mock ${id}`,
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 16e3,
          maxTokens: 2048
        }))
      }
    }
  }
});
const ensureModels = (cfg) => ensureOpenClawModelsJson(cfg, agentDir);
const nextSessionFile = () => {
  sessionCounter += 1;
  return path.join(workspaceDir, `session-${sessionCounter}.jsonl`);
};
const testSessionKey = 'agent:test:embedded';
const immediateEnqueue = async (task) => task();
const textFromContent = (content) => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content) && content[0]?.type === 'text') {
    return content[0].text;
  }
  return void 0;
};
const readSessionMessages = async (sessionFile) => {
  const raw = await fs.readFile(sessionFile, 'utf-8');
  return raw.split(/\r?\n/).filter(Boolean).map(
    (line) => JSON.parse(line)
  ).filter((entry) => entry.type === 'message').map((entry) => entry.message);
};
describe('runEmbeddedPiAgent', () => {
  const itIfNotWin32 = process.platform === 'win32' ? it.skip : it;
  it('writes models.json into the provided agentDir', async () => {
    const sessionFile = nextSessionFile();
    const cfg = {
      models: {
        providers: {
          minimax: {
            baseUrl: 'https://api.minimax.io/anthropic',
            api: 'anthropic-messages',
            apiKey: 'sk-minimax-test',
            models: [
              {
                id: 'MiniMax-M2.1',
                name: 'MiniMax M2.1',
                reasoning: false,
                input: ['text'],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 2e5,
                maxTokens: 8192
              }
            ]
          }
        }
      }
    };
    await expect(
      runEmbeddedPiAgent({
        sessionId: 'session:test',
        sessionKey: testSessionKey,
        sessionFile,
        workspaceDir,
        config: cfg,
        prompt: 'hi',
        provider: 'definitely-not-a-provider',
        model: 'definitely-not-a-model',
        timeoutMs: 1,
        agentDir,
        enqueue: immediateEnqueue
      })
    ).rejects.toThrow(/Unknown model:/);
    await expect(fs.stat(path.join(agentDir, 'models.json'))).resolves.toBeTruthy();
  });
  itIfNotWin32(
    'persists the first user message before assistant output',
    { timeout: 12e4 },
    async () => {
      const sessionFile = nextSessionFile();
      const cfg = makeOpenAiConfig(['mock-1']);
      await ensureModels(cfg);
      await runEmbeddedPiAgent({
        sessionId: 'session:test',
        sessionKey: testSessionKey,
        sessionFile,
        workspaceDir,
        config: cfg,
        prompt: 'hello',
        provider: 'openai',
        model: 'mock-1',
        timeoutMs: 5e3,
        agentDir,
        enqueue: immediateEnqueue
      });
      const messages = await readSessionMessages(sessionFile);
      const firstUserIndex = messages.findIndex(
        (message) => message?.role === 'user' && textFromContent(message.content) === 'hello'
      );
      const firstAssistantIndex = messages.findIndex((message) => message?.role === 'assistant');
      expect(firstUserIndex).toBeGreaterThanOrEqual(0);
      if (firstAssistantIndex !== -1) {
        expect(firstUserIndex).toBeLessThan(firstAssistantIndex);
      }
    }
  );
  it('persists the user message when prompt fails before assistant output', async () => {
    const sessionFile = nextSessionFile();
    const cfg = makeOpenAiConfig(['mock-error']);
    await ensureModels(cfg);
    const result = await runEmbeddedPiAgent({
      sessionId: 'session:test',
      sessionKey: testSessionKey,
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: 'boom',
      provider: 'openai',
      model: 'mock-error',
      timeoutMs: 5e3,
      agentDir,
      enqueue: immediateEnqueue
    });
    expect(result.payloads[0]?.isError).toBe(true);
    const messages = await readSessionMessages(sessionFile);
    const userIndex = messages.findIndex(
      (message) => message?.role === 'user' && textFromContent(message.content) === 'boom'
    );
    expect(userIndex).toBeGreaterThanOrEqual(0);
  });
  it(
    'appends new user + assistant after existing transcript entries',
    { timeout: 9e4 },
    async () => {
      const { SessionManager } = await import('@mariozechner/pi-coding-agent');
      const sessionFile = nextSessionFile();
      const sessionManager = SessionManager.open(sessionFile);
      sessionManager.appendMessage({
        role: 'user',
        content: [{ type: 'text', text: 'seed user' }]
      });
      sessionManager.appendMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'seed assistant' }],
        stopReason: 'stop',
        api: 'openai-responses',
        provider: 'openai',
        model: 'mock-1',
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0
          }
        },
        timestamp: Date.now()
      });
      const cfg = makeOpenAiConfig(['mock-1']);
      await ensureModels(cfg);
      await runEmbeddedPiAgent({
        sessionId: 'session:test',
        sessionKey: testSessionKey,
        sessionFile,
        workspaceDir,
        config: cfg,
        prompt: 'hello',
        provider: 'openai',
        model: 'mock-1',
        timeoutMs: 5e3,
        agentDir,
        enqueue: immediateEnqueue
      });
      const messages = await readSessionMessages(sessionFile);
      const seedUserIndex = messages.findIndex(
        (message) => message?.role === 'user' && textFromContent(message.content) === 'seed user'
      );
      const seedAssistantIndex = messages.findIndex(
        (message) => message?.role === 'assistant' && textFromContent(message.content) === 'seed assistant'
      );
      const newUserIndex = messages.findIndex(
        (message) => message?.role === 'user' && textFromContent(message.content) === 'hello'
      );
      const newAssistantIndex = messages.findIndex(
        (message, index) => index > newUserIndex && message?.role === 'assistant'
      );
      expect(seedUserIndex).toBeGreaterThanOrEqual(0);
      expect(seedAssistantIndex).toBeGreaterThan(seedUserIndex);
      expect(newUserIndex).toBeGreaterThan(seedAssistantIndex);
      expect(newAssistantIndex).toBeGreaterThan(newUserIndex);
    }
  );
  it('persists multi-turn user/assistant ordering across runs', async () => {
    const sessionFile = nextSessionFile();
    const cfg = makeOpenAiConfig(['mock-1']);
    await ensureModels(cfg);
    await runEmbeddedPiAgent({
      sessionId: 'session:test',
      sessionKey: testSessionKey,
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: 'first',
      provider: 'openai',
      model: 'mock-1',
      timeoutMs: 5e3,
      agentDir,
      enqueue: immediateEnqueue
    });
    await runEmbeddedPiAgent({
      sessionId: 'session:test',
      sessionKey: testSessionKey,
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: 'second',
      provider: 'openai',
      model: 'mock-1',
      timeoutMs: 5e3,
      agentDir,
      enqueue: immediateEnqueue
    });
    const messages = await readSessionMessages(sessionFile);
    const firstUserIndex = messages.findIndex(
      (message) => message?.role === 'user' && textFromContent(message.content) === 'first'
    );
    const firstAssistantIndex = messages.findIndex(
      (message, index) => index > firstUserIndex && message?.role === 'assistant'
    );
    const secondUserIndex = messages.findIndex(
      (message, index) => index > firstAssistantIndex && message?.role === 'user' && textFromContent(message.content) === 'second'
    );
    const secondAssistantIndex = messages.findIndex(
      (message, index) => index > secondUserIndex && message?.role === 'assistant'
    );
    expect(firstUserIndex).toBeGreaterThanOrEqual(0);
    expect(firstAssistantIndex).toBeGreaterThan(firstUserIndex);
    expect(secondUserIndex).toBeGreaterThan(firstAssistantIndex);
    expect(secondAssistantIndex).toBeGreaterThan(secondUserIndex);
  });
  it('repairs orphaned user messages and continues', async () => {
    const { SessionManager } = await import('@mariozechner/pi-coding-agent');
    const sessionFile = nextSessionFile();
    const sessionManager = SessionManager.open(sessionFile);
    sessionManager.appendMessage({
      role: 'user',
      content: [{ type: 'text', text: 'orphaned user' }]
    });
    const cfg = makeOpenAiConfig(['mock-1']);
    await ensureModels(cfg);
    const result = await runEmbeddedPiAgent({
      sessionId: 'session:test',
      sessionKey: testSessionKey,
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: 'hello',
      provider: 'openai',
      model: 'mock-1',
      timeoutMs: 5e3,
      agentDir,
      enqueue: immediateEnqueue
    });
    expect(result.meta.error).toBeUndefined();
    expect(result.payloads?.length ?? 0).toBeGreaterThan(0);
  });
  it('repairs orphaned single-user sessions and continues', async () => {
    const { SessionManager } = await import('@mariozechner/pi-coding-agent');
    const sessionFile = nextSessionFile();
    const sessionManager = SessionManager.open(sessionFile);
    sessionManager.appendMessage({
      role: 'user',
      content: [{ type: 'text', text: 'solo user' }]
    });
    const cfg = makeOpenAiConfig(['mock-1']);
    await ensureModels(cfg);
    const result = await runEmbeddedPiAgent({
      sessionId: 'session:test',
      sessionKey: testSessionKey,
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: 'hello',
      provider: 'openai',
      model: 'mock-1',
      timeoutMs: 5e3,
      agentDir,
      enqueue: immediateEnqueue
    });
    expect(result.meta.error).toBeUndefined();
    expect(result.payloads?.length ?? 0).toBeGreaterThan(0);
  });
});
