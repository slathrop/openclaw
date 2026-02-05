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
import { sleep } from '../utils.js';
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
        await sleep(25);
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
  it('uses per-agent mention patterns for group gating', async () => {
    const sendMedia = vi.fn();
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const resolver = vi.fn().mockResolvedValue({ text: 'ok' });
    setLoadConfigMock(() => ({
      channels: {
        whatsapp: {
          allowFrom: ['*'],
          groups: { '*': { requireMention: true } }
        }
      },
      messages: {
        groupChat: { mentionPatterns: ['@global'] }
      },
      agents: {
        list: [
          {
            id: 'work',
            groupChat: { mentionPatterns: ['@workbot'] }
          }
        ]
      },
      bindings: [
        {
          agentId: 'work',
          match: {
            provider: 'whatsapp',
            peer: { kind: 'group', id: '123@g.us' }
          }
        }
      ]
    }));
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: '@global ping',
      from: '123@g.us',
      conversationId: '123@g.us',
      chatId: '123@g.us',
      chatType: 'group',
      to: '+2',
      id: 'g1',
      senderE164: '+111',
      senderName: 'Alice',
      selfE164: '+999',
      sendComposing,
      reply,
      sendMedia
    });
    expect(resolver).not.toHaveBeenCalled();
    await capturedOnMessage?.({
      body: '@workbot ping',
      from: '123@g.us',
      conversationId: '123@g.us',
      chatId: '123@g.us',
      chatType: 'group',
      to: '+2',
      id: 'g2',
      senderE164: '+222',
      senderName: 'Bob',
      selfE164: '+999',
      sendComposing,
      reply,
      sendMedia
    });
    expect(resolver).toHaveBeenCalledTimes(1);
  });
  it('allows group messages when whatsapp groups default disables mention gating', async () => {
    const sendMedia = vi.fn();
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const resolver = vi.fn().mockResolvedValue({ text: 'ok' });
    setLoadConfigMock(() => ({
      channels: {
        whatsapp: {
          allowFrom: ['*'],
          groups: { '*': { requireMention: false } }
        }
      },
      messages: { groupChat: { mentionPatterns: ['@openclaw'] } }
    }));
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello group',
      from: '123@g.us',
      conversationId: '123@g.us',
      chatId: '123@g.us',
      chatType: 'group',
      to: '+2',
      id: 'g-default-off',
      senderE164: '+111',
      senderName: 'Alice',
      selfE164: '+999',
      sendComposing,
      reply,
      sendMedia
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    resetLoadConfigMock();
  });
  it('blocks group messages when whatsapp groups is set without a wildcard', async () => {
    const sendMedia = vi.fn();
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const resolver = vi.fn().mockResolvedValue({ text: 'ok' });
    setLoadConfigMock(() => ({
      channels: {
        whatsapp: {
          allowFrom: ['*'],
          groups: { '999@g.us': { requireMention: false } }
        }
      },
      messages: { groupChat: { mentionPatterns: ['@openclaw'] } }
    }));
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: '@openclaw hello',
      from: '123@g.us',
      conversationId: '123@g.us',
      chatId: '123@g.us',
      chatType: 'group',
      to: '+2',
      id: 'g-allowlist-block',
      senderE164: '+111',
      senderName: 'Alice',
      mentionedJids: ['999@s.whatsapp.net'],
      selfE164: '+999',
      selfJid: '999@s.whatsapp.net',
      sendComposing,
      reply,
      sendMedia
    });
    expect(resolver).not.toHaveBeenCalled();
    resetLoadConfigMock();
  });
  it('honors per-group mention overrides when conversationId uses session key', async () => {
    const sendMedia = vi.fn();
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const resolver = vi.fn().mockResolvedValue({ text: 'ok' });
    setLoadConfigMock(() => ({
      channels: {
        whatsapp: {
          allowFrom: ['*'],
          groups: {
            '*': { requireMention: true },
            '123@g.us': { requireMention: false }
          }
        }
      },
      messages: { groupChat: { mentionPatterns: ['@openclaw'] } }
    }));
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello group',
      from: 'whatsapp:group:123@g.us',
      conversationId: 'whatsapp:group:123@g.us',
      chatId: '123@g.us',
      chatType: 'group',
      to: '+2',
      id: 'g-per-group-session-key',
      senderE164: '+111',
      senderName: 'Alice',
      selfE164: '+999',
      sendComposing,
      reply,
      sendMedia
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    resetLoadConfigMock();
  });
});
