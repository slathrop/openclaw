const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { formatCliCommand } from '../cli/command-format.js';
import { readConfigFileSnapshot } from '../config/config.js';
function createQuietRuntime(runtime) {
  return { ...runtime, log: /* @__PURE__ */ __name(() => {
  }, 'log') };
}
__name(createQuietRuntime, 'createQuietRuntime');
async function requireValidConfig(runtime) {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.exists && !snapshot.valid) {
    const issues = snapshot.issues.length > 0 ? snapshot.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n') : 'Unknown validation issue.';
    runtime.error(`Config invalid:
${issues}`);
    runtime.error(`Fix the config or run ${formatCliCommand('openclaw doctor')}.`);
    runtime.exit(1);
    return null;
  }
  return snapshot.config;
}
__name(requireValidConfig, 'requireValidConfig');
export {
  createQuietRuntime,
  requireValidConfig
};
