const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from '../infra/dotenv.js';
import { normalizeEnv } from '../infra/env.js';
import { formatUncaughtError } from '../infra/errors.js';
import { isMainModule } from '../infra/is-main.js';
import { ensureOpenClawCliOnPath } from '../infra/path-env.js';
import { assertSupportedRuntime } from '../infra/runtime-guard.js';
import { installUnhandledRejectionHandler } from '../infra/unhandled-rejections.js';
import { enableConsoleCapture } from '../logging.js';
import { getPrimaryCommand, hasHelpOrVersion } from './argv.js';
import { tryRouteCli } from './route.js';
function rewriteUpdateFlagArgv(argv) {
  const index = argv.indexOf('--update');
  if (index === -1) {
    return argv;
  }
  const next = [...argv];
  next.splice(index, 1, 'update');
  return next;
}
__name(rewriteUpdateFlagArgv, 'rewriteUpdateFlagArgv');
async function runCli(argv = process.argv) {
  const normalizedArgv = stripWindowsNodeExec(argv);
  loadDotEnv({ quiet: true });
  normalizeEnv();
  ensureOpenClawCliOnPath();
  assertSupportedRuntime();
  if (await tryRouteCli(normalizedArgv)) {
    return;
  }
  enableConsoleCapture();
  const { buildProgram } = await import('./program.js');
  const program = buildProgram();
  installUnhandledRejectionHandler();
  process.on('uncaughtException', (error) => {
    console.error('[openclaw] Uncaught exception:', formatUncaughtError(error));
    process.exit(1);
  });
  const parseArgv = rewriteUpdateFlagArgv(normalizedArgv);
  const primary = getPrimaryCommand(parseArgv);
  if (primary) {
    const { registerSubCliByName } = await import('./program/register.subclis.js');
    await registerSubCliByName(program, primary);
  }
  const shouldSkipPluginRegistration = !primary && hasHelpOrVersion(parseArgv);
  if (!shouldSkipPluginRegistration) {
    const { registerPluginCliCommands } = await import('../plugins/cli.js');
    const { loadConfig } = await import('../config/config.js');
    registerPluginCliCommands(program, loadConfig());
  }
  await program.parseAsync(parseArgv);
}
__name(runCli, 'runCli');
function stripWindowsNodeExec(argv) {
  if (process.platform !== 'win32') {
    return argv;
  }
  const stripControlChars = /* @__PURE__ */ __name((value) => {
    let out = '';
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code >= 32 && code !== 127) {
        out += value[i];
      }
    }
    return out;
  }, 'stripControlChars');
  const normalizeArg = /* @__PURE__ */ __name((value) => stripControlChars(value).replace(/^['"]+|['"]+$/g, '').trim(), 'normalizeArg');
  const normalizeCandidate = /* @__PURE__ */ __name((value) => normalizeArg(value).replace(/^\\\\\\?\\/, ''), 'normalizeCandidate');
  const execPath = normalizeCandidate(process.execPath);
  const execPathLower = execPath.toLowerCase();
  const execBase = path.basename(execPath).toLowerCase();
  const isExecPath = /* @__PURE__ */ __name((value) => {
    if (!value) {
      return false;
    }
    const normalized = normalizeCandidate(value);
    if (!normalized) {
      return false;
    }
    const lower = normalized.toLowerCase();
    return lower === execPathLower || path.basename(lower) === execBase || lower.endsWith('\\node.exe') || lower.endsWith('/node.exe') || lower.includes('node.exe') || path.basename(lower) === 'node.exe' && fs.existsSync(normalized);
  }, 'isExecPath');
  const filtered = argv.filter((arg, index) => index === 0 || !isExecPath(arg));
  if (filtered.length < 3) {
    return filtered;
  }
  const cleaned = [...filtered];
  if (isExecPath(cleaned[1])) {
    cleaned.splice(1, 1);
  }
  if (isExecPath(cleaned[2])) {
    cleaned.splice(2, 1);
  }
  return cleaned;
}
__name(stripWindowsNodeExec, 'stripWindowsNodeExec');
function isCliMainModule() {
  return isMainModule({ currentFile: fileURLToPath(import.meta.url) });
}
__name(isCliMainModule, 'isCliMainModule');
export {
  isCliMainModule,
  rewriteUpdateFlagArgv,
  runCli
};
