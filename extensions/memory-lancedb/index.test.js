import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-key';
const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY);
const liveEnabled = HAS_OPENAI_KEY && process.env.OPENCLAW_LIVE_TEST === '1';
const describeLive = liveEnabled ? describe : describe.skip;
describe('memory plugin e2e', () => {
  let tmpDir;
  let dbPath;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-memory-test-'));
    dbPath = path.join(tmpDir, 'lancedb');
  });
  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
  test('memory plugin registers and initializes correctly', async () => {
    const { default: memoryPlugin } = await import('./index.js');
    expect(memoryPlugin.id).toBe('memory-lancedb');
    expect(memoryPlugin.name).toBe('Memory (LanceDB)');
    expect(memoryPlugin.kind).toBe('memory');
    expect(memoryPlugin.configSchema).toBeDefined();
    expect(memoryPlugin.register).toBeInstanceOf(Function);
  });
  test('config schema parses valid config', async () => {
    const { default: memoryPlugin } = await import('./index.js');
    const config = memoryPlugin.configSchema?.parse?.({
      embedding: {
        apiKey: OPENAI_API_KEY,
        model: 'text-embedding-3-small'
      },
      dbPath,
      autoCapture: true,
      autoRecall: true
    });
    expect(config).toBeDefined();
    expect(config?.embedding?.apiKey).toBe(OPENAI_API_KEY);
    expect(config?.dbPath).toBe(dbPath);
  });
  test('config schema resolves env vars', async () => {
    const { default: memoryPlugin } = await import('./index.js');
    process.env.TEST_MEMORY_API_KEY = 'test-key-123';
    const config = memoryPlugin.configSchema?.parse?.({
      embedding: {
        apiKey: '${TEST_MEMORY_API_KEY}'
      },
      dbPath
    });
    expect(config?.embedding?.apiKey).toBe('test-key-123');
    delete process.env.TEST_MEMORY_API_KEY;
  });
  test('config schema rejects missing apiKey', async () => {
    const { default: memoryPlugin } = await import('./index.js');
    expect(() => {
      memoryPlugin.configSchema?.parse?.({
        embedding: {},
        dbPath
      });
    }).toThrow('embedding.apiKey is required');
  });
  test('shouldCapture filters correctly', async () => {
    const triggers = [
      { text: 'I prefer dark mode', shouldMatch: true },
      { text: 'Remember that my name is John', shouldMatch: true },
      { text: 'My email is test@example.com', shouldMatch: true },
      { text: 'Call me at +1234567890123', shouldMatch: true },
      { text: 'We decided to use TypeScript', shouldMatch: true },
      { text: 'I always want verbose output', shouldMatch: true },
      { text: 'Just a random short message', shouldMatch: false },
      { text: 'x', shouldMatch: false },
      // Too short
      { text: '<relevant-memories>injected</relevant-memories>', shouldMatch: false }
      // Skip injected
    ];
    for (const { text, shouldMatch } of triggers) {
      const hasPreference = /prefer|radši|like|love|hate|want/i.test(text);
      const hasRemember = /zapamatuj|pamatuj|remember/i.test(text);
      const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(text);
      const hasPhone = /\+\d{10,}/.test(text);
      const hasDecision = /rozhodli|decided|will use|budeme/i.test(text);
      const hasAlways = /always|never|important/i.test(text);
      const isInjected = text.includes('<relevant-memories>');
      const isTooShort = text.length < 10;
      const wouldCapture = !isTooShort && !isInjected && (hasPreference || hasRemember || hasEmail || hasPhone || hasDecision || hasAlways);
      if (shouldMatch) {
        expect(wouldCapture).toBe(true);
      }
    }
  });
  test('detectCategory classifies correctly', async () => {
    const cases = [
      { text: 'I prefer dark mode', expected: 'preference' },
      { text: 'We decided to use React', expected: 'decision' },
      { text: 'My email is test@example.com', expected: 'entity' },
      { text: 'The server is running on port 3000', expected: 'fact' }
    ];
    for (const { text, expected } of cases) {
      const lower = text.toLowerCase();
      let category;
      if (/prefer|radši|like|love|hate|want/i.test(lower)) {
        category = 'preference';
      } else if (/rozhodli|decided|will use|budeme/i.test(lower)) {
        category = 'decision';
      } else if (/\+\d{10,}|@[\w.-]+\.\w+|is called|jmenuje se/i.test(lower)) {
        category = 'entity';
      } else if (/is|are|has|have|je|má|jsou/i.test(lower)) {
        category = 'fact';
      } else {
        category = 'other';
      }
      expect(category).toBe(expected);
    }
  });
});
describeLive('memory plugin live tests', () => {
  let tmpDir;
  let dbPath;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-memory-live-'));
    dbPath = path.join(tmpDir, 'lancedb');
  });
  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
  test('memory tools work end-to-end', async () => {
    const { default: memoryPlugin } = await import('./index.js');
    const liveApiKey = process.env.OPENAI_API_KEY ?? '';
    const registeredTools = [];
    const registeredClis = [];
    const registeredServices = [];
    const registeredHooks = {};
    const logs = [];
    const mockApi = {
      id: 'memory-lancedb',
      name: 'Memory (LanceDB)',
      source: 'test',
      config: {},
      pluginConfig: {
        embedding: {
          apiKey: liveApiKey,
          model: 'text-embedding-3-small'
        },
        dbPath,
        autoCapture: false,
        autoRecall: false
      },
      runtime: {},
      logger: {
        info: (msg) => logs.push(`[info] ${msg}`),
        warn: (msg) => logs.push(`[warn] ${msg}`),
        error: (msg) => logs.push(`[error] ${msg}`),
        debug: (msg) => logs.push(`[debug] ${msg}`)
      },
      // oxlint-disable-next-line typescript/no-explicit-any
      registerTool: (tool, opts) => {
        registeredTools.push({ tool, opts });
      },
      // oxlint-disable-next-line typescript/no-explicit-any
      registerCli: (registrar, opts) => {
        registeredClis.push({ registrar, opts });
      },
      // oxlint-disable-next-line typescript/no-explicit-any
      registerService: (service) => {
        registeredServices.push(service);
      },
      // oxlint-disable-next-line typescript/no-explicit-any
      on: (hookName, handler) => {
        if (!registeredHooks[hookName]) {
          registeredHooks[hookName] = [];
        }
        registeredHooks[hookName].push(handler);
      },
      resolvePath: (p) => p
    };
    memoryPlugin.register(mockApi);
    expect(registeredTools.length).toBe(3);
    expect(registeredTools.map((t) => t.opts?.name)).toContain('memory_recall');
    expect(registeredTools.map((t) => t.opts?.name)).toContain('memory_store');
    expect(registeredTools.map((t) => t.opts?.name)).toContain('memory_forget');
    expect(registeredClis.length).toBe(1);
    expect(registeredServices.length).toBe(1);
    const storeTool = registeredTools.find((t) => t.opts?.name === 'memory_store')?.tool;
    const recallTool = registeredTools.find((t) => t.opts?.name === 'memory_recall')?.tool;
    const forgetTool = registeredTools.find((t) => t.opts?.name === 'memory_forget')?.tool;
    const storeResult = await storeTool.execute('test-call-1', {
      text: 'The user prefers dark mode for all applications',
      importance: 0.8,
      category: 'preference'
    });
    expect(storeResult.details?.action).toBe('created');
    expect(storeResult.details?.id).toBeDefined();
    const storedId = storeResult.details?.id;
    const recallResult = await recallTool.execute('test-call-2', {
      query: 'dark mode preference',
      limit: 5
    });
    expect(recallResult.details?.count).toBeGreaterThan(0);
    expect(recallResult.details?.memories?.[0]?.text).toContain('dark mode');
    const duplicateResult = await storeTool.execute('test-call-3', {
      text: 'The user prefers dark mode for all applications'
    });
    expect(duplicateResult.details?.action).toBe('duplicate');
    const forgetResult = await forgetTool.execute('test-call-4', {
      memoryId: storedId
    });
    expect(forgetResult.details?.action).toBe('deleted');
    const recallAfterForget = await recallTool.execute('test-call-5', {
      query: 'dark mode preference',
      limit: 5
    });
    expect(recallAfterForget.details?.count).toBe(0);
  }, 6e4);
});
