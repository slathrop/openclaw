import { logVerbose } from '../../globals.js';
import { createInternalHookEvent, triggerInternalHook } from '../../hooks/internal-hooks.js';
import { resolveSendPolicy } from '../../sessions/send-policy.js';
import { shouldHandleTextCommands } from '../commands-registry.js';
import { handleAllowlistCommand } from './commands-allowlist.js';
import { handleApproveCommand } from './commands-approve.js';
import { handleBashCommand } from './commands-bash.js';
import { handleCompactCommand } from './commands-compact.js';
import { handleConfigCommand, handleDebugCommand } from './commands-config.js';
import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  handleCommandsListCommand,
  handleContextCommand,
  handleHelpCommand,
  handleStatusCommand,
  handleWhoamiCommand
} from './commands-info.js';
import { handleModelsCommand } from './commands-models.js';
import { handlePluginCommand } from './commands-plugin.js';
import {
  handleAbortTrigger,
  handleActivationCommand,
  handleRestartCommand,
  handleSendPolicyCommand,
  handleStopCommand,
  handleUsageCommand
} from './commands-session.js';
import { handleSubagentsCommand } from './commands-subagents.js';
import { handleTtsCommands } from './commands-tts.js';
import { routeReply } from './route-reply.js';
let HANDLERS = null;
async function handleCommands(params) {
  if (HANDLERS === null) {
    HANDLERS = [
      // Plugin commands are processed first, before built-in commands
      handlePluginCommand,
      handleBashCommand,
      handleActivationCommand,
      handleSendPolicyCommand,
      handleUsageCommand,
      handleRestartCommand,
      handleTtsCommands,
      handleHelpCommand,
      handleCommandsListCommand,
      handleStatusCommand,
      handleAllowlistCommand,
      handleApproveCommand,
      handleContextCommand,
      handleWhoamiCommand,
      handleSubagentsCommand,
      handleConfigCommand,
      handleDebugCommand,
      handleModelsCommand,
      handleStopCommand,
      handleCompactCommand,
      handleAbortTrigger
    ];
  }
  const resetMatch = params.command.commandBodyNormalized.match(/^\/(new|reset)(?:\s|$)/);
  const resetRequested = Boolean(resetMatch);
  if (resetRequested && !params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /reset from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  if (resetRequested && params.command.isAuthorizedSender) {
    const commandAction = resetMatch?.[1] ?? 'new';
    const hookEvent = createInternalHookEvent('command', commandAction, params.sessionKey ?? '', {
      sessionEntry: params.sessionEntry,
      previousSessionEntry: params.previousSessionEntry,
      commandSource: params.command.surface,
      senderId: params.command.senderId,
      cfg: params.cfg
      // Pass config for LLM slug generation
    });
    await triggerInternalHook(hookEvent);
    if (hookEvent.messages.length > 0) {
      const channel = params.ctx.OriginatingChannel || params.command.channel;
      const to = params.ctx.OriginatingTo || params.command.from || params.command.to;
      if (channel && to) {
        const hookReply = { text: hookEvent.messages.join('\n\n') };
        await routeReply({
          payload: hookReply,
          channel,
          to,
          sessionKey: params.sessionKey,
          accountId: params.ctx.AccountId,
          threadId: params.ctx.MessageThreadId,
          cfg: params.cfg
        });
      }
    }
  }
  const allowTextCommands = shouldHandleTextCommands({
    cfg: params.cfg,
    surface: params.command.surface,
    commandSource: params.ctx.CommandSource
  });
  for (const handler of HANDLERS) {
    const result = await handler(params, allowTextCommands);
    if (result) {
      return result;
    }
  }
  const sendPolicy = resolveSendPolicy({
    cfg: params.cfg,
    entry: params.sessionEntry,
    sessionKey: params.sessionKey,
    channel: params.sessionEntry?.channel ?? params.command.channel,
    chatType: params.sessionEntry?.chatType
  });
  if (sendPolicy === 'deny') {
    logVerbose(`Send blocked by policy for session ${params.sessionKey ?? 'unknown'}`);
    return { shouldContinue: false };
  }
  return { shouldContinue: true };
}
export {
  handleCommands
};
