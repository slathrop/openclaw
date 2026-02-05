import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  resolveGatewayPort: vi.fn(),
  buildGatewayAuthConfig: vi.fn(),
  note: vi.fn(),
  randomToken: vi.fn()
}));
vi.mock('../config/config.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    resolveGatewayPort: mocks.resolveGatewayPort
  };
});
vi.mock('./configure.shared.js', () => ({
  text: mocks.text,
  select: mocks.select,
  confirm: mocks.confirm
}));
vi.mock('../terminal/note.js', () => ({
  note: mocks.note
}));
vi.mock('./configure.gateway-auth.js', () => ({
  buildGatewayAuthConfig: mocks.buildGatewayAuthConfig
}));
vi.mock('../infra/tailscale.js', () => ({
  findTailscaleBinary: vi.fn(async () => void 0)
}));
vi.mock('./onboard-helpers.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    randomToken: mocks.randomToken
  };
});
import { promptGatewayConfig } from './configure.gateway.js';
describe('promptGatewayConfig', () => {
  it('generates a token when the prompt returns undefined', async () => {
    mocks.resolveGatewayPort.mockReturnValue(18789);
    const selectQueue = ['loopback', 'token', 'off'];
    mocks.select.mockImplementation(async () => selectQueue.shift());
    const textQueue = ['18789', void 0];
    mocks.text.mockImplementation(async () => textQueue.shift());
    mocks.randomToken.mockReturnValue('generated-token');
    mocks.buildGatewayAuthConfig.mockImplementation(({ mode, token, password }) => ({
      mode,
      token,
      password
    }));
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn()
    };
    const result = await promptGatewayConfig({}, runtime);
    expect(result.token).toBe('generated-token');
  });
});
