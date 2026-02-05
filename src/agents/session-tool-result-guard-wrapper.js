/**
 * @module session-tool-result-guard-wrapper
 * Wrapper that guards session manager tool result flushing.
 */
import { getGlobalHookRunner } from '../plugins/hook-runner-global.js';
import { installSessionToolResultGuard } from './session-tool-result-guard.js';
function guardSessionManager(sessionManager, opts) {
  if (typeof sessionManager.flushPendingToolResults === 'function') {
    return sessionManager;
  }
  const hookRunner = getGlobalHookRunner();
  const transform = hookRunner?.hasHooks('tool_result_persist') ? (
    // oxlint-disable-next-line typescript/no-explicit-any
    (message, meta) => {
      const out = hookRunner.runToolResultPersist(
        {
          toolName: meta.toolName,
          toolCallId: meta.toolCallId,
          message,
          isSynthetic: meta.isSynthetic
        },
        {
          agentId: opts?.agentId,
          sessionKey: opts?.sessionKey,
          toolName: meta.toolName,
          toolCallId: meta.toolCallId
        }
      );
      return out?.message ?? message;
    }
  ) : void 0;
  const guard = installSessionToolResultGuard(sessionManager, {
    transformToolResultForPersistence: transform,
    allowSyntheticToolResults: opts?.allowSyntheticToolResults
  });
  sessionManager.flushPendingToolResults = guard.flushPendingToolResults;
  return sessionManager;
}
export {
  guardSessionManager
};
