const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { onboardCommand } from '../../commands/onboard.js';
import { setupCommand } from '../../commands/setup.js';
import { defaultRuntime } from '../../runtime.js';
import { formatDocsLink } from '../../terminal/links.js';
import { theme } from '../../terminal/theme.js';
import { runCommandWithRuntime } from '../cli-utils.js';
import { hasExplicitOptions } from '../command-options.js';
function registerSetupCommand(program) {
  program.command('setup').description('Initialize ~/.openclaw/openclaw.json and the agent workspace').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/setup', 'docs.openclaw.ai/cli/setup')}
`
  ).option(
    '--workspace <dir>',
    'Agent workspace directory (default: ~/.openclaw/workspace; stored as agents.defaults.workspace)'
  ).option('--wizard', 'Run the interactive onboarding wizard', false).option('--non-interactive', 'Run the wizard without prompts', false).option('--mode <mode>', 'Wizard mode: local|remote').option('--remote-url <url>', 'Remote Gateway WebSocket URL').option('--remote-token <token>', 'Remote Gateway token (optional)').action(async (opts, command) => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      const hasWizardFlags = hasExplicitOptions(command, [
        'wizard',
        'nonInteractive',
        'mode',
        'remoteUrl',
        'remoteToken'
      ]);
      if (opts.wizard || hasWizardFlags) {
        await onboardCommand(
          {
            workspace: opts.workspace,
            nonInteractive: Boolean(opts.nonInteractive),
            mode: opts.mode,
            remoteUrl: opts.remoteUrl,
            remoteToken: opts.remoteToken
          },
          defaultRuntime
        );
        return;
      }
      await setupCommand({ workspace: opts.workspace }, defaultRuntime);
    });
  });
}
__name(registerSetupCommand, 'registerSetupCommand');
export {
  registerSetupCommand
};
