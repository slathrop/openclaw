import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  randomToken: vi.fn()
}));
vi.mock('../commands/onboard-helpers.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    randomToken: mocks.randomToken
  };
});
vi.mock('../infra/tailscale.js', () => ({
  findTailscaleBinary: vi.fn(async () => void 0)
}));
import { configureGatewayForOnboarding } from './onboarding.gateway-config.js';
describe('configureGatewayForOnboarding', () => {
  it('generates a token when the prompt returns undefined', async () => {
    mocks.randomToken.mockReturnValue('generated-token');
    const selectQueue = ['loopback', 'token', 'off'];
    const textQueue = ['18789', void 0];
    const prompter = {
      intro: vi.fn(async () => {
      }),
      outro: vi.fn(async () => {
      }),
      note: vi.fn(async () => {
      }),
      select: vi.fn(async () => selectQueue.shift()),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => textQueue.shift()),
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() }))
    };
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn()
    };
    const result = await configureGatewayForOnboarding({
      flow: 'advanced',
      baseConfig: {},
      nextConfig: {},
      localPort: 18789,
      quickstartGateway: {
        hasExisting: false,
        port: 18789,
        bind: 'loopback',
        authMode: 'token',
        tailscaleMode: 'off',
        token: void 0,
        password: void 0,
        customBindHost: void 0,
        tailscaleResetOnExit: false
      },
      prompter,
      runtime
    });
    expect(result.settings.gatewayToken).toBe('generated-token');
  });
});
