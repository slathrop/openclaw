import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/web/media.js', () => ({
  loadWebMedia: vi.fn(async () => ({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
    kind: 'image',
    fileName: 'img.jpg'
  }))
}));
import { defaultRuntime } from '../src/runtime.js';
import { deliverWebReply } from '../src/web/auto-reply.js';
const noopLogger = {
  info: vi.fn(),
  warn: vi.fn()
};
function makeMsg() {
  const reply = vi.fn();
  const sendMedia = vi.fn();
  const sendComposing = vi.fn();
  return {
    from: '+10000000000',
    conversationId: '+10000000000',
    to: '+20000000000',
    id: 'abc',
    body: 'hello',
    chatType: 'direct',
    chatId: 'chat-1',
    sendComposing,
    reply,
    sendMedia
  };
}
describe('deliverWebReply retry', () => {
  it('retries text send on transient failure', async () => {
    const msg = makeMsg();
    msg.reply.mockRejectedValueOnce(new Error('connection closed'));
    msg.reply.mockResolvedValueOnce(void 0);
    await expect(
      deliverWebReply({
        replyResult: { text: 'hi' },
        msg,
        maxMediaBytes: 5e6,
        replyLogger: noopLogger,
        runtime: defaultRuntime,
        skipLog: true
      })
    ).resolves.toBeUndefined();
    expect(msg.reply).toHaveBeenCalledTimes(2);
  });
  it('retries media send on transient failure', async () => {
    const msg = makeMsg();
    msg.sendMedia.mockRejectedValueOnce(new Error('socket reset'));
    msg.sendMedia.mockResolvedValueOnce(void 0);
    await expect(
      deliverWebReply({
        replyResult: {
          text: 'caption',
          mediaUrl: 'http://example.com/img.jpg'
        },
        msg,
        maxMediaBytes: 5e6,
        replyLogger: noopLogger,
        runtime: defaultRuntime,
        skipLog: true
      })
    ).resolves.toBeUndefined();
    expect(msg.sendMedia).toHaveBeenCalledTimes(2);
  });
});
