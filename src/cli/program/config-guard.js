const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { loadAndMaybeMigrateDoctorConfig } from '../../commands/doctor-config-flow.js';
import { readConfigFileSnapshot } from '../../config/config.js';
import { colorize, isRich, theme } from '../../terminal/theme.js';
import { shortenHomePath } from '../../utils.js';
import { formatCliCommand } from '../command-format.js';
const ALLOWED_INVALID_COMMANDS = /* @__PURE__ */ new Set(['doctor', 'logs', 'health', 'help', 'status']);
const ALLOWED_INVALID_GATEWAY_SUBCOMMANDS = /* @__PURE__ */ new Set([
  'status',
  'probe',
  'health',
  'discover',
  'call',
  'install',
  'uninstall',
  'start',
  'stop',
  'restart'
]);
let didRunDoctorConfigFlow = false;
function formatConfigIssues(issues) {
  return issues.map((issue) => `- ${issue.path || '<root>'}: ${issue.message}`);
}
__name(formatConfigIssues, 'formatConfigIssues');
async function ensureConfigReady(params) {
  if (!didRunDoctorConfigFlow) {
    didRunDoctorConfigFlow = true;
    await loadAndMaybeMigrateDoctorConfig({
      options: { nonInteractive: true },
      confirm: /* @__PURE__ */ __name(async () => false, 'confirm')
    });
  }
  const snapshot = await readConfigFileSnapshot();
  const commandName = params.commandPath?.[0];
  const subcommandName = params.commandPath?.[1];
  const allowInvalid = commandName ? ALLOWED_INVALID_COMMANDS.has(commandName) || commandName === 'gateway' && subcommandName && ALLOWED_INVALID_GATEWAY_SUBCOMMANDS.has(subcommandName) : false;
  const issues = snapshot.exists && !snapshot.valid ? formatConfigIssues(snapshot.issues) : [];
  const legacyIssues = snapshot.legacyIssues.length > 0 ? snapshot.legacyIssues.map((issue) => `- ${issue.path}: ${issue.message}`) : [];
  const invalid = snapshot.exists && !snapshot.valid;
  if (!invalid) {
    return;
  }
  const rich = isRich();
  const muted = /* @__PURE__ */ __name((value) => colorize(rich, theme.muted, value), 'muted');
  const error = /* @__PURE__ */ __name((value) => colorize(rich, theme.error, value), 'error');
  const heading = /* @__PURE__ */ __name((value) => colorize(rich, theme.heading, value), 'heading');
  const commandText = /* @__PURE__ */ __name((value) => colorize(rich, theme.command, value), 'commandText');
  params.runtime.error(heading('Config invalid'));
  params.runtime.error(`${muted('File:')} ${muted(shortenHomePath(snapshot.path))}`);
  if (issues.length > 0) {
    params.runtime.error(muted('Problem:'));
    params.runtime.error(issues.map((issue) => `  ${error(issue)}`).join('\n'));
  }
  if (legacyIssues.length > 0) {
    params.runtime.error(muted('Legacy config keys detected:'));
    params.runtime.error(legacyIssues.map((issue) => `  ${error(issue)}`).join('\n'));
  }
  params.runtime.error('');
  params.runtime.error(
    `${muted('Run:')} ${commandText(formatCliCommand('openclaw doctor --fix'))}`
  );
  if (!allowInvalid) {
    params.runtime.exit(1);
  }
}
__name(ensureConfigReady, 'ensureConfigReady');
export {
  ensureConfigReady
};
