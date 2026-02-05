import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { handleControlUiHttpRequest } from './control-ui.js';
const makeResponse = () => {
  const setHeader = vi.fn();
  const end = vi.fn();
  const res = {
    headersSent: false,
    statusCode: 200,
    setHeader,
    end
  };
  return { res, setHeader, end };
};
describe('handleControlUiHttpRequest', () => {
  it('sets anti-clickjacking headers for Control UI responses', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-ui-'));
    try {
      await fs.writeFile(path.join(tmp, 'index.html'), '<html></html>\n');
      const { res, setHeader } = makeResponse();
      const handled = handleControlUiHttpRequest(
        { url: '/', method: 'GET' },
        res,
        {
          root: { kind: 'resolved', path: tmp }
        }
      );
      expect(handled).toBe(true);
      expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(setHeader).toHaveBeenCalledWith('Content-Security-Policy', "frame-ancestors 'none'");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
