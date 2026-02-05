import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetInboundDedupe } from '../auto-reply/reply/inbound-dedupe.js';
import { resetSystemEventsForTest } from '../infra/system-events.js';
import { monitorSignalProvider } from './monitor.js';
const sendMock = vi.fn();
const replyMock = vi.fn();
const updateLastRouteMock = vi.fn();
let config = {};
const readAllowFromStoreMock = vi.fn();
const upsertPairingRequestMock = vi.fn();
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: () => config
  };
});
vi.mock('../auto-reply/reply.js', () => ({
  getReplyFromConfig: (...args) => replyMock(...args)
}));
vi.mock('./send.js', () => ({
  sendMessageSignal: (...args) => sendMock(...args),
  sendTypingSignal: vi.fn().mockResolvedValue(true),
  sendReadReceiptSignal: vi.fn().mockResolvedValue(true)
}));
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: (...args) => readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args) => upsertPairingRequestMock(...args)
}));
vi.mock('../config/sessions.js', () => ({
  resolveStorePath: vi.fn(() => '/tmp/openclaw-sessions.json'),
  updateLastRoute: (...args) => updateLastRouteMock(...args),
  readSessionUpdatedAt: vi.fn(() => void 0),
  recordSessionMetaFromInbound: vi.fn().mockResolvedValue(void 0)
}));
const streamMock = vi.fn();
const signalCheckMock = vi.fn();
const signalRpcRequestMock = vi.fn();
vi.mock('./client.js', () => ({
  streamSignalEvents: (...args) => streamMock(...args),
  signalCheck: (...args) => signalCheckMock(...args),
  signalRpcRequest: (...args) => signalRpcRequestMock(...args)
}));
vi.mock('./daemon.js', () => ({
  spawnSignalDaemon: vi.fn(() => ({ stop: vi.fn() }))
}));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
  resetInboundDedupe();
  config = {
    messages: { responsePrefix: 'PFX' },
    channels: {
      signal: { autoStart: false, dmPolicy: 'open', allowFrom: ['*'] }
    }
  };
  sendMock.mockReset().mockResolvedValue(void 0);
  replyMock.mockReset();
  updateLastRouteMock.mockReset();
  streamMock.mockReset();
  signalCheckMock.mockReset().mockResolvedValue({});
  signalRpcRequestMock.mockReset().mockResolvedValue({});
  readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  upsertPairingRequestMock.mockReset().mockResolvedValue({ code: 'PAIRCODE', created: true });
  resetSystemEventsForTest();
});
describe('monitorSignalProvider tool results', () => {
  it('pairs uuid-only senders with a uuid allowlist entry', async () => {
    config = {
      ...config,
      channels: {
        ...config.channels,
        signal: {
          ...config.channels?.signal,
          autoStart: false,
          dmPolicy: 'pairing',
          allowFrom: []
        }
      }
    };
    const abortController = new AbortController();
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceUuid: uuid,
          sourceName: 'Ada',
          timestamp: 1,
          dataMessage: {
            message: 'hello'
          }
        }
      };
      await onEvent({
        event: 'receive',
        data: JSON.stringify(payload)
      });
      abortController.abort();
    });
    await monitorSignalProvider({
      autoStart: false,
      baseUrl: 'http://127.0.0.1:8080',
      abortSignal: abortController.signal
    });
    await flush();
    expect(replyMock).not.toHaveBeenCalled();
    expect(upsertPairingRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'signal',
        id: `uuid:${uuid}`,
        meta: expect.objectContaining({ name: 'Ada' })
      })
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toBe(`signal:${uuid}`);
    expect(String(sendMock.mock.calls[0]?.[1] ?? '')).toContain(
      `Your Signal sender id: uuid:${uuid}`
    );
  });
  it('reconnects after stream errors until aborted', async () => {
    vi.useFakeTimers();
    const abortController = new AbortController();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    let calls = 0;
    streamMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('stream dropped');
      }
      abortController.abort();
    });
    try {
      const monitorPromise = monitorSignalProvider({
        autoStart: false,
        baseUrl: 'http://127.0.0.1:8080',
        abortSignal: abortController.signal
      });
      await vi.advanceTimersByTimeAsync(1e3);
      await monitorPromise;
      expect(streamMock).toHaveBeenCalledTimes(2);
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
