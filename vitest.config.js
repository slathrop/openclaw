import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isWindows = process.platform === 'win32';
const localWorkers = Math.max(4, Math.min(16, os.cpus().length));
const ciWorkers = isWindows ? 2 : 3;

export default defineConfig({
  resolve: {
    alias: {
      'openclaw/plugin-sdk': path.join(repoRoot, 'src', 'plugin-sdk', 'index.js')
    }
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: isWindows ? 180_000 : 120_000,
    pool: 'forks',
    maxWorkers: isCI ? ciWorkers : localWorkers,
    include: ['src/**/*.test.js', 'extensions/**/*.test.js'],
    setupFiles: ['test/setup.js'],
    exclude: [
      'dist/**',
      'apps/macos/**',
      'apps/macos/.build/**',
      '**/node_modules/**',
      '**/vendor/**',
      'dist/OpenClaw.app/**',
      '**/*.live.test.js',
      '**/*.e2e.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 55,
        statements: 70
      },
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.test.js',
        // Entrypoints and wiring (covered by CI smoke + manual/e2e flows).
        'src/entry.js',
        'src/index.js',
        'src/runtime.js',
        'src/cli/**',
        'src/commands/**',
        'src/daemon/**',
        'src/hooks/**',
        'src/macos/**',

        // Some agent integrations are intentionally validated via manual/e2e runs.
        'src/agents/model-scan.js',
        'src/agents/pi-embedded-runner.js',
        'src/agents/sandbox-paths.js',
        'src/agents/sandbox.js',
        'src/agents/skills-install.js',
        'src/agents/pi-tool-definition-adapter.js',
        'src/agents/tools/discord-actions*.js',
        'src/agents/tools/slack-actions.js',

        // Gateway server integration surfaces are intentionally validated via manual/e2e runs.
        'src/gateway/control-ui.js',
        'src/gateway/server-bridge.js',
        'src/gateway/server-channels.js',
        'src/gateway/server-methods/config.js',
        'src/gateway/server-methods/send.js',
        'src/gateway/server-methods/skills.js',
        'src/gateway/server-methods/talk.js',
        'src/gateway/server-methods/web.js',
        'src/gateway/server-methods/wizard.js',

        // Process bridges are hard to unit-test in isolation.
        'src/gateway/call.js',
        'src/process/tau-rpc.js',
        'src/process/exec.js',
        // Interactive UIs/flows are intentionally validated via manual/e2e runs.
        'src/tui/**',
        'src/wizard/**',
        // Channel surfaces are largely integration-tested (or manually validated).
        'src/discord/**',
        'src/imessage/**',
        'src/signal/**',
        'src/slack/**',
        'src/browser/**',
        'src/channels/web/**',
        'src/telegram/index.js',
        'src/telegram/proxy.js',
        'src/telegram/webhook-set.js',
        'src/telegram/**',
        'src/webchat/**',
        'src/gateway/server.js',
        'src/gateway/client.js',
        'src/gateway/protocol/**',
        'src/infra/tailscale.js'
      ]
    }
  }
});
