const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { docsSearchCommand } from '../commands/docs.js';
import { defaultRuntime } from '../runtime.js';
import { formatDocsLink } from '../terminal/links.js';
import { theme } from '../terminal/theme.js';
import { runCommandWithRuntime } from './cli-utils.js';
function registerDocsCli(program) {
  program.command('docs').description('Search the live OpenClaw docs').argument('[query...]', 'Search query').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/docs', 'docs.openclaw.ai/cli/docs')}
`
  ).action(async (queryParts) => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await docsSearchCommand(queryParts, defaultRuntime);
    });
  });
}
__name(registerDocsCli, 'registerDocsCli');
export {
  registerDocsCli
};
