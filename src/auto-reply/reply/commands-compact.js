import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  abortEmbeddedPiRun,
  compactEmbeddedPiSession,
  isEmbeddedPiRunActive,
  waitForEmbeddedPiRunEnd
} from '../../agents/pi-embedded.js';
import { resolveSessionFilePath } from '../../config/sessions.js';
import { logVerbose } from '../../globals.js';
import { enqueueSystemEvent } from '../../infra/system-events.js';
import { formatContextUsageShort, formatTokenCount } from '../status.js';
import { stripMentions, stripStructuralPrefixes } from './mentions.js';
import { incrementCompactionCount } from './session-updates.js';
function extractCompactInstructions(params) {
  const raw = stripStructuralPrefixes(params.rawBody ?? '');
  const stripped = params.isGroup ? stripMentions(raw, params.ctx, params.cfg, params.agentId) : raw;
  const trimmed = stripped.trim();
  if (!trimmed) {
    return void 0;
  }
  const lowered = trimmed.toLowerCase();
  const prefix = lowered.startsWith('/compact') ? '/compact' : null;
  if (!prefix) {
    return void 0;
  }
  let rest = trimmed.slice(prefix.length).trimStart();
  if (rest.startsWith(':')) {
    rest = rest.slice(1).trimStart();
  }
  return rest.length ? rest : void 0;
}
const handleCompactCommand = async (params) => {
  const compactRequested = params.command.commandBodyNormalized === '/compact' || params.command.commandBodyNormalized.startsWith('/compact ');
  if (!compactRequested) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /compact from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  if (!params.sessionEntry?.sessionId) {
    return {
      shouldContinue: false,
      reply: { text: '\u2699\uFE0F Compaction unavailable (missing session id).' }
    };
  }
  const sessionId = params.sessionEntry.sessionId;
  if (isEmbeddedPiRunActive(sessionId)) {
    abortEmbeddedPiRun(sessionId);
    await waitForEmbeddedPiRunEnd(sessionId, 15e3);
  }
  const customInstructions = extractCompactInstructions({
    rawBody: params.ctx.CommandBody ?? params.ctx.RawBody ?? params.ctx.Body,
    ctx: params.ctx,
    cfg: params.cfg,
    agentId: params.agentId,
    isGroup: params.isGroup
  });
  const result = await compactEmbeddedPiSession({
    sessionId,
    sessionKey: params.sessionKey,
    messageChannel: params.command.channel,
    groupId: params.sessionEntry.groupId,
    groupChannel: params.sessionEntry.groupChannel,
    groupSpace: params.sessionEntry.space,
    spawnedBy: params.sessionEntry.spawnedBy,
    sessionFile: resolveSessionFilePath(sessionId, params.sessionEntry),
    workspaceDir: params.workspaceDir,
    config: params.cfg,
    skillsSnapshot: params.sessionEntry.skillsSnapshot,
    provider: params.provider,
    model: params.model,
    thinkLevel: params.resolvedThinkLevel ?? await params.resolveDefaultThinkingLevel(),
    bashElevated: {
      enabled: false,
      allowed: false,
      defaultLevel: 'off'
    },
    customInstructions,
    senderIsOwner: params.command.senderIsOwner,
    ownerNumbers: params.command.ownerList.length > 0 ? params.command.ownerList : void 0
  });
  const compactLabel = result.ok ? result.compacted ? result.result?.tokensBefore !== null && result.result?.tokensBefore !== undefined && result.result?.tokensAfter !== null && result.result?.tokensAfter !== undefined ? `Compacted (${formatTokenCount(result.result.tokensBefore)} \u2192 ${formatTokenCount(result.result.tokensAfter)})` : result.result?.tokensBefore ? `Compacted (${formatTokenCount(result.result.tokensBefore)} before)` : 'Compacted' : 'Compaction skipped' : 'Compaction failed';
  if (result.ok && result.compacted) {
    await incrementCompactionCount({
      sessionEntry: params.sessionEntry,
      sessionStore: params.sessionStore,
      sessionKey: params.sessionKey,
      storePath: params.storePath,
      // Update token counts after compaction
      tokensAfter: result.result?.tokensAfter
    });
  }
  const tokensAfterCompaction = result.result?.tokensAfter;
  const totalTokens = tokensAfterCompaction ?? params.sessionEntry.totalTokens ?? (params.sessionEntry.inputTokens ?? 0) + (params.sessionEntry.outputTokens ?? 0);
  const contextSummary = formatContextUsageShort(
    totalTokens > 0 ? totalTokens : null,
    params.contextTokens ?? params.sessionEntry.contextTokens ?? null
  );
  const reason = result.reason?.trim();
  const line = reason ? `${compactLabel}: ${reason} \u2022 ${contextSummary}` : `${compactLabel} \u2022 ${contextSummary}`;
  enqueueSystemEvent(line, { sessionKey: params.sessionKey });
  return { shouldContinue: false, reply: { text: `\u2699\uFE0F ${line}` } };
};
export {
  handleCompactCommand
};
