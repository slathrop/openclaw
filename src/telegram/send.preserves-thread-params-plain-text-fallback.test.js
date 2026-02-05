const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { describe, expect, it, vi } from 'vitest';
const { botApi, botCtorSpy } = vi.hoisted(() => ({
  botApi: {
    sendMessage: vi.fn(),
    setMessageReaction: vi.fn()
  },
  botCtorSpy: vi.fn()
}));
const { loadWebMedia } = vi.hoisted(() => ({
  loadWebMedia: vi.fn()
}));
vi.mock('../web/media.js', () => ({
  loadWebMedia
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
import { reactMessageTelegram, sendMessageTelegram } from './send.js';
describe('buildInlineKeyboard', () => {
  it('preserves thread params in plain text fallback', async () => {
    const chatId = '-1001234567890';
    const parseErr = new Error(
      "400: Bad Request: can't parse entities: Can't find end of the entity"
    );
    const sendMessage = vi.fn().mockRejectedValueOnce(parseErr).mockResolvedValueOnce({
      message_id: 60,
      chat: { id: chatId }
    });
    const api = { sendMessage };
    const res = await sendMessageTelegram(chatId, '_bad markdown_', {
      token: 'tok',
      api,
      messageThreadId: 271,
      replyToMessageId: 100
    });
    expect(sendMessage).toHaveBeenNthCalledWith(1, chatId, '<i>bad markdown</i>', {
      parse_mode: 'HTML',
      message_thread_id: 271,
      reply_to_message_id: 100
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, chatId, '_bad markdown_', {
      message_thread_id: 271,
      reply_to_message_id: 100
    });
    expect(res.messageId).toBe('60');
  });
  it('includes thread params in media messages', async () => {
    const chatId = '-1001234567890';
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 58,
      chat: { id: chatId }
    });
    const api = { sendPhoto };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await sendMessageTelegram(chatId, 'photo in topic', {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg',
      messageThreadId: 99
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: 'photo in topic',
      parse_mode: 'HTML',
      message_thread_id: 99
    });
  });
});
describe('reactMessageTelegram', () => {
  it('sends emoji reactions', async () => {
    const setMessageReaction = vi.fn().mockResolvedValue(void 0);
    const api = { setMessageReaction };
    await reactMessageTelegram('telegram:123', '456', '\u2705', {
      token: 'tok',
      api
    });
    expect(setMessageReaction).toHaveBeenCalledWith('123', 456, [{ type: 'emoji', emoji: '\u2705' }]);
  });
  it('removes reactions when emoji is empty', async () => {
    const setMessageReaction = vi.fn().mockResolvedValue(void 0);
    const api = { setMessageReaction };
    await reactMessageTelegram('123', 456, '', {
      token: 'tok',
      api
    });
    expect(setMessageReaction).toHaveBeenCalledWith('123', 456, []);
  });
  it('removes reactions when remove flag is set', async () => {
    const setMessageReaction = vi.fn().mockResolvedValue(void 0);
    const api = { setMessageReaction };
    await reactMessageTelegram('123', 456, '\u2705', {
      token: 'tok',
      api,
      remove: true
    });
    expect(setMessageReaction).toHaveBeenCalledWith('123', 456, []);
  });
});
