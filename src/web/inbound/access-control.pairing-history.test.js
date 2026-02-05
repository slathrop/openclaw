import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInboundAccessControl } from './access-control.js';
const sendMessageMock = vi.fn();
const readAllowFromStoreMock = vi.fn();
const upsertPairingRequestMock = vi.fn();
let config = {};
vi.mock('../../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: () => config
  };
});
vi.mock('../../pairing/pairing-store.js', () => ({
  readChannelAllowFromStore: (...args) => readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args) => upsertPairingRequestMock(...args)
}));
beforeEach(() => {
  config = {
    channels: {
      whatsapp: {
        dmPolicy: 'pairing',
        allowFrom: []
      }
    }
  };
  sendMessageMock.mockReset().mockResolvedValue(void 0);
  readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  upsertPairingRequestMock.mockReset().mockResolvedValue({ code: 'PAIRCODE', created: true });
});
describe('checkInboundAccessControl', () => {
  it('suppresses pairing replies for historical DMs on connect', async () => {
    const connectedAtMs = 1e6;
    const messageTimestampMs = connectedAtMs - 31e3;
    const result = await checkInboundAccessControl({
      accountId: 'default',
      from: '+15550001111',
      selfE164: '+15550009999',
      senderE164: '+15550001111',
      group: false,
      pushName: 'Sam',
      isFromMe: false,
      messageTimestampMs,
      connectedAtMs,
      pairingGraceMs: 3e4,
      sock: { sendMessage: sendMessageMock },
      remoteJid: '15550001111@s.whatsapp.net'
    });
    expect(result.allowed).toBe(false);
    expect(upsertPairingRequestMock).not.toHaveBeenCalled();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it('sends pairing replies for live DMs', async () => {
    const connectedAtMs = 1e6;
    const messageTimestampMs = connectedAtMs - 1e4;
    const result = await checkInboundAccessControl({
      accountId: 'default',
      from: '+15550001111',
      selfE164: '+15550009999',
      senderE164: '+15550001111',
      group: false,
      pushName: 'Sam',
      isFromMe: false,
      messageTimestampMs,
      connectedAtMs,
      pairingGraceMs: 3e4,
      sock: { sendMessage: sendMessageMock },
      remoteJid: '15550001111@s.whatsapp.net'
    });
    expect(result.allowed).toBe(false);
    expect(upsertPairingRequestMock).toHaveBeenCalled();
    expect(sendMessageMock).toHaveBeenCalled();
  });
});
