import { handleDirectiveOnly } from './directive-handling.impl.js';
import { isDirectiveOnly } from './directive-handling.parse.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

async function applyInlineDirectivesFastLane(params) {
  const {
    directives,
    commandAuthorized,
    ctx,
    cfg,
    agentId,
    isGroup,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    elevatedEnabled,
    elevatedAllowed,
    elevatedFailures,
    messageProviderKey,
    defaultProvider,
    defaultModel,
    aliasIndex,
    allowedModelKeys,
    allowedModelCatalog,
    resetModelOverride,
    formatModelSwitchEvent,
    modelState
  } = params;
  let { provider, model } = params;
  if (!commandAuthorized || isDirectiveOnly({
    directives,
    cleanedBody: directives.cleaned,
    ctx,
    cfg,
    agentId,
    isGroup
  })) {
    return { directiveAck: void 0, provider, model };
  }
  const agentCfg = params.agentCfg;
  const resolvedDefaultThinkLevel = sessionEntry?.thinkingLevel ?? agentCfg?.thinkingDefault ?? await modelState.resolveDefaultThinkingLevel();
  const currentThinkLevel = resolvedDefaultThinkLevel;
  const currentVerboseLevel = sessionEntry?.verboseLevel ?? agentCfg?.verboseDefault;
  const currentReasoningLevel = sessionEntry?.reasoningLevel ?? 'off';
  const currentElevatedLevel = sessionEntry?.elevatedLevel ?? agentCfg?.elevatedDefault;
  const directiveAck = await handleDirectiveOnly({
    cfg,
    directives,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    elevatedEnabled,
    elevatedAllowed,
    elevatedFailures,
    messageProviderKey,
    defaultProvider,
    defaultModel,
    aliasIndex,
    allowedModelKeys,
    allowedModelCatalog,
    resetModelOverride,
    provider,
    model,
    initialModelLabel: params.initialModelLabel,
    formatModelSwitchEvent,
    currentThinkLevel,
    currentVerboseLevel,
    currentReasoningLevel,
    currentElevatedLevel
  });
  if (sessionEntry?.providerOverride) {
    provider = sessionEntry.providerOverride;
  }
  if (sessionEntry?.modelOverride) {
    model = sessionEntry.modelOverride;
  }
  return { directiveAck, provider, model };
}
export {
  applyInlineDirectivesFastLane
};
