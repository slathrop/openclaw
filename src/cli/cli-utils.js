const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function formatErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
__name(formatErrorMessage, 'formatErrorMessage');
async function withManager(params) {
  const { manager, error } = await params.getManager();
  if (!manager) {
    params.onMissing(error);
    return;
  }
  try {
    await params.run(manager);
  } finally {
    try {
      await params.close(manager);
    } catch (err) {
      params.onCloseError?.(err);
    }
  }
}
__name(withManager, 'withManager');
async function runCommandWithRuntime(runtime, action, onError) {
  try {
    await action();
  } catch (err) {
    if (onError) {
      onError(err);
      return;
    }
    runtime.error(String(err));
    runtime.exit(1);
  }
}
__name(runCommandWithRuntime, 'runCommandWithRuntime');
function resolveOptionFromCommand(command, key) {
  let current = command;
  while (current) {
    const opts = current.opts?.() ?? {};
    if (opts[key] !== void 0) {
      return opts[key];
    }
    current = current.parent ?? void 0;
  }
  return void 0;
}
__name(resolveOptionFromCommand, 'resolveOptionFromCommand');
export {
  formatErrorMessage,
  resolveOptionFromCommand,
  runCommandWithRuntime,
  withManager
};
