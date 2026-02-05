import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetLogger, setLoggerOverride } from '../../logging.js';
import { logsHandlers } from './logs.js';
const noop = () => false;
describe('logs.tail', () => {
  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
  });
  it('falls back to latest rolling log file when today is missing', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-logs-'));
    const older = path.join(tempDir, 'openclaw-2026-01-20.log');
    const newer = path.join(tempDir, 'openclaw-2026-01-21.log');
    await fs.writeFile(older, '{"msg":"old"}\n');
    await fs.writeFile(newer, '{"msg":"new"}\n');
    await fs.utimes(older, /* @__PURE__ */ new Date(0), /* @__PURE__ */ new Date(0));
    await fs.utimes(newer, /* @__PURE__ */ new Date(), /* @__PURE__ */ new Date());
    setLoggerOverride({ file: path.join(tempDir, 'openclaw-2026-01-22.log') });
    const respond = vi.fn();
    await logsHandlers['logs.tail']({
      params: {},
      respond,
      context: {},
      client: null,
      req: { id: 'req-1', type: 'req', method: 'logs.tail' },
      isWebchatConnect: noop
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        file: newer,
        lines: ['{"msg":"new"}']
      }),
      void 0
    );
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
