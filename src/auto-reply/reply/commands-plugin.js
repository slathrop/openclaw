import { matchPluginCommand, executePluginCommand } from '../../plugins/commands.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const handlePluginCommand = async (params, allowTextCommands) => {
  const { command, cfg } = params;
  if (!allowTextCommands) {
    return null;
  }
  const match = matchPluginCommand(command.commandBodyNormalized);
  if (!match) {
    return null;
  }
  const result = await executePluginCommand({
    command: match.command,
    args: match.args,
    senderId: command.senderId,
    channel: command.channel,
    isAuthorizedSender: command.isAuthorizedSender,
    commandBody: command.commandBodyNormalized,
    config: cfg
  });
  return {
    shouldContinue: false,
    reply: result
  };
};
export {
  handlePluginCommand
};
