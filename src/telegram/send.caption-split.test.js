const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { botApi, botCtorSpy } = vi.hoisted(() => ({
  botApi: {
    sendMessage: vi.fn(),
    sendPhoto: vi.fn()
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
const { loadConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({}))
}));
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig
  };
});
import { sendMessageTelegram } from './send.js';
describe('sendMessageTelegram caption splitting', () => {
  beforeEach(() => {
    loadConfig.mockReturnValue({});
    loadWebMedia.mockReset();
    botApi.sendMessage.mockReset();
    botApi.sendPhoto.mockReset();
    botCtorSpy.mockReset();
  });
  it('splits long captions into media + text messages when text exceeds 1024 chars', async () => {
    const chatId = '123';
    const longText = 'A'.repeat(1100);
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 70,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 71,
      chat: { id: chatId }
    });
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    const res = await sendMessageTelegram(chatId, longText, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg'
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: void 0
    });
    expect(sendMessage).toHaveBeenCalledWith(chatId, longText, {
      parse_mode: 'HTML'
    });
    expect(res.messageId).toBe('71');
  });
  it('uses caption when text is within 1024 char limit', async () => {
    const chatId = '123';
    const shortText = 'B'.repeat(1024);
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 72,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn();
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    const res = await sendMessageTelegram(chatId, shortText, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg'
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: shortText,
      parse_mode: 'HTML'
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.messageId).toBe('72');
  });
  it('renders markdown in media captions', async () => {
    const chatId = '123';
    const caption = 'hi **boss**';
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 90,
      chat: { id: chatId }
    });
    const api = { sendPhoto };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await sendMessageTelegram(chatId, caption, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg'
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: 'hi <b>boss</b>',
      parse_mode: 'HTML'
    });
  });
  it('preserves thread params when splitting long captions', async () => {
    const chatId = '-1001234567890';
    const longText = 'C'.repeat(1100);
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 73,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 74,
      chat: { id: chatId }
    });
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await sendMessageTelegram(chatId, longText, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg',
      messageThreadId: 271,
      replyToMessageId: 500
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: void 0,
      message_thread_id: 271,
      reply_to_message_id: 500
    });
    expect(sendMessage).toHaveBeenCalledWith(chatId, longText, {
      parse_mode: 'HTML',
      message_thread_id: 271,
      reply_to_message_id: 500
    });
  });
  it('puts reply_markup only on follow-up text when splitting', async () => {
    const chatId = '123';
    const longText = 'D'.repeat(1100);
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 75,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 76,
      chat: { id: chatId }
    });
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await sendMessageTelegram(chatId, longText, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg',
      buttons: [[{ text: 'Click me', callback_data: 'action:click' }]]
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: void 0
    });
    expect(sendMessage).toHaveBeenCalledWith(chatId, longText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Click me', callback_data: 'action:click' }]]
      }
    });
  });
  it('includes thread params and reply_markup on follow-up text when splitting', async () => {
    const chatId = '-1001234567890';
    const longText = 'F'.repeat(1100);
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 78,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 79,
      chat: { id: chatId }
    });
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await sendMessageTelegram(chatId, longText, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg',
      messageThreadId: 271,
      replyToMessageId: 500,
      buttons: [[{ text: 'Click me', callback_data: 'action:click' }]]
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: void 0,
      message_thread_id: 271,
      reply_to_message_id: 500
    });
    expect(sendMessage).toHaveBeenCalledWith(chatId, longText, {
      parse_mode: 'HTML',
      message_thread_id: 271,
      reply_to_message_id: 500,
      reply_markup: {
        inline_keyboard: [[{ text: 'Click me', callback_data: 'action:click' }]]
      }
    });
  });
  it('wraps chat-not-found errors from follow-up message', async () => {
    const chatId = '123';
    const longText = 'G'.repeat(1100);
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 80,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn().mockRejectedValue(new Error('400: Bad Request: chat not found'));
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await expect(
      sendMessageTelegram(chatId, longText, {
        token: 'tok',
        api,
        mediaUrl: 'https://example.com/photo.jpg'
      })
    ).rejects.toThrow(/Telegram send failed: chat not found \(chat_id=123\)\./);
  });
  it('does not send follow-up text when caption is empty', async () => {
    const chatId = '123';
    const emptyText = '   ';
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 81,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn();
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    const res = await sendMessageTelegram(chatId, emptyText, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg'
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: void 0
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.messageId).toBe('81');
  });
  it('keeps reply_markup on media when not splitting', async () => {
    const chatId = '123';
    const shortText = 'E'.repeat(100);
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 77,
      chat: { id: chatId }
    });
    const sendMessage = vi.fn();
    const api = { sendPhoto, sendMessage };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await sendMessageTelegram(chatId, shortText, {
      token: 'tok',
      api,
      mediaUrl: 'https://example.com/photo.jpg',
      buttons: [[{ text: 'Click me', callback_data: 'action:click' }]]
    });
    expect(sendPhoto).toHaveBeenCalledWith(chatId, expect.anything(), {
      caption: shortText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Click me', callback_data: 'action:click' }]]
      }
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
