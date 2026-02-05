const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { botApi, botCtorSpy } = vi.hoisted(() => ({
  botApi: {
    sendMessage: vi.fn(),
    setMessageReaction: vi.fn(),
    deleteMessage: vi.fn()
  },
  botCtorSpy: vi.fn()
}));
const { loadConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({}))
}));
const { makeProxyFetch } = vi.hoisted(() => ({
  makeProxyFetch: vi.fn()
}));
const { resolveTelegramFetch } = vi.hoisted(() => ({
  resolveTelegramFetch: vi.fn()
}));
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig
  };
});
vi.mock('./proxy.js', () => ({
  makeProxyFetch
}));
vi.mock('./fetch.js', () => ({
  resolveTelegramFetch
}));
vi.mock('grammy', () => ({
  Bot: class {
    constructor(token, options) {
      this.token = token;
      this.options = options;
      botCtorSpy(token, options);
    }
    static {
      __name(this, 'Bot');
    }
    api = botApi;
    catch = vi.fn();
  },
  InputFile: class {
    static {
      __name(this, 'InputFile');
    }
  }
}));
import { deleteMessageTelegram, reactMessageTelegram, sendMessageTelegram } from './send.js';
describe('telegram proxy client', () => {
  const proxyUrl = 'http://proxy.test:8080';
  beforeEach(() => {
    botApi.sendMessage.mockResolvedValue({ message_id: 1, chat: { id: '123' } });
    botApi.setMessageReaction.mockResolvedValue(void 0);
    botApi.deleteMessage.mockResolvedValue(true);
    botCtorSpy.mockReset();
    loadConfig.mockReturnValue({
      channels: { telegram: { accounts: { foo: { proxy: proxyUrl } } } }
    });
    makeProxyFetch.mockReset();
    resolveTelegramFetch.mockReset();
  });
  it('uses proxy fetch for sendMessage', async () => {
    const proxyFetch = vi.fn();
    const fetchImpl = vi.fn();
    makeProxyFetch.mockReturnValue(proxyFetch);
    resolveTelegramFetch.mockReturnValue(fetchImpl);
    await sendMessageTelegram('123', 'hi', { token: 'tok', accountId: 'foo' });
    expect(makeProxyFetch).toHaveBeenCalledWith(proxyUrl);
    expect(resolveTelegramFetch).toHaveBeenCalledWith(proxyFetch, { network: void 0 });
    expect(botCtorSpy).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        client: expect.objectContaining({ fetch: fetchImpl })
      })
    );
  });
  it('uses proxy fetch for reactions', async () => {
    const proxyFetch = vi.fn();
    const fetchImpl = vi.fn();
    makeProxyFetch.mockReturnValue(proxyFetch);
    resolveTelegramFetch.mockReturnValue(fetchImpl);
    await reactMessageTelegram('123', '456', '\u2705', { token: 'tok', accountId: 'foo' });
    expect(makeProxyFetch).toHaveBeenCalledWith(proxyUrl);
    expect(resolveTelegramFetch).toHaveBeenCalledWith(proxyFetch, { network: void 0 });
    expect(botCtorSpy).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        client: expect.objectContaining({ fetch: fetchImpl })
      })
    );
  });
  it('uses proxy fetch for deleteMessage', async () => {
    const proxyFetch = vi.fn();
    const fetchImpl = vi.fn();
    makeProxyFetch.mockReturnValue(proxyFetch);
    resolveTelegramFetch.mockReturnValue(fetchImpl);
    await deleteMessageTelegram('123', '456', { token: 'tok', accountId: 'foo' });
    expect(makeProxyFetch).toHaveBeenCalledWith(proxyUrl);
    expect(resolveTelegramFetch).toHaveBeenCalledWith(proxyFetch, { network: void 0 });
    expect(botCtorSpy).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        client: expect.objectContaining({ fetch: fetchImpl })
      })
    );
  });
});
