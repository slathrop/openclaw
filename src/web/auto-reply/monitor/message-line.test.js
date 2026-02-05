import { describe, expect, it } from 'vitest';
import { buildInboundLine } from './message-line.js';
describe('buildInboundLine', () => {
  it('prefixes group messages with sender', () => {
    const line = buildInboundLine({
      cfg: {
        agents: { defaults: { workspace: '/tmp/openclaw' } },
        channels: { whatsapp: { messagePrefix: '' } }
      },
      agentId: 'main',
      msg: {
        from: '123@g.us',
        conversationId: '123@g.us',
        to: '+15550009999',
        accountId: 'default',
        body: 'ping',
        timestamp: 17e11,
        chatType: 'group',
        chatId: '123@g.us',
        senderJid: '111@s.whatsapp.net',
        senderE164: '+15550001111',
        senderName: 'Bob',
        sendComposing: async () => void 0,
        reply: async () => void 0,
        sendMedia: async () => void 0
      }
    });
    expect(line).toContain('Bob (+15550001111):');
    expect(line).toContain('ping');
  });
});
