import { abortEmbeddedPiRun } from '../../agents/pi-embedded.js';
import { updateSessionStore } from '../../config/sessions.js';
import { logVerbose } from '../../globals.js';
import { createInternalHookEvent, triggerInternalHook } from '../../hooks/internal-hooks.js';
import { scheduleGatewaySigusr1Restart, triggerOpenClawRestart } from '../../infra/restart.js';
import { loadCostUsageSummary, loadSessionCostSummary } from '../../infra/session-cost-usage.js';
import { formatTokenCount, formatUsd } from '../../utils/usage-format.js';
import { parseActivationCommand } from '../group-activation.js';
import { parseSendPolicyCommand } from '../send-policy.js';
import { normalizeUsageDisplay, resolveResponseUsageMode } from '../thinking.js';
import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  formatAbortReplyText,
  isAbortTrigger,
  setAbortMemory,
  stopSubagentsForRequester
} from './abort.js';
import { clearSessionQueues } from './queue.js';
function resolveSessionEntryForKey(store, sessionKey) {
  if (!store || !sessionKey) {
    return {};
  }
  const direct = store[sessionKey];
  if (direct) {
    return { entry: direct, key: sessionKey };
  }
  return {};
}
function resolveAbortTarget(params) {
  const targetSessionKey = params.ctx.CommandTargetSessionKey?.trim() || params.sessionKey;
  const { entry, key } = resolveSessionEntryForKey(params.sessionStore, targetSessionKey);
  if (entry && key) {
    return { entry, key, sessionId: entry.sessionId };
  }
  if (params.sessionEntry && params.sessionKey) {
    return {
      entry: params.sessionEntry,
      key: params.sessionKey,
      sessionId: params.sessionEntry.sessionId
    };
  }
  return { entry: void 0, key: targetSessionKey, sessionId: void 0 };
}
const handleActivationCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const activationCommand = parseActivationCommand(params.command.commandBodyNormalized);
  if (!activationCommand.hasCommand) {
    return null;
  }
  if (!params.isGroup) {
    return {
      shouldContinue: false,
      reply: { text: '\u2699\uFE0F Group activation only applies to group chats.' }
    };
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /activation from unauthorized sender in group: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  if (!activationCommand.mode) {
    return {
      shouldContinue: false,
      reply: { text: '\u2699\uFE0F Usage: /activation mention|always' }
    };
  }
  if (params.sessionEntry && params.sessionStore && params.sessionKey) {
    params.sessionEntry.groupActivation = activationCommand.mode;
    params.sessionEntry.groupActivationNeedsSystemIntro = true;
    params.sessionEntry.updatedAt = Date.now();
    params.sessionStore[params.sessionKey] = params.sessionEntry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[params.sessionKey] = params.sessionEntry;
      });
    }
  }
  return {
    shouldContinue: false,
    reply: {
      text: `\u2699\uFE0F Group activation set to ${activationCommand.mode}.`
    }
  };
};
const handleSendPolicyCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const sendPolicyCommand = parseSendPolicyCommand(params.command.commandBodyNormalized);
  if (!sendPolicyCommand.hasCommand) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /send from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  if (!sendPolicyCommand.mode) {
    return {
      shouldContinue: false,
      reply: { text: '\u2699\uFE0F Usage: /send on|off|inherit' }
    };
  }
  if (params.sessionEntry && params.sessionStore && params.sessionKey) {
    if (sendPolicyCommand.mode === 'inherit') {
      delete params.sessionEntry.sendPolicy;
    } else {
      params.sessionEntry.sendPolicy = sendPolicyCommand.mode;
    }
    params.sessionEntry.updatedAt = Date.now();
    params.sessionStore[params.sessionKey] = params.sessionEntry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[params.sessionKey] = params.sessionEntry;
      });
    }
  }
  const label = sendPolicyCommand.mode === 'inherit' ? 'inherit' : sendPolicyCommand.mode === 'allow' ? 'on' : 'off';
  return {
    shouldContinue: false,
    reply: { text: `\u2699\uFE0F Send policy set to ${label}.` }
  };
};
const handleUsageCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const normalized = params.command.commandBodyNormalized;
  if (normalized !== '/usage' && !normalized.startsWith('/usage ')) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /usage from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  const rawArgs = normalized === '/usage' ? '' : normalized.slice('/usage'.length).trim();
  const requested = rawArgs ? normalizeUsageDisplay(rawArgs) : void 0;
  if (rawArgs.toLowerCase().startsWith('cost')) {
    const sessionSummary = await loadSessionCostSummary({
      sessionId: params.sessionEntry?.sessionId,
      sessionEntry: params.sessionEntry,
      sessionFile: params.sessionEntry?.sessionFile,
      config: params.cfg
    });
    const summary = await loadCostUsageSummary({ days: 30, config: params.cfg });
    const sessionCost = formatUsd(sessionSummary?.totalCost);
    const sessionTokens = sessionSummary?.totalTokens ? formatTokenCount(sessionSummary.totalTokens) : void 0;
    const sessionMissing = sessionSummary?.missingCostEntries ?? 0;
    const sessionSuffix = sessionMissing > 0 ? ' (partial)' : '';
    const sessionLine = sessionCost || sessionTokens ? `Session ${sessionCost ?? 'n/a'}${sessionSuffix}${sessionTokens ? ` \xB7 ${sessionTokens} tokens` : ''}` : 'Session n/a';
    const todayKey = (/* @__PURE__ */ new Date()).toLocaleDateString('en-CA');
    const todayEntry = summary.daily.find((entry) => entry.date === todayKey);
    const todayCost = formatUsd(todayEntry?.totalCost);
    const todayMissing = todayEntry?.missingCostEntries ?? 0;
    const todaySuffix = todayMissing > 0 ? ' (partial)' : '';
    const todayLine = `Today ${todayCost ?? 'n/a'}${todaySuffix}`;
    const last30Cost = formatUsd(summary.totals.totalCost);
    const last30Missing = summary.totals.missingCostEntries;
    const last30Suffix = last30Missing > 0 ? ' (partial)' : '';
    const last30Line = `Last 30d ${last30Cost ?? 'n/a'}${last30Suffix}`;
    return {
      shouldContinue: false,
      reply: { text: `\u{1F4B8} Usage cost
${sessionLine}
${todayLine}
${last30Line}` }
    };
  }
  if (rawArgs && !requested) {
    return {
      shouldContinue: false,
      reply: { text: '\u2699\uFE0F Usage: /usage off|tokens|full|cost' }
    };
  }
  const currentRaw = params.sessionEntry?.responseUsage ?? (params.sessionKey ? params.sessionStore?.[params.sessionKey]?.responseUsage : void 0);
  const current = resolveResponseUsageMode(currentRaw);
  const next = requested ?? (current === 'off' ? 'tokens' : current === 'tokens' ? 'full' : 'off');
  if (params.sessionEntry && params.sessionStore && params.sessionKey) {
    if (next === 'off') {
      delete params.sessionEntry.responseUsage;
    } else {
      params.sessionEntry.responseUsage = next;
    }
    params.sessionEntry.updatedAt = Date.now();
    params.sessionStore[params.sessionKey] = params.sessionEntry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[params.sessionKey] = params.sessionEntry;
      });
    }
  }
  return {
    shouldContinue: false,
    reply: {
      text: `\u2699\uFE0F Usage footer: ${next}.`
    }
  };
};
const handleRestartCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== '/restart') {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /restart from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  if (params.cfg.commands?.restart !== true) {
    return {
      shouldContinue: false,
      reply: {
        text: '\u26A0\uFE0F /restart is disabled. Set commands.restart=true to enable.'
      }
    };
  }
  const hasSigusr1Listener = process.listenerCount('SIGUSR1') > 0;
  if (hasSigusr1Listener) {
    scheduleGatewaySigusr1Restart({ reason: '/restart' });
    return {
      shouldContinue: false,
      reply: {
        text: '\u2699\uFE0F Restarting OpenClaw in-process (SIGUSR1); back in a few seconds.'
      }
    };
  }
  const restartMethod = triggerOpenClawRestart();
  if (!restartMethod.ok) {
    const detail = restartMethod.detail ? ` Details: ${restartMethod.detail}` : '';
    return {
      shouldContinue: false,
      reply: {
        text: `\u26A0\uFE0F Restart failed (${restartMethod.method}).${detail}`
      }
    };
  }
  return {
    shouldContinue: false,
    reply: {
      text: `\u2699\uFE0F Restarting OpenClaw via ${restartMethod.method}; give me a few seconds to come back online.`
    }
  };
};
const handleStopCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== '/stop') {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /stop from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  const abortTarget = resolveAbortTarget({
    ctx: params.ctx,
    sessionKey: params.sessionKey,
    sessionEntry: params.sessionEntry,
    sessionStore: params.sessionStore
  });
  if (abortTarget.sessionId) {
    abortEmbeddedPiRun(abortTarget.sessionId);
  }
  const cleared = clearSessionQueues([abortTarget.key, abortTarget.sessionId]);
  if (cleared.followupCleared > 0 || cleared.laneCleared > 0) {
    logVerbose(
      `stop: cleared followups=${cleared.followupCleared} lane=${cleared.laneCleared} keys=${cleared.keys.join(',')}`
    );
  }
  if (abortTarget.entry && params.sessionStore && abortTarget.key) {
    abortTarget.entry.abortedLastRun = true;
    abortTarget.entry.updatedAt = Date.now();
    params.sessionStore[abortTarget.key] = abortTarget.entry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[abortTarget.key] = abortTarget.entry;
      });
    }
  } else if (params.command.abortKey) {
    setAbortMemory(params.command.abortKey, true);
  }
  const hookEvent = createInternalHookEvent(
    'command',
    'stop',
    abortTarget.key ?? params.sessionKey ?? '',
    {
      sessionEntry: abortTarget.entry ?? params.sessionEntry,
      sessionId: abortTarget.sessionId,
      commandSource: params.command.surface,
      senderId: params.command.senderId
    }
  );
  await triggerInternalHook(hookEvent);
  const { stopped } = stopSubagentsForRequester({
    cfg: params.cfg,
    requesterSessionKey: abortTarget.key ?? params.sessionKey
  });
  return { shouldContinue: false, reply: { text: formatAbortReplyText(stopped) } };
};
const handleAbortTrigger = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (!isAbortTrigger(params.command.rawBodyNormalized)) {
    return null;
  }
  const abortTarget = resolveAbortTarget({
    ctx: params.ctx,
    sessionKey: params.sessionKey,
    sessionEntry: params.sessionEntry,
    sessionStore: params.sessionStore
  });
  if (abortTarget.sessionId) {
    abortEmbeddedPiRun(abortTarget.sessionId);
  }
  if (abortTarget.entry && params.sessionStore && abortTarget.key) {
    abortTarget.entry.abortedLastRun = true;
    abortTarget.entry.updatedAt = Date.now();
    params.sessionStore[abortTarget.key] = abortTarget.entry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[abortTarget.key] = abortTarget.entry;
      });
    }
  } else if (params.command.abortKey) {
    setAbortMemory(params.command.abortKey, true);
  }
  return { shouldContinue: false, reply: { text: '\u2699\uFE0F Agent was aborted.' } };
};
export {
  handleAbortTrigger,
  handleActivationCommand,
  handleRestartCommand,
  handleSendPolicyCommand,
  handleStopCommand,
  handleUsageCommand
};
