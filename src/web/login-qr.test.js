import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./session.js', () => {
  const createWaSocket2 = vi.fn(
    async (_printQr, _verbose, opts) => {
      const sock = { ws: { close: vi.fn() } };
      if (opts?.onQr) {
        setImmediate(() => opts.onQr?.('qr-data'));
      }
      return sock;
    }
  );
  const waitForWaConnection2 = vi.fn();
  const formatError = vi.fn((err) => `formatted:${String(err)}`);
  const getStatusCode = vi.fn(
    (err) => err?.output?.statusCode ?? err?.status
  );
  const webAuthExists = vi.fn(async () => false);
  const readWebSelfId = vi.fn(() => ({ e164: null, jid: null }));
  const logoutWeb2 = vi.fn(async () => true);
  return {
    createWaSocket: createWaSocket2,
    waitForWaConnection: waitForWaConnection2,
    formatError,
    getStatusCode,
    webAuthExists,
    readWebSelfId,
    logoutWeb: logoutWeb2
  };
});
vi.mock('./qr-image.js', () => ({
  renderQrPngBase64: vi.fn(async () => 'base64')
}));
const { startWebLoginWithQr, waitForWebLogin } = await import('./login-qr.js');
const { createWaSocket, waitForWaConnection, logoutWeb } = await import('./session.js');
describe('login-qr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('restarts login once on status 515 and completes', async () => {
    waitForWaConnection.mockRejectedValueOnce({ output: { statusCode: 515 } }).mockResolvedValueOnce(void 0);
    const start = await startWebLoginWithQr({ timeoutMs: 5e3 });
    expect(start.qrDataUrl).toBe('data:image/png;base64,base64');
    const result = await waitForWebLogin({ timeoutMs: 5e3 });
    expect(result.connected).toBe(true);
    expect(createWaSocket).toHaveBeenCalledTimes(2);
    expect(logoutWeb).not.toHaveBeenCalled();
  });
});
