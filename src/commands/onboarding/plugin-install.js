const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import path from 'node:path';
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from '../../agents/agent-scope.js';
import { createSubsystemLogger } from '../../logging/subsystem.js';
import { enablePluginInConfig } from '../../plugins/enable.js';
import { installPluginFromNpmSpec } from '../../plugins/install.js';
import { recordPluginInstall } from '../../plugins/installs.js';
import { loadOpenClawPlugins } from '../../plugins/loader.js';
function hasGitWorkspace(workspaceDir) {
  const candidates = /* @__PURE__ */ new Set();
  candidates.add(path.join(process.cwd(), '.git'));
  if (workspaceDir && workspaceDir !== process.cwd()) {
    candidates.add(path.join(workspaceDir, '.git'));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return true;
    }
  }
  return false;
}
__name(hasGitWorkspace, 'hasGitWorkspace');
function resolveLocalPath(entry, workspaceDir, allowLocal) {
  if (!allowLocal) {
    return null;
  }
  const raw = entry.install.localPath?.trim();
  if (!raw) {
    return null;
  }
  const candidates = /* @__PURE__ */ new Set();
  candidates.add(path.resolve(process.cwd(), raw));
  if (workspaceDir && workspaceDir !== process.cwd()) {
    candidates.add(path.resolve(workspaceDir, raw));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
__name(resolveLocalPath, 'resolveLocalPath');
function addPluginLoadPath(cfg, pluginPath) {
  const existing = cfg.plugins?.load?.paths ?? [];
  const merged = Array.from(/* @__PURE__ */ new Set([...existing, pluginPath]));
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      load: {
        ...cfg.plugins?.load,
        paths: merged
      }
    }
  };
}
__name(addPluginLoadPath, 'addPluginLoadPath');
async function promptInstallChoice(params) {
  const { entry, localPath, prompter, defaultChoice } = params;
  const localOptions = localPath ? [
    {
      value: 'local',
      label: 'Use local plugin path',
      hint: localPath
    }
  ] : [];
  const options = [
    { value: 'npm', label: `Download from npm (${entry.install.npmSpec})` },
    ...localOptions,
    { value: 'skip', label: 'Skip for now' }
  ];
  const initialValue = defaultChoice === 'local' && !localPath ? 'npm' : defaultChoice;
  return await prompter.select({
    message: `Install ${entry.meta.label} plugin?`,
    options,
    initialValue
  });
}
__name(promptInstallChoice, 'promptInstallChoice');
function resolveInstallDefaultChoice(params) {
  const { cfg, entry, localPath } = params;
  const updateChannel = cfg.update?.channel;
  if (updateChannel === 'dev') {
    return localPath ? 'local' : 'npm';
  }
  if (updateChannel === 'stable' || updateChannel === 'beta') {
    return 'npm';
  }
  const entryDefault = entry.install.defaultChoice;
  if (entryDefault === 'local') {
    return localPath ? 'local' : 'npm';
  }
  if (entryDefault === 'npm') {
    return 'npm';
  }
  return localPath ? 'local' : 'npm';
}
__name(resolveInstallDefaultChoice, 'resolveInstallDefaultChoice');
async function ensureOnboardingPluginInstalled(params) {
  const { entry, prompter, runtime, workspaceDir } = params;
  let next = params.cfg;
  const allowLocal = hasGitWorkspace(workspaceDir);
  const localPath = resolveLocalPath(entry, workspaceDir, allowLocal);
  const defaultChoice = resolveInstallDefaultChoice({
    cfg: next,
    entry,
    localPath
  });
  const choice = await promptInstallChoice({
    entry,
    localPath,
    defaultChoice,
    prompter
  });
  if (choice === 'skip') {
    return { cfg: next, installed: false };
  }
  if (choice === 'local' && localPath) {
    next = addPluginLoadPath(next, localPath);
    next = enablePluginInConfig(next, entry.id).config;
    return { cfg: next, installed: true };
  }
  const result = await installPluginFromNpmSpec({
    spec: entry.install.npmSpec,
    logger: {
      info: /* @__PURE__ */ __name((msg) => runtime.log?.(msg), 'info'),
      warn: /* @__PURE__ */ __name((msg) => runtime.log?.(msg), 'warn')
    }
  });
  if (result.ok) {
    next = enablePluginInConfig(next, result.pluginId).config;
    next = recordPluginInstall(next, {
      pluginId: result.pluginId,
      source: 'npm',
      spec: entry.install.npmSpec,
      installPath: result.targetDir,
      version: result.version
    });
    return { cfg: next, installed: true };
  }
  await prompter.note(
    `Failed to install ${entry.install.npmSpec}: ${result.error}`,
    'Plugin install'
  );
  if (localPath) {
    const fallback = await prompter.confirm({
      message: `Use local plugin path instead? (${localPath})`,
      initialValue: true
    });
    if (fallback) {
      next = addPluginLoadPath(next, localPath);
      next = enablePluginInConfig(next, entry.id).config;
      return { cfg: next, installed: true };
    }
  }
  runtime.error?.(`Plugin install failed: ${result.error}`);
  return { cfg: next, installed: false };
}
__name(ensureOnboardingPluginInstalled, 'ensureOnboardingPluginInstalled');
function reloadOnboardingPluginRegistry(params) {
  const workspaceDir = params.workspaceDir ?? resolveAgentWorkspaceDir(params.cfg, resolveDefaultAgentId(params.cfg));
  const log = createSubsystemLogger('plugins');
  loadOpenClawPlugins({
    config: params.cfg,
    workspaceDir,
    cache: false,
    logger: {
      info: /* @__PURE__ */ __name((msg) => log.info(msg), 'info'),
      warn: /* @__PURE__ */ __name((msg) => log.warn(msg), 'warn'),
      error: /* @__PURE__ */ __name((msg) => log.error(msg), 'error'),
      debug: /* @__PURE__ */ __name((msg) => log.debug(msg), 'debug')
    }
  });
}
__name(reloadOnboardingPluginRegistry, 'reloadOnboardingPluginRegistry');
export {
  ensureOnboardingPluginInstalled,
  reloadOnboardingPluginRegistry
};
