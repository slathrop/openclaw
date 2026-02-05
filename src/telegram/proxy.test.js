import { describe, expect, it, vi } from 'vitest';
const { ProxyAgent, undiciFetch, proxyAgentSpy, getLastAgent } = vi.hoisted(() => {
  const undiciFetch2 = vi.fn();
  const proxyAgentSpy2 = vi.fn();
  class ProxyAgent2 {
    static lastCreated;
    proxyUrl;
    constructor(proxyUrl) {
      this.proxyUrl = proxyUrl;
      ProxyAgent2.lastCreated = this;
      proxyAgentSpy2(proxyUrl);
    }
  }
  return {
    ProxyAgent: ProxyAgent2,
    undiciFetch: undiciFetch2,
    proxyAgentSpy: proxyAgentSpy2,
    getLastAgent: () => ProxyAgent2.lastCreated
  };
});
vi.mock('undici', () => ({
  ProxyAgent,
  fetch: undiciFetch
}));
import { makeProxyFetch } from './proxy.js';
describe('makeProxyFetch', () => {
  it('uses undici fetch with ProxyAgent dispatcher', async () => {
    const proxyUrl = 'http://proxy.test:8080';
    undiciFetch.mockResolvedValue({ ok: true });
    const proxyFetch = makeProxyFetch(proxyUrl);
    await proxyFetch('https://api.telegram.org/bot123/getMe');
    expect(proxyAgentSpy).toHaveBeenCalledWith(proxyUrl);
    expect(undiciFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bot123/getMe',
      expect.objectContaining({ dispatcher: getLastAgent() })
    );
  });
});
