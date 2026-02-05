/**
 * @module pi-tool-definition-adapter
 * Adapts legacy and modern tool definitions to the Pi agent tool format.
 */
import { logDebug, logError } from '../logger.js';
import { runBeforeToolCallHook } from './pi-tools.before-tool-call.js';
import { normalizeToolName } from './tool-policy.js';
import { jsonResult } from './tools/common.js';
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isAbortSignal(value) {
  return typeof value === 'object' && value !== null && 'aborted' in value;
}
function isLegacyToolExecuteArgs(args) {
  const third = args[2];
  const fourth = args[3];
  return isAbortSignal(third) || typeof fourth === 'function';
}
function describeToolExecutionError(err) {
  if (err instanceof Error) {
    const message = err.message?.trim() ? err.message : String(err);
    return { message, stack: err.stack };
  }
  return { message: String(err) };
}
function splitToolExecuteArgs(args) {
  if (isLegacyToolExecuteArgs(args)) {
    const [toolCallId2, params2, signal2, onUpdate2] = args;
    return {
      toolCallId: toolCallId2,
      params: params2,
      onUpdate: onUpdate2,
      signal: signal2
    };
  }
  const [toolCallId, params, onUpdate, _ctx, signal] = args;
  return {
    toolCallId,
    params,
    onUpdate,
    signal
  };
}
function toToolDefinitions(tools) {
  return tools.map((tool) => {
    const name = tool.name || 'tool';
    const normalizedName = normalizeToolName(name);
    return {
      name,
      label: tool.label ?? name,
      description: tool.description ?? '',
      parameters: tool.parameters,
      execute: async (...args) => {
        const { toolCallId, params, onUpdate, signal } = splitToolExecuteArgs(args);
        try {
          return await tool.execute(toolCallId, params, signal, onUpdate);
        } catch (err) {
          if (signal?.aborted) {
            throw err;
          }
          const name2 = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
          if (name2 === 'AbortError') {
            throw err;
          }
          const described = describeToolExecutionError(err);
          if (described.stack && described.stack !== described.message) {
            logDebug(`tools: ${normalizedName} failed stack:
${described.stack}`);
          }
          logError(`[tools] ${normalizedName} failed: ${described.message}`);
          return jsonResult({
            status: 'error',
            tool: normalizedName,
            error: described.message
          });
        }
      }
    };
  });
}
function toClientToolDefinitions(tools, onClientToolCall, hookContext) {
  return tools.map((tool) => {
    const func = tool.function;
    return {
      name: func.name,
      label: func.name,
      description: func.description ?? '',
      // oxlint-disable-next-line typescript/no-explicit-any
      parameters: func.parameters,
      execute: async (...args) => {
        const { toolCallId, params } = splitToolExecuteArgs(args);
        const outcome = await runBeforeToolCallHook({
          toolName: func.name,
          params,
          toolCallId,
          ctx: hookContext
        });
        if (outcome.blocked) {
          throw new Error(outcome.reason);
        }
        const adjustedParams = outcome.params;
        const paramsRecord = isPlainObject(adjustedParams) ? adjustedParams : {};
        if (onClientToolCall) {
          onClientToolCall(func.name, paramsRecord);
        }
        return jsonResult({
          status: 'pending',
          tool: func.name,
          message: 'Tool execution delegated to client'
        });
      }
    };
  });
}
export {
  toClientToolDefinitions,
  toToolDefinitions
};
