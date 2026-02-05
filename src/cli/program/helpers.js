const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function collectOption(value, previous = []) {
  return [...previous, value];
}
__name(collectOption, 'collectOption');
function parsePositiveIntOrUndefined(value) {
  if (value === void 0 || value === null || value === '') {
    return void 0;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return void 0;
    }
    const parsed = Math.trunc(value);
    return parsed > 0 ? parsed : void 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return void 0;
    }
    return parsed;
  }
  return void 0;
}
__name(parsePositiveIntOrUndefined, 'parsePositiveIntOrUndefined');
function resolveActionArgs(actionCommand) {
  if (!actionCommand) {
    return [];
  }
  const args = actionCommand.args;
  return Array.isArray(args) ? args : [];
}
__name(resolveActionArgs, 'resolveActionArgs');
export {
  collectOption,
  parsePositiveIntOrUndefined,
  resolveActionArgs
};
