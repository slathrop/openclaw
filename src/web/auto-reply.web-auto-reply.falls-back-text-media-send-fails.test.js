import './test-helpers.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ssrf from '../infra/net/ssrf.js';
const TEST_NET_IP = '203.0.113.10';
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
import { resetBaileysMocks, resetLoadConfigMock } from './test-helpers.js';
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
  let resolvePinnedHostnameSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    resetBaileysMocks();
    resetLoadConfigMock();
    resolvePinnedHostnameSpy = vi.spyOn(ssrf, 'resolvePinnedHostname').mockImplementation(async (hostname) => {
      const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
      const addresses = [TEST_NET_IP];
      return {
        hostname: normalized,
        addresses,
        lookup: ssrf.createPinnedLookup({ hostname: normalized, addresses })
      };
    });
  });
  afterEach(() => {
    resolvePinnedHostnameSpy?.mockRestore();
    resolvePinnedHostnameSpy = void 0;
    resetLogger();
    setLoggerOverride(null);
    vi.useRealTimers();
  });
  it('falls back to text when media send fails', async () => {
    const sendMedia = vi.fn().mockRejectedValue(new Error('boom'));
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const resolver = vi.fn().mockResolvedValue({
      text: 'hi',
      mediaUrl: 'https://example.com/img.png'
    });
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const smallPng = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 0, g: 255, b: 0 }
      }
    }).png().toBuffer();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: true,
      arrayBuffer: async () => smallPng.buffer.slice(smallPng.byteOffset, smallPng.byteOffset + smallPng.byteLength),
      headers: { get: () => 'image/png' },
      status: 200
    });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello',
      from: '+1',
      to: '+2',
      id: 'msg1',
      sendComposing,
      reply,
      sendMedia
    });
    expect(sendMedia).toHaveBeenCalledTimes(1);
    const fallback = reply.mock.calls[0]?.[0];
    expect(fallback).toContain('hi');
    expect(fallback).toContain('Media failed');
    fetchMock.mockRestore();
  });
  it('returns a warning when remote media fetch 404s', async () => {
    const sendMedia = vi.fn();
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const resolver = vi.fn().mockResolvedValue({
      text: 'caption',
      mediaUrl: 'https://example.com/missing.jpg'
    });
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => 'text/plain' }
    });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello',
      from: '+1',
      to: '+2',
      id: 'msg1',
      sendComposing,
      reply,
      sendMedia
    });
    expect(sendMedia).not.toHaveBeenCalled();
    const fallback = reply.mock.calls[0]?.[0];
    expect(fallback).toContain('caption');
    expect(fallback).toContain('Media failed');
    expect(fallback).toContain('404');
    fetchMock.mockRestore();
  });
  it('compresses media over 5MB and still sends it', async () => {
    const sendMedia = vi.fn();
    const reply = vi.fn().mockResolvedValue(void 0);
    const sendComposing = vi.fn();
    const resolver = vi.fn().mockResolvedValue({
      text: 'hi',
      mediaUrl: 'https://example.com/big.png'
    });
    let capturedOnMessage;
    const listenerFactory = async (opts) => {
      capturedOnMessage = opts.onMessage;
      return { close: vi.fn() };
    };
    const bigPng = await sharp({
      create: {
        width: 3200,
        height: 3200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).png({ compressionLevel: 0 }).toBuffer();
    expect(bigPng.length).toBeGreaterThan(5 * 1024 * 1024);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: true,
      arrayBuffer: async () => bigPng.buffer.slice(bigPng.byteOffset, bigPng.byteOffset + bigPng.byteLength),
      headers: { get: () => 'image/png' },
      status: 200
    });
    await monitorWebChannel(false, listenerFactory, false, resolver);
    expect(capturedOnMessage).toBeDefined();
    await capturedOnMessage?.({
      body: 'hello',
      from: '+1',
      to: '+2',
      id: 'msg1',
      sendComposing,
      reply,
      sendMedia
    });
    expect(sendMedia).toHaveBeenCalledTimes(1);
    const payload = sendMedia.mock.calls[0][0];
    expect(payload.image.length).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(payload.mimetype).toBe('image/jpeg');
    expect(reply).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
