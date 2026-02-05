const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { onboardCommand } from '../../commands/onboard.js';
import { defaultRuntime } from '../../runtime.js';
import { formatDocsLink } from '../../terminal/links.js';
import { theme } from '../../terminal/theme.js';
import { runCommandWithRuntime } from '../cli-utils.js';
function resolveInstallDaemonFlag(command, opts) {
  if (!command || typeof command !== 'object') {
    return void 0;
  }
  const getOptionValueSource = 'getOptionValueSource' in command ? command.getOptionValueSource : void 0;
  if (typeof getOptionValueSource !== 'function') {
    return void 0;
  }
  if (getOptionValueSource.call(command, 'skipDaemon') === 'cli') {
    return false;
  }
  if (getOptionValueSource.call(command, 'installDaemon') === 'cli') {
    return Boolean(opts.installDaemon);
  }
  return void 0;
}
__name(resolveInstallDaemonFlag, 'resolveInstallDaemonFlag');
function registerOnboardCommand(program) {
  program.command('onboard').description('Interactive wizard to set up the gateway, workspace, and skills').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/onboard', 'docs.openclaw.ai/cli/onboard')}
`
  ).option('--workspace <dir>', 'Agent workspace directory (default: ~/.openclaw/workspace)').option('--reset', 'Reset config + credentials + sessions + workspace before running wizard').option('--non-interactive', 'Run without prompts', false).option(
    '--accept-risk',
    'Acknowledge that agents are powerful and full system access is risky (required for --non-interactive)',
    false
  ).option('--flow <flow>', 'Wizard flow: quickstart|advanced|manual').option('--mode <mode>', 'Wizard mode: local|remote').option(
    '--auth-choice <choice>',
    'Auth: setup-token|token|chutes|openai-codex|openai-api-key|openrouter-api-key|ai-gateway-api-key|cloudflare-ai-gateway-api-key|moonshot-api-key|moonshot-api-key-cn|kimi-code-api-key|synthetic-api-key|venice-api-key|gemini-api-key|zai-api-key|xiaomi-api-key|apiKey|minimax-api|minimax-api-lightning|opencode-zen|skip'
  ).option(
    '--token-provider <id>',
    'Token provider id (non-interactive; used with --auth-choice token)'
  ).option('--token <token>', 'Token value (non-interactive; used with --auth-choice token)').option(
    '--token-profile-id <id>',
    'Auth profile id (non-interactive; default: <provider>:manual)'
  ).option('--token-expires-in <duration>', 'Optional token expiry duration (e.g. 365d, 12h)').option('--anthropic-api-key <key>', 'Anthropic API key').option('--openai-api-key <key>', 'OpenAI API key').option('--openrouter-api-key <key>', 'OpenRouter API key').option('--ai-gateway-api-key <key>', 'Vercel AI Gateway API key').option('--cloudflare-ai-gateway-account-id <id>', 'Cloudflare Account ID').option('--cloudflare-ai-gateway-gateway-id <id>', 'Cloudflare AI Gateway ID').option('--cloudflare-ai-gateway-api-key <key>', 'Cloudflare AI Gateway API key').option('--moonshot-api-key <key>', 'Moonshot API key').option('--kimi-code-api-key <key>', 'Kimi Coding API key').option('--gemini-api-key <key>', 'Gemini API key').option('--zai-api-key <key>', 'Z.AI API key').option('--xiaomi-api-key <key>', 'Xiaomi API key').option('--minimax-api-key <key>', 'MiniMax API key').option('--synthetic-api-key <key>', 'Synthetic API key').option('--venice-api-key <key>', 'Venice API key').option('--opencode-zen-api-key <key>', 'OpenCode Zen API key').option('--gateway-port <port>', 'Gateway port').option('--gateway-bind <mode>', 'Gateway bind: loopback|tailnet|lan|auto|custom').option('--gateway-auth <mode>', 'Gateway auth: token|password').option('--gateway-token <token>', 'Gateway token (token auth)').option('--gateway-password <password>', 'Gateway password (password auth)').option('--remote-url <url>', 'Remote Gateway WebSocket URL').option('--remote-token <token>', 'Remote Gateway token (optional)').option('--tailscale <mode>', 'Tailscale: off|serve|funnel').option('--tailscale-reset-on-exit', 'Reset tailscale serve/funnel on exit').option('--install-daemon', 'Install gateway service').option('--no-install-daemon', 'Skip gateway service install').option('--skip-daemon', 'Skip gateway service install').option('--daemon-runtime <runtime>', 'Daemon runtime: node|bun').option('--skip-channels', 'Skip channel setup').option('--skip-skills', 'Skip skills setup').option('--skip-health', 'Skip health check').option('--skip-ui', 'Skip Control UI/TUI prompts').option('--node-manager <name>', 'Node manager for skills: npm|pnpm|bun').option('--json', 'Output JSON summary', false).action(async (opts, command) => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      const installDaemon = resolveInstallDaemonFlag(command, {
        installDaemon: Boolean(opts.installDaemon)
      });
      const gatewayPort = typeof opts.gatewayPort === 'string' ? Number.parseInt(opts.gatewayPort, 10) : void 0;
      await onboardCommand(
        {
          workspace: opts.workspace,
          nonInteractive: Boolean(opts.nonInteractive),
          acceptRisk: Boolean(opts.acceptRisk),
          flow: opts.flow,
          mode: opts.mode,
          authChoice: opts.authChoice,
          tokenProvider: opts.tokenProvider,
          token: opts.token,
          tokenProfileId: opts.tokenProfileId,
          tokenExpiresIn: opts.tokenExpiresIn,
          anthropicApiKey: opts.anthropicApiKey,
          openaiApiKey: opts.openaiApiKey,
          openrouterApiKey: opts.openrouterApiKey,
          aiGatewayApiKey: opts.aiGatewayApiKey,
          cloudflareAiGatewayAccountId: opts.cloudflareAiGatewayAccountId,
          cloudflareAiGatewayGatewayId: opts.cloudflareAiGatewayGatewayId,
          cloudflareAiGatewayApiKey: opts.cloudflareAiGatewayApiKey,
          moonshotApiKey: opts.moonshotApiKey,
          kimiCodeApiKey: opts.kimiCodeApiKey,
          geminiApiKey: opts.geminiApiKey,
          zaiApiKey: opts.zaiApiKey,
          xiaomiApiKey: opts.xiaomiApiKey,
          minimaxApiKey: opts.minimaxApiKey,
          syntheticApiKey: opts.syntheticApiKey,
          veniceApiKey: opts.veniceApiKey,
          opencodeZenApiKey: opts.opencodeZenApiKey,
          gatewayPort: typeof gatewayPort === 'number' && Number.isFinite(gatewayPort) ? gatewayPort : void 0,
          gatewayBind: opts.gatewayBind,
          gatewayAuth: opts.gatewayAuth,
          gatewayToken: opts.gatewayToken,
          gatewayPassword: opts.gatewayPassword,
          remoteUrl: opts.remoteUrl,
          remoteToken: opts.remoteToken,
          tailscale: opts.tailscale,
          tailscaleResetOnExit: Boolean(opts.tailscaleResetOnExit),
          reset: Boolean(opts.reset),
          installDaemon,
          daemonRuntime: opts.daemonRuntime,
          skipChannels: Boolean(opts.skipChannels),
          skipSkills: Boolean(opts.skipSkills),
          skipHealth: Boolean(opts.skipHealth),
          skipUi: Boolean(opts.skipUi),
          nodeManager: opts.nodeManager,
          json: Boolean(opts.json)
        },
        defaultRuntime
      );
    });
  });
}
__name(registerOnboardCommand, 'registerOnboardCommand');
export {
  registerOnboardCommand
};
