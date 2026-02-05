import { beforeEach, describe, expect, it, vi } from 'vitest';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const execFileMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({
  execFile: execFileMock
}));
import { isSystemdUserServiceAvailable } from './systemd.js';
describe('systemd availability', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });
  it('returns true when systemctl --user succeeds', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '', '');
    });
    await expect(isSystemdUserServiceAvailable()).resolves.toBe(true);
  });
  it('returns false when systemd user bus is unavailable', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      const err = new Error('Failed to connect to bus');
      err.stderr = 'Failed to connect to bus';
      err.code = 1;
      cb(err, '', '');
    });
    await expect(isSystemdUserServiceAvailable()).resolves.toBe(false);
  });
});
