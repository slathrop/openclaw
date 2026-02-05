import './test-helpers.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../agents/pi-embedded.js', () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key) => `session:${key.trim() || 'main'}`
}));
import { resetInboundDedupe } from '../auto-reply/reply/inbound-dedupe.js';
import { resetLogger, setLoggerOverride } from '../logging.js';
import { monitorWebChannel } from './auto-reply.js';
import { resetBaileysMocks, resetLoadConfigMock, setLoadConfigMock } from './test-helpers.js';
let previousHome;
let tempHome;
const rmDirWithRetries = async (dir) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : null;
      if (code === 'ENOTEMPTY' || code === 'EBUSY' || code === 'EPERM') {
        await new Promise((resolve) => setTimeout(resolve, 25));
        continue;
      }
      throw err;
    }
  }
  await fs.rm(dir, { recursive: true, force: true });
};
beforeEach(async () => {
  resetInboundDedupe();
  previousHome = process.env.HOME;
  tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-web-home-'));
  process.env.HOME = tempHome;
});
afterEach(async () => {
  process.env.HOME = previousHome;
  if (tempHome) {
    await rmDirWithRetries(tempHome);
    tempHome = void 0;
  }
});
// eslint-disable-next-line no-unused-vars
const _makeSessionStore = async (entries = {}) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-session-'));
  const storePath = path.join(dir, 'sessions.json');
  await fs.writeFile(storePath, JSON.stringify(entries));
  const cleanup = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        return;
      } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : null;
        if (code === 'ENOTEMPTY' || code === 'EBUSY' || code === 'EPERM') {
          await new Promise((resolve) => setTimeout(resolve, 25));
          continue;
        }
        throw err;
      }
    }
    await fs.rm(dir, { recursive: true, force: true });
  };
  return {
    storePath,
    cleanup
  };
};
describe('web auto-reply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBaileysMocks();
    resetLoadConfigMock();
  });
  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
    vi.useRealTimers();
  });
  it('skips tool summaries and sends final reply with responsePrefix', async () => {
    setLoadConfigMock(() => ({
      channels: { whatsapp: { allowFrom: ['*'] } },
      messages: {
        messagePrefix: void 0,
        responsePrefix: '\u{1F99E}'
      }
    }));
    let capturedOnMessage;
    const reply = vi.fn();
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const resolver = vi.fn().mockResolvedValue({ text: 'final' });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hi',
      from: '+1555',
      to: '+2666',
      id: 'msg1',
      sendComposing: vi.fn(),
      reply,
      sendMedia: vi.fn()
    });
    const replies = reply.mock.calls.map((call) => call[0]);
    expect(replies).toEqual(['\u{1F99E} final']);
    resetLoadConfigMock();
  });
  it('uses identity.name for messagePrefix when set', async () => {
    setLoadConfigMock(() => ({
      agents: {
        list: [
          {
            id: 'main',
            default: true,
            identity: { name: 'Mainbot', emoji: '\u{1F99E}', theme: 'space lobster' }
          },
          {
            id: 'rich',
            identity: { name: 'Richbot', emoji: '\u{1F981}', theme: 'lion bot' }
          }
        ]
      },
      bindings: [
        {
          agentId: 'rich',
          match: {
            channel: 'whatsapp',
            peer: { kind: 'dm', id: '+1555' }
          }
        }
      ]
    }));
    let capturedOnMessage;
    const reply = vi.fn();
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const resolver = vi.fn().mockResolvedValue({ text: 'hello' });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hi',
      from: '+1555',
      to: '+2666',
      id: 'msg1',
      sendComposing: vi.fn(),
      reply,
      sendMedia: vi.fn()
    });
    expect(resolver).toHaveBeenCalled();
    const resolverArg = resolver.mock.calls[0][0];
    expect(resolverArg.Body).toContain('[Richbot]');
    expect(resolverArg.Body).not.toContain('[openclaw]');
    resetLoadConfigMock();
  });
  it('does not derive responsePrefix from identity.name when unset', async () => {
    setLoadConfigMock(() => ({
      agents: {
        list: [
          {
            id: 'main',
            default: true,
            identity: { name: 'Mainbot', emoji: '\u{1F99E}', theme: 'space lobster' }
          },
          {
            id: 'rich',
            identity: { name: 'Richbot', emoji: '\u{1F981}', theme: 'lion bot' }
          }
        ]
      },
      bindings: [
        {
          agentId: 'rich',
          match: {
            channel: 'whatsapp',
            peer: { kind: 'dm', id: '+1555' }
          }
        }
      ]
    }));
    let capturedOnMessage;
    const reply = vi.fn();
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const resolver = vi.fn().mockResolvedValue({ text: 'hello there' });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hi',
      from: '+1555',
      to: '+2666',
      id: 'msg1',
      sendComposing: vi.fn(),
      reply,
      sendMedia: vi.fn()
    });
    expect(reply).toHaveBeenCalledWith('hello there');
    resetLoadConfigMock();
  });
});
