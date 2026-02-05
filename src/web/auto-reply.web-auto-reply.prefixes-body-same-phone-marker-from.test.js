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
import { HEARTBEAT_TOKEN, monitorWebChannel } from './auto-reply.js';
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
  it('prefixes body with same-phone marker when from === to', async () => {
    setLoadConfigMock(() => ({
      channels: { whatsapp: { allowFrom: ['*'] } },
      messages: {
        messagePrefix: '[same-phone]',
        responsePrefix: void 0
      }
    }));
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const resolver = vi.fn().mockResolvedValue({ text: 'reply' });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello',
      from: '+1555',
      to: '+1555',
      // Same phone!
      id: 'msg1',
      sendComposing: vi.fn(),
      reply: vi.fn(),
      sendMedia: vi.fn()
    });
    const callArg = resolver.mock.calls[0]?.[0];
    expect(callArg?.Body).toBeDefined();
    expect(callArg?.Body).toContain('[WhatsApp +1555');
    expect(callArg?.Body).toContain('[same-phone] hello');
    resetLoadConfigMock();
  });
  it('does not prefix body when from !== to', async () => {
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const resolver = vi.fn().mockResolvedValue({ text: 'reply' });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello',
      from: '+1555',
      to: '+2666',
      // Different phones
      id: 'msg1',
      sendComposing: vi.fn(),
      reply: vi.fn(),
      sendMedia: vi.fn()
    });
    const callArg = resolver.mock.calls[0]?.[0];
    expect(callArg?.Body).toContain('[WhatsApp +1555');
    expect(callArg?.Body).toContain('hello');
  });
  it('forwards reply-to context to resolver', async () => {
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const resolver = vi.fn().mockResolvedValue({ text: 'reply' });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello',
      from: '+1555',
      to: '+2666',
      id: 'msg1',
      replyToId: 'q1',
      replyToBody: 'original',
      replyToSender: '+1999',
      sendComposing: vi.fn(),
      reply: vi.fn(),
      sendMedia: vi.fn()
    });
    const callArg = resolver.mock.calls[0]?.[0];
    expect(callArg.ReplyToId).toBe('q1');
    expect(callArg.ReplyToBody).toBe('original');
    expect(callArg.ReplyToSender).toBe('+1999');
    expect(callArg.Body).toContain('[Replying to +1999 id:q1]');
    expect(callArg.Body).toContain('original');
  });
  it('applies responsePrefix to regular replies', async () => {
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
    expect(reply).toHaveBeenCalledWith('\u{1F99E} hello there');
    resetLoadConfigMock();
  });
  it('applies channel responsePrefix override to replies', async () => {
    setLoadConfigMock(() => ({
      channels: { whatsapp: { allowFrom: ['*'], responsePrefix: '[WA]' } },
      messages: {
        messagePrefix: void 0,
        responsePrefix: '[Global]'
      }
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
    expect(reply).toHaveBeenCalledWith('[WA] hello there');
    resetLoadConfigMock();
  });
  it('defaults responsePrefix for self-chat replies when unset', async () => {
    setLoadConfigMock(() => ({
      agents: {
        list: [
          {
            id: 'main',
            default: true,
            identity: { name: 'Mainbot', emoji: '\u{1F99E}', theme: 'space lobster' }
          }
        ]
      },
      channels: { whatsapp: { allowFrom: ['+1555'] } },
      messages: {
        messagePrefix: void 0,
        responsePrefix: void 0
      }
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
      to: '+1555',
      selfE164: '+1555',
      chatType: 'direct',
      id: 'msg1',
      sendComposing: vi.fn(),
      reply,
      sendMedia: vi.fn()
    });
    expect(reply).toHaveBeenCalledWith('[Mainbot] hello there');
    resetLoadConfigMock();
  });
  it('does not deliver HEARTBEAT_OK responses', async () => {
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
    const resolver = vi.fn().mockResolvedValue({ text: HEARTBEAT_TOKEN });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'test',
      from: '+1555',
      to: '+2666',
      id: 'msg1',
      sendComposing: vi.fn(),
      reply,
      sendMedia: vi.fn()
    });
    expect(reply).not.toHaveBeenCalled();
    resetLoadConfigMock();
  });
  it('does not double-prefix if responsePrefix already present', async () => {
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
    const resolver = vi.fn().mockResolvedValue({ text: '\u{1F99E} already prefixed' });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'test',
      from: '+1555',
      to: '+2666',
      id: 'msg1',
      sendComposing: vi.fn(),
      reply,
      sendMedia: vi.fn()
    });
    expect(reply).toHaveBeenCalledWith('\u{1F99E} already prefixed');
    resetLoadConfigMock();
  });
});
