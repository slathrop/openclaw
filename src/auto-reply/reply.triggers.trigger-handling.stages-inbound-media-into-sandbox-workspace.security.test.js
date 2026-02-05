import fs from 'node:fs/promises';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTempHome as withTempHomeBase } from '../../test/helpers/temp-home.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const sandboxMocks = vi.hoisted(() => ({
  ensureSandboxWorkspaceForSession: vi.fn()
}));
vi.mock('../agents/sandbox.js', () => sandboxMocks);
import { ensureSandboxWorkspaceForSession } from '../agents/sandbox.js';
import { stageSandboxMedia } from './reply/stage-sandbox-media.js';
async function withTempHome(fn) {
  return withTempHomeBase(async (home) => await fn(home), { prefix: 'openclaw-triggers-bypass-' });
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe('stageSandboxMedia security', () => {
  it('rejects staging host files from outside the media directory', async () => {
    await withTempHome(async (home) => {
      const sensitiveFile = join(home, 'secrets.txt');
      await fs.writeFile(sensitiveFile, 'SENSITIVE DATA');
      const sandboxDir = join(home, 'sandboxes', 'session');
      vi.mocked(ensureSandboxWorkspaceForSession).mockResolvedValue({
        workspaceDir: sandboxDir,
        containerWorkdir: '/work'
      });
      const ctx = {
        Body: 'hi',
        From: 'whatsapp:group:demo',
        To: '+2000',
        ChatType: 'group',
        Provider: 'whatsapp',
        MediaPath: sensitiveFile,
        MediaType: 'image/jpeg',
        MediaUrl: sensitiveFile
      };
      const sessionCtx = { ...ctx };
      await stageSandboxMedia({
        ctx,
        sessionCtx,
        cfg: {
          agents: {
            defaults: {
              model: 'anthropic/claude-opus-4-5',
              workspace: join(home, 'openclaw'),
              sandbox: {
                mode: 'non-main',
                workspaceRoot: join(home, 'sandboxes')
              }
            }
          },
          channels: { whatsapp: { allowFrom: ['*'] } },
          session: { store: join(home, 'sessions.json') }
        },
        sessionKey: 'agent:main:main',
        workspaceDir: join(home, 'openclaw')
      });
      const stagedFullPath = join(sandboxDir, 'media', 'inbound', basename(sensitiveFile));
      await expect(fs.stat(stagedFullPath)).rejects.toThrow();
      expect(ctx.MediaPath).toBe(sensitiveFile);
    });
  });
});
