import { describe, expect, it } from 'vitest';
import { appendCdpPath, getHeadersWithAuth } from './cdp.helpers.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

describe('cdp.helpers', () => {
  it('preserves query params when appending CDP paths', () => {
    const url = appendCdpPath('https://example.com?token=abc', '/json/version');
    expect(url).toBe('https://example.com/json/version?token=abc');
  });
  it('appends paths under a base prefix', () => {
    const url = appendCdpPath('https://example.com/chrome/?token=abc', 'json/list');
    expect(url).toBe('https://example.com/chrome/json/list?token=abc');
  });
  it('adds basic auth headers when credentials are present', () => {
    const headers = getHeadersWithAuth('https://user:pass@example.com');
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`);
  });
  it('keeps preexisting authorization headers', () => {
    const headers = getHeadersWithAuth('https://user:pass@example.com', {
      Authorization: 'Bearer token'
    });
    expect(headers.Authorization).toBe('Bearer token');
  });
});
