const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function hasExplicitOptions(command, names) {
  if (typeof command.getOptionValueSource !== 'function') {
    return false;
  }
  return names.some((name) => command.getOptionValueSource(name) === 'cli');
}
__name(hasExplicitOptions, 'hasExplicitOptions');
export {
  hasExplicitOptions
};
