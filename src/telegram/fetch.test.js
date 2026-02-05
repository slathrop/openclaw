const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { afterEach, describe, expect, it, vi } from 'vitest';
describe('resolveTelegramFetch', () => {
  const originalFetch = globalThis.fetch;
  const loadModule = /* @__PURE__ */ __name(async () => {
    const setDefaultAutoSelectFamily = vi.fn();
    vi.resetModules();
    vi.doMock('node:net', () => ({
      setDefaultAutoSelectFamily
    }));
    const mod = await import('./fetch.js');
    return { resolveTelegramFetch: mod.resolveTelegramFetch, setDefaultAutoSelectFamily };
  }, 'loadModule');
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete globalThis.fetch;
    }
  });
  it('returns wrapped global fetch when available', async () => {
    const fetchMock = vi.fn(async () => ({}));
    globalThis.fetch = fetchMock;
    const { resolveTelegramFetch } = await loadModule();
    const resolved = resolveTelegramFetch();
    expect(resolved).toBeTypeOf('function');
  });
  it('prefers proxy fetch when provided', async () => {
    const fetchMock = vi.fn(async () => ({}));
    const { resolveTelegramFetch } = await loadModule();
    const resolved = resolveTelegramFetch(fetchMock);
    expect(resolved).toBeTypeOf('function');
  });
  it('honors env enable override', async () => {
    vi.stubEnv('OPENCLAW_TELEGRAM_ENABLE_AUTO_SELECT_FAMILY', '1');
    globalThis.fetch = vi.fn(async () => ({}));
    const { resolveTelegramFetch, setDefaultAutoSelectFamily } = await loadModule();
    resolveTelegramFetch();
    expect(setDefaultAutoSelectFamily).toHaveBeenCalledWith(true);
  });
  it('uses config override when provided', async () => {
    globalThis.fetch = vi.fn(async () => ({}));
    const { resolveTelegramFetch, setDefaultAutoSelectFamily } = await loadModule();
    resolveTelegramFetch(void 0, { network: { autoSelectFamily: true } });
    expect(setDefaultAutoSelectFamily).toHaveBeenCalledWith(true);
  });
  it('env disable override wins over config', async () => {
    vi.stubEnv('OPENCLAW_TELEGRAM_DISABLE_AUTO_SELECT_FAMILY', '1');
    globalThis.fetch = vi.fn(async () => ({}));
    const { resolveTelegramFetch, setDefaultAutoSelectFamily } = await loadModule();
    resolveTelegramFetch(void 0, { network: { autoSelectFamily: true } });
    expect(setDefaultAutoSelectFamily).toHaveBeenCalledWith(false);
  });
});
