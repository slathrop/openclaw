const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { danger } from '../globals.js';
import { defaultRuntime } from '../runtime.js';
import { formatDocsLink } from '../terminal/links.js';
import { theme } from '../terminal/theme.js';
import { registerBrowserActionInputCommands } from './browser-cli-actions-input.js';
import { registerBrowserActionObserveCommands } from './browser-cli-actions-observe.js';
import { registerBrowserDebugCommands } from './browser-cli-debug.js';
import { browserActionExamples, browserCoreExamples } from './browser-cli-examples.js';
import { registerBrowserExtensionCommands } from './browser-cli-extension.js';
import { registerBrowserInspectCommands } from './browser-cli-inspect.js';
import { registerBrowserManageCommands } from './browser-cli-manage.js';
import { registerBrowserStateCommands } from './browser-cli-state.js';
import { formatCliCommand } from './command-format.js';
import { addGatewayClientOptions } from './gateway-rpc.js';
import { formatHelpExamples } from './help-format.js';
function registerBrowserCli(program) {
  const browser = program.command('browser').description("Manage OpenClaw's dedicated browser (Chrome/Chromium)").option('--browser-profile <name>', 'Browser profile name (default from config)').option('--json', 'Output machine-readable JSON', false).addHelpText(
    'after',
    () => `
${theme.heading('Examples:')}
${formatHelpExamples(
  [...browserCoreExamples, ...browserActionExamples].map((cmd) => [cmd, '']),
  true
)}

${theme.muted('Docs:')} ${formatDocsLink(
  '/cli/browser',
  'docs.openclaw.ai/cli/browser'
)}
`
  ).action(() => {
    browser.outputHelp();
    defaultRuntime.error(
      danger(`Missing subcommand. Try: "${formatCliCommand('openclaw browser status')}"`)
    );
    defaultRuntime.exit(1);
  });
  addGatewayClientOptions(browser);
  const parentOpts = /* @__PURE__ */ __name((cmd) => cmd.parent?.opts?.(), 'parentOpts');
  registerBrowserManageCommands(browser, parentOpts);
  registerBrowserExtensionCommands(browser, parentOpts);
  registerBrowserInspectCommands(browser, parentOpts);
  registerBrowserActionInputCommands(browser, parentOpts);
  registerBrowserActionObserveCommands(browser, parentOpts);
  registerBrowserDebugCommands(browser, parentOpts);
  registerBrowserStateCommands(browser, parentOpts);
}
__name(registerBrowserCli, 'registerBrowserCli');
export {
  registerBrowserCli
};
