const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { getChannelPlugin } from '../../channels/plugins/index.js';
import { formatCliCommand } from '../../cli/command-format.js';
import { readConfigFileSnapshot } from '../../config/config.js';
import { DEFAULT_ACCOUNT_ID } from '../../routing/session-key.js';
import { defaultRuntime } from '../../runtime.js';
async function requireValidConfig(runtime = defaultRuntime) {
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
function formatAccountLabel(params) {
  const base = params.accountId || DEFAULT_ACCOUNT_ID;
  if (params.name?.trim()) {
    return `${base} (${params.name.trim()})`;
  }
  return base;
}
__name(formatAccountLabel, 'formatAccountLabel');
const channelLabel = /* @__PURE__ */ __name((channel) => {
  const plugin = getChannelPlugin(channel);
  return plugin?.meta.label ?? channel;
}, 'channelLabel');
function formatChannelAccountLabel(params) {
  const channelText = channelLabel(params.channel);
  const accountText = formatAccountLabel({
    accountId: params.accountId,
    name: params.name
  });
  const styledChannel = params.channelStyle ? params.channelStyle(channelText) : channelText;
  const styledAccount = params.accountStyle ? params.accountStyle(accountText) : accountText;
  return `${styledChannel} ${styledAccount}`;
}
__name(formatChannelAccountLabel, 'formatChannelAccountLabel');
function shouldUseWizard(params) {
  return params?.hasFlags === false;
}
__name(shouldUseWizard, 'shouldUseWizard');
export {
  channelLabel,
  formatAccountLabel,
  formatChannelAccountLabel,
  requireValidConfig,
  shouldUseWizard
};
