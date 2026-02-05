import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ssrf from '../../infra/net/ssrf.js';
const originalFetch = globalThis.fetch;
let mockFetch;
describe('fetchWithSlackAuth', () => {
  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });
  it('sends Authorization header on initial request with manual redirect', async () => {
    const { fetchWithSlackAuth } = await import('./media.js');
    const mockResponse = new Response(Buffer.from('image data'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' }
    });
    mockFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchWithSlackAuth('https://files.slack.com/test.jpg', 'xoxb-test-token');
    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://files.slack.com/test.jpg', {
      headers: { Authorization: 'Bearer xoxb-test-token' },
      redirect: 'manual'
    });
  });
  it('rejects non-Slack hosts to avoid leaking tokens', async () => {
    const { fetchWithSlackAuth } = await import('./media.js');
    await expect(
      fetchWithSlackAuth('https://example.com/test.jpg', 'xoxb-test-token')
    ).rejects.toThrow(/non-Slack host|non-Slack/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('follows redirects without Authorization header', async () => {
    const { fetchWithSlackAuth } = await import('./media.js');
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: 'https://cdn.slack-edge.com/presigned-url?sig=abc123' }
    });
    const fileResponse = new Response(Buffer.from('actual image data'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' }
    });
    mockFetch.mockResolvedValueOnce(redirectResponse).mockResolvedValueOnce(fileResponse);
    const result = await fetchWithSlackAuth('https://files.slack.com/test.jpg', 'xoxb-test-token');
    expect(result).toBe(fileResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://files.slack.com/test.jpg', {
      headers: { Authorization: 'Bearer xoxb-test-token' },
      redirect: 'manual'
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://cdn.slack-edge.com/presigned-url?sig=abc123',
      { redirect: 'follow' }
    );
  });
  it('handles relative redirect URLs', async () => {
    const { fetchWithSlackAuth } = await import('./media.js');
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: '/files/redirect-target' }
    });
    const fileResponse = new Response(Buffer.from('image data'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' }
    });
    mockFetch.mockResolvedValueOnce(redirectResponse).mockResolvedValueOnce(fileResponse);
    await fetchWithSlackAuth('https://files.slack.com/original.jpg', 'xoxb-test-token');
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://files.slack.com/files/redirect-target', {
      redirect: 'follow'
    });
  });
  it('returns redirect response when no location header is provided', async () => {
    const { fetchWithSlackAuth } = await import('./media.js');
    const redirectResponse = new Response(null, {
      status: 302
      // No location header
    });
    mockFetch.mockResolvedValueOnce(redirectResponse);
    const result = await fetchWithSlackAuth('https://files.slack.com/test.jpg', 'xoxb-test-token');
    expect(result).toBe(redirectResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it('returns 4xx/5xx responses directly without following', async () => {
    const { fetchWithSlackAuth } = await import('./media.js');
    const errorResponse = new Response('Not Found', {
      status: 404
    });
    mockFetch.mockResolvedValueOnce(errorResponse);
    const result = await fetchWithSlackAuth('https://files.slack.com/test.jpg', 'xoxb-test-token');
    expect(result).toBe(errorResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it('handles 301 permanent redirects', async () => {
    const { fetchWithSlackAuth } = await import('./media.js');
    const redirectResponse = new Response(null, {
      status: 301,
      headers: { location: 'https://cdn.slack.com/new-url' }
    });
    const fileResponse = new Response(Buffer.from('image data'), {
      status: 200
    });
    mockFetch.mockResolvedValueOnce(redirectResponse).mockResolvedValueOnce(fileResponse);
    await fetchWithSlackAuth('https://files.slack.com/test.jpg', 'xoxb-test-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://cdn.slack.com/new-url', {
      redirect: 'follow'
    });
  });
});
describe('resolveSlackMedia', () => {
  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    vi.spyOn(ssrf, 'resolvePinnedHostname').mockImplementation(async (hostname) => {
      const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
      const addresses = ['93.184.216.34'];
      return {
        hostname: normalized,
        addresses,
        lookup: ssrf.createPinnedLookup({ hostname: normalized, addresses })
      };
    });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
    vi.restoreAllMocks();
  });
  it('prefers url_private_download over url_private', async () => {
    vi.doMock('../../media/store.js', () => ({
      saveMediaBuffer: vi.fn().mockResolvedValue({
        path: '/tmp/test.jpg',
        contentType: 'image/jpeg'
      })
    }));
    const { resolveSlackMedia } = await import('./media.js');
    const mockResponse = new Response(Buffer.from('image data'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' }
    });
    mockFetch.mockResolvedValueOnce(mockResponse);
    await resolveSlackMedia({
      files: [
        {
          url_private: 'https://files.slack.com/private.jpg',
          url_private_download: 'https://files.slack.com/download.jpg',
          name: 'test.jpg'
        }
      ],
      token: 'xoxb-test-token',
      maxBytes: 1024 * 1024
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://files.slack.com/download.jpg',
      expect.anything()
    );
  });
  it('returns null when download fails', async () => {
    const { resolveSlackMedia } = await import('./media.js');
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await resolveSlackMedia({
      files: [{ url_private: 'https://files.slack.com/test.jpg', name: 'test.jpg' }],
      token: 'xoxb-test-token',
      maxBytes: 1024 * 1024
    });
    expect(result).toBeNull();
  });
  it('returns null when no files are provided', async () => {
    const { resolveSlackMedia } = await import('./media.js');
    const result = await resolveSlackMedia({
      files: [],
      token: 'xoxb-test-token',
      maxBytes: 1024 * 1024
    });
    expect(result).toBeNull();
  });
  it('skips files without url_private', async () => {
    const { resolveSlackMedia } = await import('./media.js');
    const result = await resolveSlackMedia({
      files: [{ name: 'test.jpg' }],
      // No url_private
      token: 'xoxb-test-token',
      maxBytes: 1024 * 1024
    });
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('falls through to next file when first file returns error', async () => {
    vi.doMock('../../media/store.js', () => ({
      saveMediaBuffer: vi.fn().mockResolvedValue({
        path: '/tmp/test.jpg',
        contentType: 'image/jpeg'
      })
    }));
    const { resolveSlackMedia } = await import('./media.js');
    const errorResponse = new Response('Not Found', { status: 404 });
    const successResponse = new Response(Buffer.from('image data'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' }
    });
    mockFetch.mockResolvedValueOnce(errorResponse).mockResolvedValueOnce(successResponse);
    const result = await resolveSlackMedia({
      files: [
        { url_private: 'https://files.slack.com/first.jpg', name: 'first.jpg' },
        { url_private: 'https://files.slack.com/second.jpg', name: 'second.jpg' }
      ],
      token: 'xoxb-test-token',
      maxBytes: 1024 * 1024
    });
    expect(result).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
