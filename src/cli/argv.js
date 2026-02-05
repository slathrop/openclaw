const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const HELP_FLAGS = /* @__PURE__ */ new Set(['-h', '--help']);
const VERSION_FLAGS = /* @__PURE__ */ new Set(['-v', '-V', '--version']);
const FLAG_TERMINATOR = '--';
function hasHelpOrVersion(argv) {
  return argv.some((arg) => HELP_FLAGS.has(arg) || VERSION_FLAGS.has(arg));
}
__name(hasHelpOrVersion, 'hasHelpOrVersion');
function isValueToken(arg) {
  if (!arg) {
    return false;
  }
  if (arg === FLAG_TERMINATOR) {
    return false;
  }
  if (!arg.startsWith('-')) {
    return true;
  }
  return /^-\d+(?:\.\d+)?$/.test(arg);
}
__name(isValueToken, 'isValueToken');
function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return void 0;
  }
  return parsed;
}
__name(parsePositiveInt, 'parsePositiveInt');
function hasFlag(argv, name) {
  const args = argv.slice(2);
  for (const arg of args) {
    if (arg === FLAG_TERMINATOR) {
      break;
    }
    if (arg === name) {
      return true;
    }
  }
  return false;
}
__name(hasFlag, 'hasFlag');
function getFlagValue(argv, name) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === FLAG_TERMINATOR) {
      break;
    }
    if (arg === name) {
      const next = args[i + 1];
      return isValueToken(next) ? next : null;
    }
    if (arg.startsWith(`${name}=`)) {
      const value = arg.slice(name.length + 1);
      return value ? value : null;
    }
  }
  return void 0;
}
__name(getFlagValue, 'getFlagValue');
function getVerboseFlag(argv, options) {
  if (hasFlag(argv, '--verbose')) {
    return true;
  }
  if (options?.includeDebug && hasFlag(argv, '--debug')) {
    return true;
  }
  return false;
}
__name(getVerboseFlag, 'getVerboseFlag');
function getPositiveIntFlagValue(argv, name) {
  const raw = getFlagValue(argv, name);
  if (raw === null || raw === void 0) {
    return raw;
  }
  return parsePositiveInt(raw);
}
__name(getPositiveIntFlagValue, 'getPositiveIntFlagValue');
function getCommandPath(argv, depth = 2) {
  const args = argv.slice(2);
  const path = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === '--') {
      break;
    }
    if (arg.startsWith('-')) {
      continue;
    }
    path.push(arg);
    if (path.length >= depth) {
      break;
    }
  }
  return path;
}
__name(getCommandPath, 'getCommandPath');
function getPrimaryCommand(argv) {
  const [primary] = getCommandPath(argv, 1);
  return primary ?? null;
}
__name(getPrimaryCommand, 'getPrimaryCommand');
function buildParseArgv(params) {
  const baseArgv = params.rawArgs && params.rawArgs.length > 0 ? params.rawArgs : params.fallbackArgv && params.fallbackArgv.length > 0 ? params.fallbackArgv : process.argv;
  const programName = params.programName ?? '';
  const normalizedArgv = programName && baseArgv[0] === programName ? baseArgv.slice(1) : baseArgv[0]?.endsWith('openclaw') ? baseArgv.slice(1) : baseArgv;
  const executable = (normalizedArgv[0]?.split(/[/\\]/).pop() ?? '').toLowerCase();
  const looksLikeNode = normalizedArgv.length >= 2 && (isNodeExecutable(executable) || isBunExecutable(executable));
  if (looksLikeNode) {
    return normalizedArgv;
  }
  return ['node', programName || 'openclaw', ...normalizedArgv];
}
__name(buildParseArgv, 'buildParseArgv');
const nodeExecutablePattern = /^node-\d+(?:\.\d+)*(?:\.exe)?$/;
function isNodeExecutable(executable) {
  return executable === 'node' || executable === 'node.exe' || executable === 'nodejs' || executable === 'nodejs.exe' || nodeExecutablePattern.test(executable);
}
__name(isNodeExecutable, 'isNodeExecutable');
function isBunExecutable(executable) {
  return executable === 'bun' || executable === 'bun.exe';
}
__name(isBunExecutable, 'isBunExecutable');
function shouldMigrateStateFromPath(path) {
  if (path.length === 0) {
    return true;
  }
  const [primary, secondary] = path;
  if (primary === 'health' || primary === 'status' || primary === 'sessions') {
    return false;
  }
  if (primary === 'memory' && secondary === 'status') {
    return false;
  }
  if (primary === 'agent') {
    return false;
  }
  return true;
}
__name(shouldMigrateStateFromPath, 'shouldMigrateStateFromPath');
function shouldMigrateState(argv) {
  return shouldMigrateStateFromPath(getCommandPath(argv, 2));
}
__name(shouldMigrateState, 'shouldMigrateState');
export {
  buildParseArgv,
  getCommandPath,
  getFlagValue,
  getPositiveIntFlagValue,
  getPrimaryCommand,
  getVerboseFlag,
  hasFlag,
  hasHelpOrVersion,
  shouldMigrateState,
  shouldMigrateStateFromPath
};
