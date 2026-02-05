import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverReplies } from './delivery.js';
const loadWebMedia = vi.fn();
vi.mock('../../web/media.js', () => ({
  loadWebMedia: (...args) => loadWebMedia(...args)
}));
vi.mock('grammy', () => ({
  InputFile: class {
    constructor(buffer, fileName) {
      this.buffer = buffer;
      this.fileName = fileName;
    }
  },
  GrammyError: class GrammyError extends Error {
    description = '';
  }
}));
describe('deliverReplies', () => {
  beforeEach(() => {
    loadWebMedia.mockReset();
  });
  it('skips audioAsVoice-only payloads without logging an error', async () => {
    const runtime = { error: vi.fn() };
    const bot = { api: {} };
    await deliverReplies({
      replies: [{ audioAsVoice: true }],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'off',
      textLimit: 4e3
    });
    expect(runtime.error).not.toHaveBeenCalled();
  });
  it('invokes onVoiceRecording before sending a voice note', async () => {
    const events = [];
    const runtime = { error: vi.fn() };
    const sendVoice = vi.fn(async () => {
      events.push('sendVoice');
      return { message_id: 1, chat: { id: '123' } };
    });
    const bot = { api: { sendVoice } };
    const onVoiceRecording = vi.fn(async () => {
      events.push('recordVoice');
    });
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('voice'),
      contentType: 'audio/ogg',
      fileName: 'note.ogg'
    });
    await deliverReplies({
      replies: [{ mediaUrl: 'https://example.com/note.ogg', audioAsVoice: true }],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'off',
      textLimit: 4e3,
      onVoiceRecording
    });
    expect(onVoiceRecording).toHaveBeenCalledTimes(1);
    expect(sendVoice).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['recordVoice', 'sendVoice']);
  });
  it('renders markdown in media captions', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendPhoto = vi.fn().mockResolvedValue({
      message_id: 2,
      chat: { id: '123' }
    });
    const bot = { api: { sendPhoto } };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('image'),
      contentType: 'image/jpeg',
      fileName: 'photo.jpg'
    });
    await deliverReplies({
      replies: [{ mediaUrl: 'https://example.com/photo.jpg', text: 'hi **boss**' }],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'off',
      textLimit: 4e3
    });
    expect(sendPhoto).toHaveBeenCalledWith(
      '123',
      expect.anything(),
      expect.objectContaining({
        caption: 'hi <b>boss</b>',
        parse_mode: 'HTML'
      })
    );
  });
  it('includes link_preview_options when linkPreview is false', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 3,
      chat: { id: '123' }
    });
    const bot = { api: { sendMessage } };
    await deliverReplies({
      replies: [{ text: 'Check https://example.com' }],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'off',
      textLimit: 4e3,
      linkPreview: false
    });
    expect(sendMessage).toHaveBeenCalledWith(
      '123',
      expect.any(String),
      expect.objectContaining({
        link_preview_options: { is_disabled: true }
      })
    );
  });
  it('keeps message_thread_id=1 when allowed', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 4,
      chat: { id: '123' }
    });
    const bot = { api: { sendMessage } };
    await deliverReplies({
      replies: [{ text: 'Hello' }],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'off',
      textLimit: 4e3,
      thread: { id: 1, scope: 'dm' }
    });
    expect(sendMessage).toHaveBeenCalledWith(
      '123',
      expect.any(String),
      expect.objectContaining({
        message_thread_id: 1
      })
    );
  });
  it('does not include link_preview_options when linkPreview is true', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 4,
      chat: { id: '123' }
    });
    const bot = { api: { sendMessage } };
    await deliverReplies({
      replies: [{ text: 'Check https://example.com' }],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'off',
      textLimit: 4e3,
      linkPreview: true
    });
    expect(sendMessage).toHaveBeenCalledWith(
      '123',
      expect.any(String),
      expect.not.objectContaining({
        link_preview_options: expect.anything()
      })
    );
  });
  it('uses reply_parameters when quote text is provided', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 10,
      chat: { id: '123' }
    });
    const bot = { api: { sendMessage } };
    await deliverReplies({
      replies: [{ text: 'Hello there', replyToId: '500' }],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'all',
      textLimit: 4e3,
      replyQuoteText: 'quoted text'
    });
    expect(sendMessage).toHaveBeenCalledWith(
      '123',
      expect.any(String),
      expect.objectContaining({
        reply_parameters: {
          message_id: 500,
          quote: 'quoted text'
        }
      })
    );
  });
  it('falls back to text when sendVoice fails with VOICE_MESSAGES_FORBIDDEN', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendVoice = vi.fn().mockRejectedValue(
      new Error(
        "GrammyError: Call to 'sendVoice' failed! (400: Bad Request: VOICE_MESSAGES_FORBIDDEN)"
      )
    );
    const sendMessage = vi.fn().mockResolvedValue({
      message_id: 5,
      chat: { id: '123' }
    });
    const bot = { api: { sendVoice, sendMessage } };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('voice'),
      contentType: 'audio/ogg',
      fileName: 'note.ogg'
    });
    await deliverReplies({
      replies: [
        { mediaUrl: 'https://example.com/note.ogg', text: 'Hello there', audioAsVoice: true }
      ],
      chatId: '123',
      token: 'tok',
      runtime,
      bot,
      replyToMode: 'off',
      textLimit: 4e3
    });
    expect(sendVoice).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      '123',
      expect.stringContaining('Hello there'),
      expect.any(Object)
    );
  });
  it('rethrows non-VOICE_MESSAGES_FORBIDDEN errors from sendVoice', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendVoice = vi.fn().mockRejectedValue(new Error('Network error'));
    const sendMessage = vi.fn();
    const bot = { api: { sendVoice, sendMessage } };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('voice'),
      contentType: 'audio/ogg',
      fileName: 'note.ogg'
    });
    await expect(
      deliverReplies({
        replies: [{ mediaUrl: 'https://example.com/note.ogg', text: 'Hello', audioAsVoice: true }],
        chatId: '123',
        token: 'tok',
        runtime,
        bot,
        replyToMode: 'off',
        textLimit: 4e3
      })
    ).rejects.toThrow('Network error');
    expect(sendVoice).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it('rethrows VOICE_MESSAGES_FORBIDDEN when no text fallback is available', async () => {
    const runtime = { error: vi.fn(), log: vi.fn() };
    const sendVoice = vi.fn().mockRejectedValue(
      new Error(
        "GrammyError: Call to 'sendVoice' failed! (400: Bad Request: VOICE_MESSAGES_FORBIDDEN)"
      )
    );
    const sendMessage = vi.fn();
    const bot = { api: { sendVoice, sendMessage } };
    loadWebMedia.mockResolvedValueOnce({
      buffer: Buffer.from('voice'),
      contentType: 'audio/ogg',
      fileName: 'note.ogg'
    });
    await expect(
      deliverReplies({
        replies: [{ mediaUrl: 'https://example.com/note.ogg', audioAsVoice: true }],
        chatId: '123',
        token: 'tok',
        runtime,
        bot,
        replyToMode: 'off',
        textLimit: 4e3
      })
    ).rejects.toThrow('VOICE_MESSAGES_FORBIDDEN');
    expect(sendVoice).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
