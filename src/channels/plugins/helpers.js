import { formatCliCommand } from '../../cli/command-format.js';
import { DEFAULT_ACCOUNT_ID } from '../../routing/session-key.js';
function resolveChannelDefaultAccountId(params) {
  const accountIds = params.accountIds ?? params.plugin.config.listAccountIds(params.cfg);
  return params.plugin.config.defaultAccountId?.(params.cfg) ?? accountIds[0] ?? DEFAULT_ACCOUNT_ID;
}
function formatPairingApproveHint(channelId) {
  const listCmd = formatCliCommand(`openclaw pairing list ${channelId}`);
  const approveCmd = formatCliCommand(`openclaw pairing approve ${channelId} <code>`);
  return `Approve via: ${listCmd} / ${approveCmd}`;
}
export {
  formatPairingApproveHint,
  resolveChannelDefaultAccountId
};
