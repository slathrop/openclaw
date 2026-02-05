const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { formatDocsLink } from '../../terminal/links.js';
import { theme } from '../../terminal/theme.js';
import {
  registerCronAddCommand,
  registerCronListCommand,
  registerCronStatusCommand
} from './register.cron-add.js';
import { registerCronEditCommand } from './register.cron-edit.js';
import { registerCronSimpleCommands } from './register.cron-simple.js';
function registerCronCli(program) {
  const cron = program.command('cron').description('Manage cron jobs (via Gateway)').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/cron', 'docs.openclaw.ai/cli/cron')}
`
  );
  registerCronStatusCommand(cron);
  registerCronListCommand(cron);
  registerCronAddCommand(cron);
  registerCronSimpleCommands(cron);
  registerCronEditCommand(cron);
}
__name(registerCronCli, 'registerCronCli');
export {
  registerCronCli
};
