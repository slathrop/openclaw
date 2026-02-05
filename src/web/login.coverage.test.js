import { DisconnectReason } from '@whiskeysockets/baileys';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const rmMock = vi.spyOn(fs, 'rm');
const authDir = path.join(os.tmpdir(), 'wa-creds');
vi.mock('../config/config.js', () => ({
  loadConfig: () => ({
    channels: {
      whatsapp: {
        accounts: {
          default: { enabled: true, authDir }
        }
      }
    }
  })
}));
vi.mock('./session.js', () => {
  const sockA = { ws: { close: vi.fn() } };
  const sockB = { ws: { close: vi.fn() } };
  let call = 0;
  const createWaSocket2 = vi.fn(async () => call++ === 0 ? sockA : sockB);
  const waitForWaConnection2 = vi.fn();
  const formatError2 = vi.fn((err) => `formatted:${String(err)}`);
  return {
    createWaSocket: createWaSocket2,
    waitForWaConnection: waitForWaConnection2,
    formatError: formatError2,
    WA_WEB_AUTH_DIR: authDir,
    logoutWeb: vi.fn(async (params) => {
      await fs.rm(params.authDir ?? authDir, {
        recursive: true,
        force: true
      });
      return true;
    })
  };
});
const { createWaSocket, waitForWaConnection, formatError } = await import('./session.js');
const { loginWeb } = await import('./login.js');
describe('loginWeb coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    rmMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('restarts once when WhatsApp requests code 515', async () => {
    waitForWaConnection.mockRejectedValueOnce({ output: { statusCode: 515 } }).mockResolvedValueOnce(void 0);
    const runtime = { log: vi.fn(), error: vi.fn() };
    await loginWeb(false, waitForWaConnection, runtime);
    expect(createWaSocket).toHaveBeenCalledTimes(2);
    const firstSock = await createWaSocket.mock.results[0].value;
    expect(firstSock.ws.close).toHaveBeenCalled();
    vi.runAllTimers();
    const secondSock = await createWaSocket.mock.results[1].value;
    expect(secondSock.ws.close).toHaveBeenCalled();
  });
  it('clears creds and throws when logged out', async () => {
    waitForWaConnection.mockRejectedValueOnce({
      output: { statusCode: DisconnectReason.loggedOut }
    });
    await expect(loginWeb(false, waitForWaConnection)).rejects.toThrow(/cache cleared/i);
    expect(rmMock).toHaveBeenCalledWith(authDir, {
      recursive: true,
      force: true
    });
  });
  it('formats and rethrows generic errors', async () => {
    waitForWaConnection.mockRejectedValueOnce(new Error('boom'));
    await expect(loginWeb(false, waitForWaConnection)).rejects.toThrow(
      'formatted:Error: boom'
    );
    expect(formatError).toHaveBeenCalled();
  });
});
