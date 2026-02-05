import { logVerbose } from '../../globals.js';
import { handleBashChatCommand } from './bash-command.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const handleBashCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const { command } = params;
  const bashSlashRequested = command.commandBodyNormalized === '/bash' || command.commandBodyNormalized.startsWith('/bash ');
  const bashBangRequested = command.commandBodyNormalized.startsWith('!');
  if (!bashSlashRequested && !(bashBangRequested && command.isAuthorizedSender)) {
    return null;
  }
  if (!command.isAuthorizedSender) {
    logVerbose(`Ignoring /bash from unauthorized sender: ${command.senderId || '<unknown>'}`);
    return { shouldContinue: false };
  }
  const reply = await handleBashChatCommand({
    ctx: params.ctx,
    cfg: params.cfg,
    agentId: params.agentId,
    sessionKey: params.sessionKey,
    isGroup: params.isGroup,
    elevated: params.elevated
  });
  return { shouldContinue: false, reply };
};
export {
  handleBashCommand
};
