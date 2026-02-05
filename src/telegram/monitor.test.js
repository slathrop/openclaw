const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { monitorTelegramProvider } from './monitor.js';
const handlers = {};
const api = {
  sendMessage: vi.fn(),
  sendPhoto: vi.fn(),
  sendVideo: vi.fn(),
  sendAudio: vi.fn(),
  sendDocument: vi.fn(),
  setWebhook: vi.fn(),
  deleteWebhook: vi.fn()
};
const { initSpy, runSpy, loadConfig } = vi.hoisted(() => ({
  initSpy: vi.fn(async () => void 0),
  runSpy: vi.fn(() => ({
    task: /* @__PURE__ */ __name(() => Promise.resolve(), 'task'),
    stop: vi.fn()
  })),
  loadConfig: vi.fn(() => ({
    agents: { defaults: { maxConcurrent: 2 } },
    channels: { telegram: {} }
  }))
}));
const { computeBackoff, sleepWithAbort } = vi.hoisted(() => ({
  computeBackoff: vi.fn(() => 0),
  sleepWithAbort: vi.fn(async () => void 0)
}));
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig
  };
});
vi.mock('./bot.js', () => ({
  createTelegramBot: /* @__PURE__ */ __name(() => {
    handlers.message = async (ctx) => {
      const chatId = ctx.message.chat.id;
      const isGroup = ctx.message.chat.type !== 'private';
      const text = ctx.message.text ?? ctx.message.caption ?? '';
      if (isGroup && !text.includes('@mybot')) {
        return;
      }
      if (!text.trim()) {
        return;
      }
      await api.sendMessage(chatId, `echo:${text}`, { parse_mode: 'HTML' });
    };
    return {
      on: vi.fn(),
      api,
      me: { username: 'mybot' },
      init: initSpy,
      stop: vi.fn(),
      start: vi.fn()
    };
  }, 'createTelegramBot'),
  createTelegramWebhookCallback: vi.fn()
}));
vi.mock('@grammyjs/runner', () => ({
  run: runSpy
}));
vi.mock('../infra/backoff.js', () => ({
  computeBackoff,
  sleepWithAbort
}));
vi.mock('../auto-reply/reply.js', () => ({
  getReplyFromConfig: /* @__PURE__ */ __name(async (ctx) => ({
    text: `echo:${ctx.Body}`
  }), 'getReplyFromConfig')
}));
describe('monitorTelegramProvider (grammY)', () => {
  beforeEach(() => {
    loadConfig.mockReturnValue({
      agents: { defaults: { maxConcurrent: 2 } },
      channels: { telegram: {} }
    });
    initSpy.mockClear();
    runSpy.mockClear();
    computeBackoff.mockClear();
    sleepWithAbort.mockClear();
  });
  it('processes a DM and sends reply', async () => {
    Object.values(api).forEach((fn) => {
      fn?.mockReset?.();
    });
    await monitorTelegramProvider({ token: 'tok' });
    expect(handlers.message).toBeDefined();
    await handlers.message?.({
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        text: 'hi'
      },
      me: { username: 'mybot' },
      getFile: vi.fn(async () => ({}))
    });
    expect(api.sendMessage).toHaveBeenCalledWith(123, 'echo:hi', {
      parse_mode: 'HTML'
    });
  });
  it('uses agent maxConcurrent for runner concurrency', async () => {
    runSpy.mockClear();
    loadConfig.mockReturnValue({
      agents: { defaults: { maxConcurrent: 3 } },
      channels: { telegram: {} }
    });
    await monitorTelegramProvider({ token: 'tok' });
    expect(runSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sink: { concurrency: 3 },
        runner: expect.objectContaining({
          silent: true,
          maxRetryTime: 5 * 60 * 1e3,
          retryInterval: 'exponential'
        })
      })
    );
  });
  it('requires mention in groups by default', async () => {
    Object.values(api).forEach((fn) => {
      fn?.mockReset?.();
    });
    await monitorTelegramProvider({ token: 'tok' });
    await handlers.message?.({
      message: {
        message_id: 2,
        chat: { id: -99, type: 'supergroup', title: 'G' },
        text: 'hello all'
      },
      me: { username: 'mybot' },
      getFile: vi.fn(async () => ({}))
    });
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
  it('retries on recoverable network errors', async () => {
    const networkError = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    runSpy.mockImplementationOnce(() => ({
      task: /* @__PURE__ */ __name(() => Promise.reject(networkError), 'task'),
      stop: vi.fn()
    })).mockImplementationOnce(() => ({
      task: /* @__PURE__ */ __name(() => Promise.resolve(), 'task'),
      stop: vi.fn()
    }));
    await monitorTelegramProvider({ token: 'tok' });
    expect(computeBackoff).toHaveBeenCalled();
    expect(sleepWithAbort).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledTimes(2);
  });
  it('surfaces non-recoverable errors', async () => {
    runSpy.mockImplementationOnce(() => ({
      task: /* @__PURE__ */ __name(() => Promise.reject(new Error('bad token')), 'task'),
      stop: vi.fn()
    }));
    await expect(monitorTelegramProvider({ token: 'tok' })).rejects.toThrow('bad token');
  });
});
