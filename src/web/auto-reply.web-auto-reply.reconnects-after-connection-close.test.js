import './test-helpers.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeRegExp, formatEnvelopeTimestamp } from '../../test/helpers/envelope-timestamp.js';
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
const makeSessionStore = async (entries = {}) => {
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
  it('reconnects after a connection close', async () => {
    const closeResolvers = [];
    const sleep = vi.fn(async () => {
    });
    const listenerFactory = vi.fn(async () => {
      // eslint-disable-next-line no-unused-vars
      let _resolve;
      const onClose = new Promise((res) => {
        _resolve = res;
        closeResolvers.push(res);
      });
      return { close: vi.fn(), onClose };
    });
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn()
    };
    const controller = new AbortController();
    const run = monitorWebChannel(
      false,
      listenerFactory,
      true,
      async () => ({ text: 'ok' }),
      runtime,
      controller.signal,
      {
        heartbeatSeconds: 1,
        reconnect: { initialMs: 10, maxMs: 10, maxAttempts: 3, factor: 1.1 },
        sleep
      }
    );
    await Promise.resolve();
    expect(listenerFactory).toHaveBeenCalledTimes(1);
    closeResolvers[0]?.();
    const waitForSecondCall = async () => {
      const started = Date.now();
      while (listenerFactory.mock.calls.length < 2 && Date.now() - started < 200) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    await waitForSecondCall();
    expect(listenerFactory).toHaveBeenCalledTimes(2);
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining('Retry 1'));
    controller.abort();
    closeResolvers[1]?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await run;
  });
  it('forces reconnect when watchdog closes without onClose', async () => {
    vi.useFakeTimers();
    const sleep = vi.fn(async () => {
    });
    const closeResolvers = [];
    let capturedOnMessage;
    const listenerFactory = vi.fn(
      async (opts) => {
        capturedOnMessage = opts.onMessage;
        let resolveClose = () => {
        };
        const onClose = new Promise((res) => {
          resolveClose = res;
          closeResolvers.push(res);
        });
        return {
          close: vi.fn(),
          onClose,
          signalClose: (reason) => resolveClose(reason)
        };
      }
    );
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn()
    };
    const controller = new AbortController();
    const run = monitorWebChannel(
      false,
      listenerFactory,
      true,
      async () => ({ text: 'ok' }),
      runtime,
      controller.signal,
      {
        heartbeatSeconds: 1,
        reconnect: { initialMs: 10, maxMs: 10, maxAttempts: 3, factor: 1.1 },
        sleep
      }
    );
    await Promise.resolve();
    expect(listenerFactory).toHaveBeenCalledTimes(1);
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const sendMedia = vi.fn();
    await capturedOnMessage?.({
      body: 'hi',
      from: '+1',
      to: '+2',
      id: 'm1',
      sendComposing,
      reply,
      sendMedia
    });
    await vi.advanceTimersByTimeAsync(31 * 60 * 1e3);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    expect(listenerFactory).toHaveBeenCalledTimes(2);
    controller.abort();
    closeResolvers[1]?.({ status: 499, isLoggedOut: false });
    await Promise.resolve();
    await run;
  }, 15e3);
  it('stops after hitting max reconnect attempts', { timeout: 6e4 }, async () => {
    const closeResolvers = [];
    const sleep = vi.fn(async () => {
    });
    const listenerFactory = vi.fn(async () => {
      const onClose = new Promise((res) => closeResolvers.push(res));
      return { close: vi.fn(), onClose };
    });
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn()
    };
    const run = monitorWebChannel(
      false,
      listenerFactory,
      true,
      async () => ({ text: 'ok' }),
      runtime,
      void 0,
      {
        heartbeatSeconds: 1,
        reconnect: { initialMs: 5, maxMs: 5, maxAttempts: 2, factor: 1.1 },
        sleep
      }
    );
    await Promise.resolve();
    expect(listenerFactory).toHaveBeenCalledTimes(1);
    closeResolvers.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(listenerFactory).toHaveBeenCalledTimes(2);
    closeResolvers.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await run;
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining('max attempts reached'));
  });
  it('processes inbound messages without batching and preserves timestamps', async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Vienna';
    const originalMax = process.getMaxListeners();
    process.setMaxListeners?.(1);
    const store = await makeSessionStore({
      main: { sessionId: 'sid', updatedAt: Date.now() }
    });
    try {
      const sendMedia = vi.fn();
      const reply = vi.fn().mockResolvedValue(void 0);
      const sendComposing = vi.fn();
      const resolver = vi.fn().mockResolvedValue({ text: 'ok' });
      let capturedOnMessage;
      const listenerFactory = async (opts) => {
        capturedOnMessage = opts.onMessage;
        return { close: vi.fn() };
      };
      setLoadConfigMock(() => ({
        agents: {
          defaults: {
            envelopeTimezone: 'utc'
          }
        },
        session: { store: store.storePath }
      }));
      await monitorWebChannel(false, listenerFactory, false, resolver);
      expect(capturedOnMessage).toBeDefined();
      await capturedOnMessage?.({
        body: 'first',
        from: '+1',
        to: '+2',
        id: 'm1',
        timestamp: 17356896e5,
        // Jan 1 2025 00:00:00 UTC
        sendComposing,
        reply,
        sendMedia
      });
      await capturedOnMessage?.({
        body: 'second',
        from: '+1',
        to: '+2',
        id: 'm2',
        timestamp: 17356932e5,
        // Jan 1 2025 01:00:00 UTC
        sendComposing,
        reply,
        sendMedia
      });
      expect(resolver).toHaveBeenCalledTimes(2);
      const firstArgs = resolver.mock.calls[0][0];
      const secondArgs = resolver.mock.calls[1][0];
      const firstTimestamp = formatEnvelopeTimestamp(/* @__PURE__ */ new Date('2025-01-01T00:00:00Z'));
      const secondTimestamp = formatEnvelopeTimestamp(/* @__PURE__ */ new Date('2025-01-01T01:00:00Z'));
      const firstPattern = escapeRegExp(firstTimestamp);
      const secondPattern = escapeRegExp(secondTimestamp);
      expect(firstArgs.Body).toMatch(
        new RegExp(`\\[WhatsApp \\+1 (\\+\\d+[smhd] )?${firstPattern}\\] \\[openclaw\\] first`)
      );
      expect(firstArgs.Body).not.toContain('second');
      expect(secondArgs.Body).toMatch(
        new RegExp(`\\[WhatsApp \\+1 (\\+\\d+[smhd] )?${secondPattern}\\] \\[openclaw\\] second`)
      );
      expect(secondArgs.Body).not.toContain('first');
      expect(process.getMaxListeners?.()).toBeGreaterThanOrEqual(50);
    } finally {
      process.setMaxListeners?.(originalMax);
      process.env.TZ = originalTz;
      await store.cleanup();
    }
  });
});
