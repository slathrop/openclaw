const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { defaultRuntime } from '../runtime.js';
import { formatDocsLink } from '../terminal/links.js';
import { theme } from '../terminal/theme.js';
import { runTui } from '../tui/tui.js';
import { parseTimeoutMs } from './parse-timeout.js';
function registerTuiCli(program) {
  program.command('tui').description('Open a terminal UI connected to the Gateway').option('--url <url>', 'Gateway WebSocket URL (defaults to gateway.remote.url when configured)').option('--token <token>', 'Gateway token (if required)').option('--password <password>', 'Gateway password (if required)').option('--session <key>', 'Session key (default: "main", or "global" when scope is global)').option('--deliver', 'Deliver assistant replies', false).option('--thinking <level>', 'Thinking level override').option('--message <text>', 'Send an initial message after connecting').option('--timeout-ms <ms>', 'Agent timeout in ms (defaults to agents.defaults.timeoutSeconds)').option('--history-limit <n>', 'History entries to load', '200').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/tui', 'docs.openclaw.ai/cli/tui')}
`
  ).action(async (opts) => {
    try {
      const timeoutMs = parseTimeoutMs(opts.timeoutMs);
      if (opts.timeoutMs !== void 0 && timeoutMs === void 0) {
        defaultRuntime.error(
          `warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`
        );
      }
      const historyLimit = Number.parseInt(String(opts.historyLimit ?? '200'), 10);
      await runTui({
        url: opts.url,
        token: opts.token,
        password: opts.password,
        session: opts.session,
        deliver: Boolean(opts.deliver),
        thinking: opts.thinking,
        message: opts.message,
        timeoutMs,
        historyLimit: Number.isNaN(historyLimit) ? void 0 : historyLimit
      });
    } catch (err) {
      defaultRuntime.error(String(err));
      defaultRuntime.exit(1);
    }
  });
}
__name(registerTuiCli, 'registerTuiCli');
export {
  registerTuiCli
};
