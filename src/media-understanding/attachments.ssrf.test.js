import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaAttachmentCache } from './attachments.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const originalFetch = globalThis.fetch;
describe('media understanding attachments SSRF', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });
  it('blocks private IP URLs before fetching', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const cache = new MediaAttachmentCache([{ index: 0, url: 'http://127.0.0.1/secret.jpg' }]);
    await expect(
      cache.getBuffer({ attachmentIndex: 0, maxBytes: 1024, timeoutMs: 1e3 })
    ).rejects.toThrow(/private|internal|blocked/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
