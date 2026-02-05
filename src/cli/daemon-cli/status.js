const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { defaultRuntime } from '../../runtime.js';
import { colorize, isRich, theme } from '../../terminal/theme.js';
import { gatherDaemonStatus } from './status.gather.js';
import { printDaemonStatus } from './status.print.js';
async function runDaemonStatus(opts) {
  try {
    const status = await gatherDaemonStatus({
      rpc: opts.rpc,
      probe: Boolean(opts.probe),
      deep: Boolean(opts.deep)
    });
    printDaemonStatus(status, { json: Boolean(opts.json) });
  } catch (err) {
    const rich = isRich();
    defaultRuntime.error(colorize(rich, theme.error, `Gateway status failed: ${String(err)}`));
    defaultRuntime.exit(1);
  }
}
__name(runDaemonStatus, 'runDaemonStatus');
export {
  runDaemonStatus
};
