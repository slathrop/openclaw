import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetInboundDedupe } from '../auto-reply/reply/inbound-dedupe.js';
import { peekSystemEvents, resetSystemEventsForTest } from '../infra/system-events.js';
import { resolveAgentRoute } from '../routing/resolve-route.js';
import { normalizeE164 } from '../utils.js';
import { monitorSignalProvider } from './monitor.js';
const waitForTransportReadyMock = vi.hoisted(() => vi.fn());
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
vi.mock('../infra/transport-ready.js', () => ({
  waitForTransportReady: (...args) => waitForTransportReadyMock(...args)
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
  waitForTransportReadyMock.mockReset().mockResolvedValue(void 0);
  resetSystemEventsForTest();
});
describe('monitorSignalProvider tool results', () => {
  it('uses bounded readiness checks when auto-starting the daemon', async () => {
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: ((code) => {
        throw new Error(`exit ${code}`);
      })
    };
    config = {
      ...config,
      channels: {
        ...config.channels,
        signal: { autoStart: true, dmPolicy: 'open', allowFrom: ['*'] }
      }
    };
    const abortController = new AbortController();
    streamMock.mockImplementation(async () => {
      abortController.abort();
      return;
    });
    await monitorSignalProvider({
      autoStart: true,
      baseUrl: 'http://127.0.0.1:8080',
      abortSignal: abortController.signal,
      runtime
    });
    expect(waitForTransportReadyMock).toHaveBeenCalledTimes(1);
    expect(waitForTransportReadyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'signal daemon',
        timeoutMs: 3e4,
        logAfterMs: 1e4,
        logIntervalMs: 1e4,
        pollIntervalMs: 150,
        runtime,
        abortSignal: abortController.signal
      })
    );
  });
  it('uses startupTimeoutMs override when provided', async () => {
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: ((code) => {
        throw new Error(`exit ${code}`);
      })
    };
    config = {
      ...config,
      channels: {
        ...config.channels,
        signal: {
          autoStart: true,
          dmPolicy: 'open',
          allowFrom: ['*'],
          startupTimeoutMs: 6e4
        }
      }
    };
    const abortController = new AbortController();
    streamMock.mockImplementation(async () => {
      abortController.abort();
      return;
    });
    await monitorSignalProvider({
      autoStart: true,
      baseUrl: 'http://127.0.0.1:8080',
      abortSignal: abortController.signal,
      runtime,
      startupTimeoutMs: 9e4
    });
    expect(waitForTransportReadyMock).toHaveBeenCalledTimes(1);
    expect(waitForTransportReadyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 9e4
      })
    );
  });
  it('caps startupTimeoutMs at 2 minutes', async () => {
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: ((code) => {
        throw new Error(`exit ${code}`);
      })
    };
    config = {
      ...config,
      channels: {
        ...config.channels,
        signal: {
          autoStart: true,
          dmPolicy: 'open',
          allowFrom: ['*'],
          startupTimeoutMs: 18e4
        }
      }
    };
    const abortController = new AbortController();
    streamMock.mockImplementation(async () => {
      abortController.abort();
      return;
    });
    await monitorSignalProvider({
      autoStart: true,
      baseUrl: 'http://127.0.0.1:8080',
      abortSignal: abortController.signal,
      runtime
    });
    expect(waitForTransportReadyMock).toHaveBeenCalledTimes(1);
    expect(waitForTransportReadyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 12e4
      })
    );
  });
  it('skips tool summaries with responsePrefix', async () => {
    const abortController = new AbortController();
    replyMock.mockResolvedValue({ text: 'final reply' });
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
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
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][1]).toBe('PFX final reply');
  });
  it('replies with pairing code when dmPolicy is pairing and no allowFrom is set', async () => {
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
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
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
    expect(upsertPairingRequestMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(String(sendMock.mock.calls[0]?.[1] ?? '')).toContain('Your Signal number: +15550001111');
    expect(String(sendMock.mock.calls[0]?.[1] ?? '')).toContain('Pairing code: PAIRCODE');
  });
  it('ignores reaction-only messages', async () => {
    const abortController = new AbortController();
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
          sourceName: 'Ada',
          timestamp: 1,
          reactionMessage: {
            emoji: '\u{1F44D}',
            targetAuthor: '+15550002222',
            targetSentTimestamp: 2
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
    expect(sendMock).not.toHaveBeenCalled();
    expect(updateLastRouteMock).not.toHaveBeenCalled();
  });
  it('ignores reaction-only dataMessage.reaction events (don\u2019t treat as broken attachments)', async () => {
    const abortController = new AbortController();
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
          sourceName: 'Ada',
          timestamp: 1,
          dataMessage: {
            reaction: {
              emoji: '\u{1F44D}',
              targetAuthor: '+15550002222',
              targetSentTimestamp: 2
            },
            attachments: [{}]
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
    expect(sendMock).not.toHaveBeenCalled();
    expect(updateLastRouteMock).not.toHaveBeenCalled();
  });
  it('enqueues system events for reaction notifications', async () => {
    config = {
      ...config,
      channels: {
        ...config.channels,
        signal: {
          ...config.channels?.signal,
          autoStart: false,
          dmPolicy: 'open',
          allowFrom: ['*'],
          reactionNotifications: 'all'
        }
      }
    };
    const abortController = new AbortController();
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
          sourceName: 'Ada',
          timestamp: 1,
          reactionMessage: {
            emoji: '\u2705',
            targetAuthor: '+15550002222',
            targetSentTimestamp: 2
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
    const route = resolveAgentRoute({
      cfg: config,
      channel: 'signal',
      accountId: 'default',
      peer: { kind: 'dm', id: normalizeE164('+15550001111') }
    });
    const events = peekSystemEvents(route.sessionKey);
    expect(events.some((text) => text.includes('Signal reaction added'))).toBe(true);
  });
  it('notifies on own reactions when target includes uuid + phone', async () => {
    config = {
      ...config,
      channels: {
        ...config.channels,
        signal: {
          ...config.channels?.signal,
          autoStart: false,
          dmPolicy: 'open',
          allowFrom: ['*'],
          account: '+15550002222',
          reactionNotifications: 'own'
        }
      }
    };
    const abortController = new AbortController();
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
          sourceName: 'Ada',
          timestamp: 1,
          reactionMessage: {
            emoji: '\u2705',
            targetAuthor: '+15550002222',
            targetAuthorUuid: '123e4567-e89b-12d3-a456-426614174000',
            targetSentTimestamp: 2
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
    const route = resolveAgentRoute({
      cfg: config,
      channel: 'signal',
      accountId: 'default',
      peer: { kind: 'dm', id: normalizeE164('+15550001111') }
    });
    const events = peekSystemEvents(route.sessionKey);
    expect(events.some((text) => text.includes('Signal reaction added'))).toBe(true);
  });
  it('processes messages when reaction metadata is present', async () => {
    const abortController = new AbortController();
    replyMock.mockResolvedValue({ text: 'pong' });
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
          sourceName: 'Ada',
          timestamp: 1,
          reactionMessage: {
            emoji: '\u{1F44D}',
            targetAuthor: '+15550002222',
            targetSentTimestamp: 2
          },
          dataMessage: {
            message: 'ping'
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
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(updateLastRouteMock).toHaveBeenCalled();
  });
  it('does not resend pairing code when a request is already pending', async () => {
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
    upsertPairingRequestMock.mockResolvedValueOnce({ code: 'PAIRCODE', created: true }).mockResolvedValueOnce({ code: 'PAIRCODE', created: false });
    streamMock.mockImplementation(async ({ onEvent }) => {
      const payload = {
        envelope: {
          sourceNumber: '+15550001111',
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
      await onEvent({
        event: 'receive',
        data: JSON.stringify({
          ...payload,
          envelope: { ...payload.envelope, timestamp: 2 }
        })
      });
      abortController.abort();
    });
    await monitorSignalProvider({
      autoStart: false,
      baseUrl: 'http://127.0.0.1:8080',
      abortSignal: abortController.signal
    });
    await flush();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
