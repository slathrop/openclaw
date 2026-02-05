import { describe, expect, it, vi } from 'vitest';
import { handleWhatsAppAction } from './whatsapp-actions.js';
const sendReactionWhatsApp = vi.fn(async () => void 0);
const sendPollWhatsApp = vi.fn(async () => ({ messageId: 'poll-1', toJid: 'jid-1' }));
vi.mock('../../web/outbound.js', () => ({
  sendReactionWhatsApp: (...args) => sendReactionWhatsApp(...args),
  sendPollWhatsApp: (...args) => sendPollWhatsApp(...args)
}));
const enabledConfig = {
  channels: { whatsapp: { actions: { reactions: true } } }
};
describe('handleWhatsAppAction', () => {
  it('adds reactions', async () => {
    await handleWhatsAppAction(
      {
        action: 'react',
        chatJid: '123@s.whatsapp.net',
        messageId: 'msg1',
        emoji: '\u2705'
      },
      enabledConfig
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith('123@s.whatsapp.net', 'msg1', '\u2705', {
      verbose: false,
      fromMe: void 0,
      participant: void 0,
      accountId: void 0
    });
  });
  it('removes reactions on empty emoji', async () => {
    await handleWhatsAppAction(
      {
        action: 'react',
        chatJid: '123@s.whatsapp.net',
        messageId: 'msg1',
        emoji: ''
      },
      enabledConfig
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith('123@s.whatsapp.net', 'msg1', '', {
      verbose: false,
      fromMe: void 0,
      participant: void 0,
      accountId: void 0
    });
  });
  it('removes reactions when remove flag set', async () => {
    await handleWhatsAppAction(
      {
        action: 'react',
        chatJid: '123@s.whatsapp.net',
        messageId: 'msg1',
        emoji: '\u2705',
        remove: true
      },
      enabledConfig
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith('123@s.whatsapp.net', 'msg1', '', {
      verbose: false,
      fromMe: void 0,
      participant: void 0,
      accountId: void 0
    });
  });
  it('passes account scope and sender flags', async () => {
    await handleWhatsAppAction(
      {
        action: 'react',
        chatJid: '123@s.whatsapp.net',
        messageId: 'msg1',
        emoji: '\u{1F389}',
        accountId: 'work',
        fromMe: true,
        participant: '999@s.whatsapp.net'
      },
      enabledConfig
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith('123@s.whatsapp.net', 'msg1', '\u{1F389}', {
      verbose: false,
      fromMe: true,
      participant: '999@s.whatsapp.net',
      accountId: 'work'
    });
  });
  it('respects reaction gating', async () => {
    const cfg = {
      channels: { whatsapp: { actions: { reactions: false } } }
    };
    await expect(
      handleWhatsAppAction(
        {
          action: 'react',
          chatJid: '123@s.whatsapp.net',
          messageId: 'msg1',
          emoji: '\u2705'
        },
        cfg
      )
    ).rejects.toThrow(/WhatsApp reactions are disabled/);
  });
});
