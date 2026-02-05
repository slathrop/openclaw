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
import { monitorWebChannel } from './auto-reply.js';
import { resetLoadConfigMock, setLoadConfigMock } from './test-helpers.js';
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
describe('typing controller idle', () => {
  it('marks dispatch idle after replies flush', async () => {
    const markDispatchIdle = vi.fn();
    const typingMock = {
      onReplyStart: vi.fn(async () => {
      }),
      startTypingLoop: vi.fn(async () => {
      }),
      startTypingOnText: vi.fn(async () => {
      }),
      refreshTypingTtl: vi.fn(),
      isActive: vi.fn(() => false),
      markRunComplete: vi.fn(),
      markDispatchIdle,
      cleanup: vi.fn()
    };
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn().mockResolvedValue(void 0);
    const sendMedia = vi.fn().mockResolvedValue(void 0);
    const replyResolver = vi.fn().mockImplementation(async (_ctx, opts) => {
      opts?.onTypingController?.(typingMock);
      return { text: 'final reply' };
    });
    const mockConfig = {
      channels: { whatsapp: { allowFrom: ['*'] } }
    };
    setLoadConfigMock(mockConfig);
    await monitorWebChannel(
      false,
      async ({ onMessage }) => {
        await onMessage({
          id: 'm1',
          from: '+1000',
          conversationId: '+1000',
          to: '+2000',
          body: 'hello',
          timestamp: Date.now(),
          chatType: 'direct',
          chatId: 'direct:+1000',
          sendComposing,
          reply,
          sendMedia
        });
        return { close: vi.fn().mockResolvedValue(void 0) };
      },
      false,
      replyResolver
    );
    resetLoadConfigMock();
    expect(markDispatchIdle).toHaveBeenCalled();
  });
});
