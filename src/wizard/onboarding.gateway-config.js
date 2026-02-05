import { normalizeGatewayTokenInput, randomToken } from '../commands/onboard-helpers.js';
import { findTailscaleBinary } from '../infra/tailscale.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

async function configureGatewayForOnboarding(opts) {
  const { flow, localPort, quickstartGateway, prompter } = opts;
  let { nextConfig } = opts;
  const port = flow === 'quickstart' ? quickstartGateway.port : Number.parseInt(
    String(
      await prompter.text({
        message: 'Gateway port',
        initialValue: String(localPort),
        validate: (value) => Number.isFinite(Number(value)) ? void 0 : 'Invalid port'
      })
    ),
    10
  );
  let bind = flow === 'quickstart' ? quickstartGateway.bind : await prompter.select({
    message: 'Gateway bind',
    options: [
      { value: 'loopback', label: 'Loopback (127.0.0.1)' },
      { value: 'lan', label: 'LAN (0.0.0.0)' },
      { value: 'tailnet', label: 'Tailnet (Tailscale IP)' },
      { value: 'auto', label: 'Auto (Loopback \u2192 LAN)' },
      { value: 'custom', label: 'Custom IP' }
    ]
  });
  let customBindHost = quickstartGateway.customBindHost;
  if (bind === 'custom') {
    const needsPrompt = flow !== 'quickstart' || !customBindHost;
    if (needsPrompt) {
      const input = await prompter.text({
        message: 'Custom IP address',
        placeholder: '192.168.1.100',
        initialValue: customBindHost ?? '',
        validate: (value) => {
          if (!value) {
            return 'IP address is required for custom bind mode';
          }
          const trimmed = value.trim();
          const parts = trimmed.split('.');
          if (parts.length !== 4) {
            return 'Invalid IPv4 address (e.g., 192.168.1.100)';
          }
          if (parts.every((part) => {
            const n = parseInt(part, 10);
            return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
          })) {
            return void 0;
          }
          return 'Invalid IPv4 address (each octet must be 0-255)';
        }
      });
      customBindHost = typeof input === 'string' ? input.trim() : void 0;
    }
  }
  let authMode = flow === 'quickstart' ? quickstartGateway.authMode : await prompter.select({
    message: 'Gateway auth',
    options: [
      {
        value: 'token',
        label: 'Token',
        hint: 'Recommended default (local + remote)'
      },
      { value: 'password', label: 'Password' }
    ],
    initialValue: 'token'
  });
  const tailscaleMode = flow === 'quickstart' ? quickstartGateway.tailscaleMode : await prompter.select({
    message: 'Tailscale exposure',
    options: [
      { value: 'off', label: 'Off', hint: 'No Tailscale exposure' },
      {
        value: 'serve',
        label: 'Serve',
        hint: 'Private HTTPS for your tailnet (devices on Tailscale)'
      },
      {
        value: 'funnel',
        label: 'Funnel',
        hint: 'Public HTTPS via Tailscale Funnel (internet)'
      }
    ]
  });
  if (tailscaleMode !== 'off') {
    const tailscaleBin = await findTailscaleBinary();
    if (!tailscaleBin) {
      await prompter.note(
        [
          'Tailscale binary not found in PATH or /Applications.',
          'Ensure Tailscale is installed from:',
          '  https://tailscale.com/download/mac',
          '',
          'You can continue setup, but serve/funnel will fail at runtime.'
        ].join('\n'),
        'Tailscale Warning'
      );
    }
  }
  let tailscaleResetOnExit = flow === 'quickstart' ? quickstartGateway.tailscaleResetOnExit : false;
  if (tailscaleMode !== 'off' && flow !== 'quickstart') {
    await prompter.note(
      ['Docs:', 'https://docs.openclaw.ai/gateway/tailscale', 'https://docs.openclaw.ai/web'].join(
        '\n'
      ),
      'Tailscale'
    );
    tailscaleResetOnExit = Boolean(
      await prompter.confirm({
        message: 'Reset Tailscale serve/funnel on exit?',
        initialValue: false
      })
    );
  }
  if (tailscaleMode !== 'off' && bind !== 'loopback') {
    await prompter.note('Tailscale requires bind=loopback. Adjusting bind to loopback.', 'Note');
    bind = 'loopback';
    customBindHost = void 0;
  }
  if (tailscaleMode === 'funnel' && authMode !== 'password') {
    await prompter.note('Tailscale funnel requires password auth.', 'Note');
    authMode = 'password';
  }
  let gatewayToken;
  if (authMode === 'token') {
    if (flow === 'quickstart') {
      gatewayToken = quickstartGateway.token ?? randomToken();
    } else {
      const tokenInput = await prompter.text({
        message: 'Gateway token (blank to generate)',
        placeholder: 'Needed for multi-machine or non-loopback access',
        initialValue: quickstartGateway.token ?? ''
      });
      gatewayToken = normalizeGatewayTokenInput(tokenInput) || randomToken();
    }
  }
  if (authMode === 'password') {
    const password = flow === 'quickstart' && quickstartGateway.password ? quickstartGateway.password : await prompter.text({
      message: 'Gateway password',
      validate: (value) => value?.trim() ? void 0 : 'Required'
    });
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: 'password',
          password: String(password).trim()
        }
      }
    };
  } else if (authMode === 'token') {
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: 'token',
          token: gatewayToken
        }
      }
    };
  }
  nextConfig = {
    ...nextConfig,
    gateway: {
      ...nextConfig.gateway,
      port,
      bind,
      ...bind === 'custom' && customBindHost ? { customBindHost } : {},
      tailscale: {
        ...nextConfig.gateway?.tailscale,
        mode: tailscaleMode,
        resetOnExit: tailscaleResetOnExit
      }
    }
  };
  return {
    nextConfig,
    settings: {
      port,
      bind,
      customBindHost: bind === 'custom' ? customBindHost : void 0,
      authMode,
      gatewayToken,
      tailscaleMode,
      tailscaleResetOnExit
    }
  };
}
export {
  configureGatewayForOnboarding
};
