import { vi } from 'vitest';
import { createMockBaileys } from '../../test/mocks/baileys.js';
const CONFIG_KEY = /* @__PURE__ */ Symbol.for('openclaw:testConfigMock');
const DEFAULT_CONFIG = {
  channels: {
    whatsapp: {
      // Tests can override; default remains open to avoid surprising fixtures
      allowFrom: ['*']
    }
  },
  messages: {
    messagePrefix: void 0,
    responsePrefix: void 0
  }
};
if (!globalThis[CONFIG_KEY]) {
  globalThis[CONFIG_KEY] = () => DEFAULT_CONFIG;
}
function setLoadConfigMock(fn) {
  globalThis[CONFIG_KEY] = typeof fn === 'function' ? fn : () => fn;
}
function resetLoadConfigMock() {
  globalThis[CONFIG_KEY] = () => DEFAULT_CONFIG;
}
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: () => {
      const getter = globalThis[CONFIG_KEY];
      if (typeof getter === 'function') {
        return getter();
      }
      return DEFAULT_CONFIG;
    }
  };
});
vi.mock('../media/store.js', () => ({
  saveMediaBuffer: vi.fn().mockImplementation(async (_buf, contentType) => ({
    id: 'mid',
    path: '/tmp/mid',
    size: _buf.length,
    contentType
  }))
}));
vi.mock('@whiskeysockets/baileys', () => {
  const created = createMockBaileys();
  globalThis[/* @__PURE__ */ Symbol.for('openclaw:lastSocket')] = created.lastSocket;
  return created.mod;
});
vi.mock('qrcode-terminal', () => ({
  default: { generate: vi.fn() },
  generate: vi.fn()
}));
const baileys = await import('@whiskeysockets/baileys');
function resetBaileysMocks() {
  const recreated = createMockBaileys();
  globalThis[/* @__PURE__ */ Symbol.for('openclaw:lastSocket')] = recreated.lastSocket;
  baileys.makeWASocket = vi.fn(recreated.mod.makeWASocket);
  baileys.useMultiFileAuthState = vi.fn(recreated.mod.useMultiFileAuthState);
  baileys.fetchLatestBaileysVersion = vi.fn(recreated.mod.fetchLatestBaileysVersion);
  baileys.makeCacheableSignalKeyStore = vi.fn(recreated.mod.makeCacheableSignalKeyStore);
}
function getLastSocket() {
  const getter = globalThis[/* @__PURE__ */ Symbol.for('openclaw:lastSocket')];
  if (typeof getter === 'function') {
    return getter();
  }
  if (!getter) {
    throw new Error('Baileys mock not initialized');
  }
  throw new Error('Invalid Baileys socket getter');
}
export {
  baileys,
  getLastSocket,
  resetBaileysMocks,
  resetLoadConfigMock,
  setLoadConfigMock
};
