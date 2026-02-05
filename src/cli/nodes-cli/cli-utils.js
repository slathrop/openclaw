const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { defaultRuntime } from '../../runtime.js';
import { isRich, theme } from '../../terminal/theme.js';
import { runCommandWithRuntime } from '../cli-utils.js';
import { unauthorizedHintForMessage } from './rpc.js';
function getNodesTheme() {
  const rich = isRich();
  const color = /* @__PURE__ */ __name((fn) => (value) => rich ? fn(value) : value, 'color');
  return {
    rich,
    heading: color(theme.heading),
    ok: color(theme.success),
    warn: color(theme.warn),
    muted: color(theme.muted),
    error: color(theme.error)
  };
}
__name(getNodesTheme, 'getNodesTheme');
function runNodesCommand(label, action) {
  return runCommandWithRuntime(defaultRuntime, action, (err) => {
    const message = String(err);
    const { error, warn } = getNodesTheme();
    defaultRuntime.error(error(`nodes ${label} failed: ${message}`));
    const hint = unauthorizedHintForMessage(message);
    if (hint) {
      defaultRuntime.error(warn(hint));
    }
    defaultRuntime.exit(1);
  });
}
__name(runNodesCommand, 'runNodesCommand');
export {
  getNodesTheme,
  runNodesCommand
};
