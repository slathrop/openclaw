const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const note = vi.hoisted(() => vi.fn());
vi.mock('../terminal/note.js', () => ({
  note
}));
vi.mock('../channels/plugins/index.js', () => ({
  listChannelPlugins: /* @__PURE__ */ __name(() => [], 'listChannelPlugins')
}));
import { noteSecurityWarnings } from './doctor-security.js';
describe('noteSecurityWarnings gateway exposure', () => {
  let prevToken;
  let prevPassword;
  beforeEach(() => {
    note.mockClear();
    prevToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    prevPassword = process.env.OPENCLAW_GATEWAY_PASSWORD;
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
    delete process.env.OPENCLAW_GATEWAY_PASSWORD;
  });
  afterEach(() => {
    if (prevToken === void 0) {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
    } else {
      process.env.OPENCLAW_GATEWAY_TOKEN = prevToken;
    }
    if (prevPassword === void 0) {
      delete process.env.OPENCLAW_GATEWAY_PASSWORD;
    } else {
      process.env.OPENCLAW_GATEWAY_PASSWORD = prevPassword;
    }
  });
  const lastMessage = /* @__PURE__ */ __name(() => String(note.mock.calls.at(-1)?.[0] ?? ''), 'lastMessage');
  it('warns when exposed without auth', async () => {
    const cfg = { gateway: { bind: 'lan' } };
    await noteSecurityWarnings(cfg);
    const message = lastMessage();
    expect(message).toContain('CRITICAL');
    expect(message).toContain('without authentication');
  });
  it('uses env token to avoid critical warning', async () => {
    process.env.OPENCLAW_GATEWAY_TOKEN = 'token-123';
    const cfg = { gateway: { bind: 'lan' } };
    await noteSecurityWarnings(cfg);
    const message = lastMessage();
    expect(message).toContain('WARNING');
    expect(message).not.toContain('CRITICAL');
  });
  it('treats whitespace token as missing', async () => {
    const cfg = {
      gateway: { bind: 'lan', auth: { mode: 'token', token: '   ' } }
    };
    await noteSecurityWarnings(cfg);
    const message = lastMessage();
    expect(message).toContain('CRITICAL');
  });
  it('skips warning for loopback bind', async () => {
    const cfg = { gateway: { bind: 'loopback' } };
    await noteSecurityWarnings(cfg);
    const message = lastMessage();
    expect(message).toContain('No channel security warnings detected');
    expect(message).not.toContain('Gateway bound');
  });
});
