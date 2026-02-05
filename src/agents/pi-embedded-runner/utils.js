/**
 * Utility functions for Pi embedded runner operations.
 * @param level
 * @module agents/pi-embedded-runner/utils
 */
function mapThinkingLevel(level) {
  if (!level) {
    return 'off';
  }
  return level;
}
function resolveExecToolDefaults(config) {
  const tools = config?.tools;
  if (!tools?.exec) {
    return void 0;
  }
  return tools.exec;
}
function describeUnknownError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}
export {
  describeUnknownError,
  mapThinkingLevel,
  resolveExecToolDefaults
};
