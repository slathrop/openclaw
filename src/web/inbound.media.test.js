import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const readAllowFromStoreMock = vi.fn().mockResolvedValue([]);
const upsertPairingRequestMock = vi.fn().mockResolvedValue({ code: 'PAIRCODE', created: true });
const saveMediaBufferSpy = vi.fn();
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: vi.fn().mockReturnValue({
      channels: {
        whatsapp: {
          allowFrom: ['*']
          // Allow all in tests
        }
      },
      messages: {
        messagePrefix: void 0,
        responsePrefix: void 0
      }
    })
  };
});
vi.mock('../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: (...args) => readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args) => upsertPairingRequestMock(...args)
}));
vi.mock('../media/store.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    saveMediaBuffer: vi.fn(async (...args) => {
      saveMediaBufferSpy(...args);
      return actual.saveMediaBuffer(...args);
    })
  };
});
const HOME = path.join(os.tmpdir(), `openclaw-inbound-media-${crypto.randomUUID()}`);
process.env.HOME = HOME;
vi.mock('@whiskeysockets/baileys', async () => {
  const actual = await vi.importActual('@whiskeysockets/baileys');
  const jpegBuffer = Buffer.from([
    255,
    216,
    255,
    219,
    0,
    67,
    0,
    3,
    2,
    2,
    2,
    2,
    2,
    3,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    6,
    4,
    4,
    4,
    4,
    4,
    8,
    6,
    6,
    5,
    6,
    9,
    8,
    10,
    10,
    9,
    8,
    9,
    9,
    10,
    12,
    15,
    12,
    10,
    11,
    14,
    11,
    9,
    9,
    13,
    17,
    13,
    14,
    15,
    16,
    16,
    17,
    16,
    10,
    12,
    18,
    19,
    18,
    16,
    19,
    15,
    16,
    16,
    16,
    255,
    192,
    0,
    17,
    8,
    0,
    1,
    0,
    1,
    3,
    1,
    17,
    0,
    2,
    17,
    1,
    3,
    17,
    1,
    255,
    196,
    0,
    20,
    0,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    255,
    196,
    0,
    20,
    16,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    255,
    218,
    0,
    12,
    3,
    1,
    0,
    2,
    17,
    3,
    17,
    0,
    63,
    0,
    255,
    217
  ]);
  return {
    ...actual,
    downloadMediaMessage: vi.fn().mockResolvedValue(jpegBuffer)
  };
});
vi.mock('./session.js', () => {
  const { EventEmitter } = require('node:events');
  const ev = new EventEmitter();
  const sock = {
    ev,
    ws: { close: vi.fn() },
    sendPresenceUpdate: vi.fn().mockResolvedValue(void 0),
    sendMessage: vi.fn().mockResolvedValue(void 0),
    readMessages: vi.fn().mockResolvedValue(void 0),
    updateMediaMessage: vi.fn(),
    logger: {},
    user: { id: 'me@s.whatsapp.net' }
  };
  return {
    createWaSocket: vi.fn().mockResolvedValue(sock),
    waitForWaConnection: vi.fn().mockResolvedValue(void 0),
    getStatusCode: vi.fn(() => 200)
  };
});
import { monitorWebInbox, resetWebInboundDedupe } from './inbound.js';
describe('web inbound media saves with extension', () => {
  beforeEach(() => {
    saveMediaBufferSpy.mockClear();
    resetWebInboundDedupe();
  });
  beforeAll(async () => {
    await fs.rm(HOME, { recursive: true, force: true });
  });
  afterAll(async () => {
    await fs.rm(HOME, { recursive: true, force: true });
  });
  it('stores inbound image with jpeg extension', async () => {
    const onMessage = vi.fn();
    const listener = await monitorWebInbox({ verbose: false, onMessage });
    const { createWaSocket } = await import('./session.js');
    const realSock = await createWaSocket();
    const upsert = {
      type: 'notify',
      messages: [
        {
          key: { id: 'img1', fromMe: false, remoteJid: '111@s.whatsapp.net' },
          message: { imageMessage: { mimetype: 'image/jpeg' } },
          messageTimestamp: 1700000001
        }
      ]
    };
    realSock.ev.emit('messages.upsert', upsert);
    for (let i = 0; i < 50; i++) {
      if (onMessage.mock.calls.length > 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(onMessage).toHaveBeenCalledTimes(1);
    const msg = onMessage.mock.calls[0][0];
    const mediaPath = msg.mediaPath;
    expect(mediaPath).toBeDefined();
    expect(path.extname(mediaPath)).toBe('.jpg');
    const stat = await fs.stat(mediaPath);
    expect(stat.size).toBeGreaterThan(0);
    await listener.close();
  });
  it('extracts mentions from media captions', async () => {
    const onMessage = vi.fn();
    const listener = await monitorWebInbox({ verbose: false, onMessage });
    const { createWaSocket } = await import('./session.js');
    const realSock = await createWaSocket();
    const upsert = {
      type: 'notify',
      messages: [
        {
          key: {
            id: 'img2',
            fromMe: false,
            remoteJid: '123@g.us',
            participant: '999@s.whatsapp.net'
          },
          message: {
            messageContextInfo: {},
            imageMessage: {
              caption: '@bot',
              contextInfo: { mentionedJid: ['999@s.whatsapp.net'] },
              mimetype: 'image/jpeg'
            }
          },
          messageTimestamp: 1700000002
        }
      ]
    };
    realSock.ev.emit('messages.upsert', upsert);
    for (let i = 0; i < 50; i++) {
      if (onMessage.mock.calls.length > 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(onMessage).toHaveBeenCalledTimes(1);
    const msg = onMessage.mock.calls[0][0];
    expect(msg.chatType).toBe('group');
    expect(msg.mentionedJids).toEqual(['999@s.whatsapp.net']);
    await listener.close();
  });
  it('passes mediaMaxMb to saveMediaBuffer', async () => {
    const onMessage = vi.fn();
    const listener = await monitorWebInbox({
      verbose: false,
      onMessage,
      mediaMaxMb: 1
    });
    const { createWaSocket } = await import('./session.js');
    const realSock = await createWaSocket();
    const upsert = {
      type: 'notify',
      messages: [
        {
          key: { id: 'img3', fromMe: false, remoteJid: '222@s.whatsapp.net' },
          message: { imageMessage: { mimetype: 'image/jpeg' } },
          messageTimestamp: 1700000003
        }
      ]
    };
    realSock.ev.emit('messages.upsert', upsert);
    for (let i = 0; i < 50; i++) {
      if (onMessage.mock.calls.length > 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(saveMediaBufferSpy).toHaveBeenCalled();
    const lastCall = saveMediaBufferSpy.mock.calls.at(-1);
    expect(lastCall?.[3]).toBe(1 * 1024 * 1024);
    await listener.close();
  });
});
