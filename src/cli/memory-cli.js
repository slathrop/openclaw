const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveDefaultAgentId } from '../agents/agent-scope.js';
import { loadConfig } from '../config/config.js';
import { resolveStateDir } from '../config/paths.js';
import { resolveSessionTranscriptsDirForAgent } from '../config/sessions/paths.js';
import { setVerbose } from '../globals.js';
import { getMemorySearchManager } from '../memory/index.js';
import { listMemoryFiles, normalizeExtraMemoryPaths } from '../memory/internal.js';
import { defaultRuntime } from '../runtime.js';
import { formatDocsLink } from '../terminal/links.js';
import { colorize, isRich, theme } from '../terminal/theme.js';
import { shortenHomeInString, shortenHomePath } from '../utils.js';
import { formatErrorMessage, withManager } from './cli-utils.js';
import { withProgress, withProgressTotals } from './progress.js';
function formatSourceLabel(source, workspaceDir, agentId) {
  if (source === 'memory') {
    return shortenHomeInString(
      `memory (MEMORY.md + ${path.join(workspaceDir, 'memory')}${path.sep}*.md)`
    );
  }
  if (source === 'sessions') {
    const stateDir = resolveStateDir(process.env, os.homedir);
    return shortenHomeInString(
      `sessions (${path.join(stateDir, 'agents', agentId, 'sessions')}${path.sep}*.jsonl)`
    );
  }
  return source;
}
__name(formatSourceLabel, 'formatSourceLabel');
function resolveAgent(cfg, agent) {
  const trimmed = agent?.trim();
  if (trimmed) {
    return trimmed;
  }
  return resolveDefaultAgentId(cfg);
}
__name(resolveAgent, 'resolveAgent');
function resolveAgentIds(cfg, agent) {
  const trimmed = agent?.trim();
  if (trimmed) {
    return [trimmed];
  }
  const list = cfg.agents?.list ?? [];
  if (list.length > 0) {
    return list.map((entry) => entry.id).filter(Boolean);
  }
  return [resolveDefaultAgentId(cfg)];
}
__name(resolveAgentIds, 'resolveAgentIds');
function formatExtraPaths(workspaceDir, extraPaths) {
  return normalizeExtraMemoryPaths(workspaceDir, extraPaths).map((entry) => shortenHomePath(entry));
}
__name(formatExtraPaths, 'formatExtraPaths');
async function checkReadableFile(pathname) {
  try {
    await fs.access(pathname, fsSync.constants.R_OK);
    return { exists: true };
  } catch (err) {
    const code = err.code;
    if (code === 'ENOENT') {
      return { exists: false };
    }
    return {
      exists: true,
      issue: `${shortenHomePath(pathname)} not readable (${code ?? 'error'})`
    };
  }
}
__name(checkReadableFile, 'checkReadableFile');
async function scanSessionFiles(agentId) {
  const issues = [];
  const sessionsDir = resolveSessionTranscriptsDirForAgent(agentId);
  try {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    const totalFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
    ).length;
    return { source: 'sessions', totalFiles, issues };
  } catch (err) {
    const code = err.code;
    if (code === 'ENOENT') {
      issues.push(`sessions directory missing (${shortenHomePath(sessionsDir)})`);
      return { source: 'sessions', totalFiles: 0, issues };
    }
    issues.push(
      `sessions directory not accessible (${shortenHomePath(sessionsDir)}): ${code ?? 'error'}`
    );
    return { source: 'sessions', totalFiles: null, issues };
  }
}
__name(scanSessionFiles, 'scanSessionFiles');
async function scanMemoryFiles(workspaceDir, extraPaths = []) {
  const issues = [];
  const memoryFile = path.join(workspaceDir, 'MEMORY.md');
  const altMemoryFile = path.join(workspaceDir, 'memory.md');
  const memoryDir = path.join(workspaceDir, 'memory');
  const primary = await checkReadableFile(memoryFile);
  const alt = await checkReadableFile(altMemoryFile);
  if (primary.issue) {
    issues.push(primary.issue);
  }
  if (alt.issue) {
    issues.push(alt.issue);
  }
  const resolvedExtraPaths = normalizeExtraMemoryPaths(workspaceDir, extraPaths);
  for (const extraPath of resolvedExtraPaths) {
    try {
      const stat = await fs.lstat(extraPath);
      if (stat.isSymbolicLink()) {
        continue;
      }
      const extraCheck = await checkReadableFile(extraPath);
      if (extraCheck.issue) {
        issues.push(extraCheck.issue);
      }
    } catch (err) {
      const code = err.code;
      if (code === 'ENOENT') {
        issues.push(`additional memory path missing (${shortenHomePath(extraPath)})`);
      } else {
        issues.push(
          `additional memory path not accessible (${shortenHomePath(extraPath)}): ${code ?? 'error'}`
        );
      }
    }
  }
  let dirReadable = null;
  try {
    await fs.access(memoryDir, fsSync.constants.R_OK);
    dirReadable = true;
  } catch (err) {
    const code = err.code;
    if (code === 'ENOENT') {
      issues.push(`memory directory missing (${shortenHomePath(memoryDir)})`);
      dirReadable = false;
    } else {
      issues.push(
        `memory directory not accessible (${shortenHomePath(memoryDir)}): ${code ?? 'error'}`
      );
      dirReadable = null;
    }
  }
  let listed = [];
  let listedOk = false;
  try {
    listed = await listMemoryFiles(workspaceDir, resolvedExtraPaths);
    listedOk = true;
  } catch (err) {
    const code = err.code;
    if (dirReadable !== null) {
      issues.push(
        `memory directory scan failed (${shortenHomePath(memoryDir)}): ${code ?? 'error'}`
      );
      dirReadable = null;
    }
  }
  let totalFiles = 0;
  if (dirReadable === null) {
    totalFiles = null;
  } else {
    const files = new Set(listedOk ? listed : []);
    if (!listedOk) {
      if (primary.exists) {
        files.add(memoryFile);
      }
      if (alt.exists) {
        files.add(altMemoryFile);
      }
    }
    totalFiles = files.size;
  }
  if ((totalFiles ?? 0) === 0 && issues.length === 0) {
    issues.push(`no memory files found in ${shortenHomePath(workspaceDir)}`);
  }
  return { source: 'memory', totalFiles, issues };
}
__name(scanMemoryFiles, 'scanMemoryFiles');
async function scanMemorySources(params) {
  const scans = [];
  const extraPaths = params.extraPaths ?? [];
  for (const source of params.sources) {
    if (source === 'memory') {
      scans.push(await scanMemoryFiles(params.workspaceDir, extraPaths));
    }
    if (source === 'sessions') {
      scans.push(await scanSessionFiles(params.agentId));
    }
  }
  const issues = scans.flatMap((scan) => scan.issues);
  const totals = scans.map((scan) => scan.totalFiles);
  const numericTotals = totals.filter((total) => total !== null);
  const totalFiles = totals.some((total) => total === null) ? null : numericTotals.reduce((sum, total) => sum + total, 0);
  return { sources: scans, totalFiles, issues };
}
__name(scanMemorySources, 'scanMemorySources');
async function runMemoryStatus(opts) {
  setVerbose(Boolean(opts.verbose));
  const cfg = loadConfig();
  const agentIds = resolveAgentIds(cfg, opts.agent);
  const allResults = [];
  for (const agentId of agentIds) {
    await withManager({
      getManager: /* @__PURE__ */ __name(() => getMemorySearchManager({ cfg, agentId }), 'getManager'),
      onMissing: /* @__PURE__ */ __name((error) => defaultRuntime.log(error ?? 'Memory search disabled.'), 'onMissing'),
      onCloseError: /* @__PURE__ */ __name((err) => defaultRuntime.error(`Memory manager close failed: ${formatErrorMessage(err)}`), 'onCloseError'),
      close: /* @__PURE__ */ __name(async (manager) => {
        await manager.close?.();
      }, 'close'),
      run: /* @__PURE__ */ __name(async (manager) => {
        const deep = Boolean(opts.deep || opts.index);
        let embeddingProbe;
        let indexError;
        const syncFn = manager.sync ? manager.sync.bind(manager) : void 0;
        if (deep) {
          await withProgress({ label: 'Checking memory\u2026', total: 2 }, async (progress) => {
            progress.setLabel('Probing vector\u2026');
            await manager.probeVectorAvailability();
            progress.tick();
            progress.setLabel('Probing embeddings\u2026');
            embeddingProbe = await manager.probeEmbeddingAvailability();
            progress.tick();
          });
          if (opts.index && syncFn) {
            await withProgressTotals(
              {
                label: 'Indexing memory\u2026',
                total: 0,
                fallback: opts.verbose ? 'line' : void 0
              },
              async (update, progress) => {
                try {
                  await syncFn({
                    reason: 'cli',
                    force: Boolean(opts.force),
                    progress: /* @__PURE__ */ __name((syncUpdate) => {
                      update({
                        completed: syncUpdate.completed,
                        total: syncUpdate.total,
                        label: syncUpdate.label
                      });
                      if (syncUpdate.label) {
                        progress.setLabel(syncUpdate.label);
                      }
                    }, 'progress')
                  });
                } catch (err) {
                  indexError = formatErrorMessage(err);
                  defaultRuntime.error(`Memory index failed: ${indexError}`);
                  process.exitCode = 1;
                }
              }
            );
          } else if (opts.index && !syncFn) {
            defaultRuntime.log('Memory backend does not support manual reindex.');
          }
        } else {
          await manager.probeVectorAvailability();
        }
        const status = manager.status();
        const sources = status.sources?.length ? status.sources : ['memory'];
        const workspaceDir = status.workspaceDir;
        const scan = workspaceDir ? await scanMemorySources({
          workspaceDir,
          agentId,
          sources,
          extraPaths: status.extraPaths
        }) : void 0;
        allResults.push({ agentId, status, embeddingProbe, indexError, scan });
      }, 'run')
    });
  }
  if (opts.json) {
    defaultRuntime.log(JSON.stringify(allResults, null, 2));
    return;
  }
  const rich = isRich();
  const heading = /* @__PURE__ */ __name((text) => colorize(rich, theme.heading, text), 'heading');
  const muted = /* @__PURE__ */ __name((text) => colorize(rich, theme.muted, text), 'muted');
  const info = /* @__PURE__ */ __name((text) => colorize(rich, theme.info, text), 'info');
  const success = /* @__PURE__ */ __name((text) => colorize(rich, theme.success, text), 'success');
  const warn = /* @__PURE__ */ __name((text) => colorize(rich, theme.warn, text), 'warn');
  const accent = /* @__PURE__ */ __name((text) => colorize(rich, theme.accent, text), 'accent');
  const label = /* @__PURE__ */ __name((text) => muted(`${text}:`), 'label');
  for (const result of allResults) {
    const { agentId, status, embeddingProbe, indexError, scan } = result;
    const filesIndexed = status.files ?? 0;
    const chunksIndexed = status.chunks ?? 0;
    const totalFiles = scan?.totalFiles ?? null;
    const indexedLabel = totalFiles === null ? `${filesIndexed}/? files \xB7 ${chunksIndexed} chunks` : `${filesIndexed}/${totalFiles} files \xB7 ${chunksIndexed} chunks`;
    if (opts.index) {
      const line = indexError ? `Memory index failed: ${indexError}` : 'Memory index complete.';
      defaultRuntime.log(line);
    }
    const requestedProvider = status.requestedProvider ?? status.provider;
    const modelLabel = status.model ?? status.provider;
    const storePath = status.dbPath ? shortenHomePath(status.dbPath) : '<unknown>';
    const workspacePath = status.workspaceDir ? shortenHomePath(status.workspaceDir) : '<unknown>';
    const sourceList = status.sources?.length ? status.sources.join(', ') : null;
    const extraPaths = status.workspaceDir ? formatExtraPaths(status.workspaceDir, status.extraPaths ?? []) : [];
    const lines = [
      `${heading('Memory Search')} ${muted(`(${agentId})`)}`,
      `${label('Provider')} ${info(status.provider)} ${muted(`(requested: ${requestedProvider})`)}`,
      `${label('Model')} ${info(modelLabel)}`,
      sourceList ? `${label('Sources')} ${info(sourceList)}` : null,
      extraPaths.length ? `${label('Extra paths')} ${info(extraPaths.join(', '))}` : null,
      `${label('Indexed')} ${success(indexedLabel)}`,
      `${label('Dirty')} ${status.dirty ? warn('yes') : muted('no')}`,
      `${label('Store')} ${info(storePath)}`,
      `${label('Workspace')} ${info(workspacePath)}`
    ].filter(Boolean);
    if (embeddingProbe) {
      const state = embeddingProbe.ok ? 'ready' : 'unavailable';
      const stateColor = embeddingProbe.ok ? theme.success : theme.warn;
      lines.push(`${label('Embeddings')} ${colorize(rich, stateColor, state)}`);
      if (embeddingProbe.error) {
        lines.push(`${label('Embeddings error')} ${warn(embeddingProbe.error)}`);
      }
    }
    if (status.sourceCounts?.length) {
      lines.push(label('By source'));
      for (const entry of status.sourceCounts) {
        const total = scan?.sources?.find(
          (scanEntry) => scanEntry.source === entry.source
        )?.totalFiles;
        const counts = total === null ? `${entry.files}/? files \xB7 ${entry.chunks} chunks` : `${entry.files}/${total} files \xB7 ${entry.chunks} chunks`;
        lines.push(`  ${accent(entry.source)} ${muted('\xB7')} ${muted(counts)}`);
      }
    }
    if (status.fallback) {
      lines.push(`${label('Fallback')} ${warn(status.fallback.from)}`);
    }
    if (status.vector) {
      const vectorState = status.vector.enabled ? status.vector.available === void 0 ? 'unknown' : status.vector.available ? 'ready' : 'unavailable' : 'disabled';
      const vectorColor = vectorState === 'ready' ? theme.success : vectorState === 'unavailable' ? theme.warn : theme.muted;
      lines.push(`${label('Vector')} ${colorize(rich, vectorColor, vectorState)}`);
      if (status.vector.dims) {
        lines.push(`${label('Vector dims')} ${info(String(status.vector.dims))}`);
      }
      if (status.vector.extensionPath) {
        lines.push(`${label('Vector path')} ${info(shortenHomePath(status.vector.extensionPath))}`);
      }
      if (status.vector.loadError) {
        lines.push(`${label('Vector error')} ${warn(status.vector.loadError)}`);
      }
    }
    if (status.fts) {
      const ftsState = status.fts.enabled ? status.fts.available ? 'ready' : 'unavailable' : 'disabled';
      const ftsColor = ftsState === 'ready' ? theme.success : ftsState === 'unavailable' ? theme.warn : theme.muted;
      lines.push(`${label('FTS')} ${colorize(rich, ftsColor, ftsState)}`);
      if (status.fts.error) {
        lines.push(`${label('FTS error')} ${warn(status.fts.error)}`);
      }
    }
    if (status.cache) {
      const cacheState = status.cache.enabled ? 'enabled' : 'disabled';
      const cacheColor = status.cache.enabled ? theme.success : theme.muted;
      const suffix = status.cache.enabled && typeof status.cache.entries === 'number' ? ` (${status.cache.entries} entries)` : '';
      lines.push(`${label('Embedding cache')} ${colorize(rich, cacheColor, cacheState)}${suffix}`);
      if (status.cache.enabled && typeof status.cache.maxEntries === 'number') {
        lines.push(`${label('Cache cap')} ${info(String(status.cache.maxEntries))}`);
      }
    }
    if (status.batch) {
      const batchState = status.batch.enabled ? 'enabled' : 'disabled';
      const batchColor = status.batch.enabled ? theme.success : theme.warn;
      const batchSuffix = ` (failures ${status.batch.failures}/${status.batch.limit})`;
      lines.push(
        `${label('Batch')} ${colorize(rich, batchColor, batchState)}${muted(batchSuffix)}`
      );
      if (status.batch.lastError) {
        lines.push(`${label('Batch error')} ${warn(status.batch.lastError)}`);
      }
    }
    if (status.fallback?.reason) {
      lines.push(muted(status.fallback.reason));
    }
    if (indexError) {
      lines.push(`${label('Index error')} ${warn(indexError)}`);
    }
    if (scan?.issues.length) {
      lines.push(label('Issues'));
      for (const issue of scan.issues) {
        lines.push(`  ${warn(issue)}`);
      }
    }
    defaultRuntime.log(lines.join('\n'));
    defaultRuntime.log('');
  }
}
__name(runMemoryStatus, 'runMemoryStatus');
function registerMemoryCli(program) {
  const memory = program.command('memory').description('Memory search tools').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/memory', 'docs.openclaw.ai/cli/memory')}
`
  );
  memory.command('status').description('Show memory search index status').option('--agent <id>', 'Agent id (default: default agent)').option('--json', 'Print JSON').option('--deep', 'Probe embedding provider availability').option('--index', 'Reindex if dirty (implies --deep)').option('--verbose', 'Verbose logging', false).action(async (opts) => {
    await runMemoryStatus(opts);
  });
  memory.command('index').description('Reindex memory files').option('--agent <id>', 'Agent id (default: default agent)').option('--force', 'Force full reindex', false).option('--verbose', 'Verbose logging', false).action(async (opts) => {
    setVerbose(Boolean(opts.verbose));
    const cfg = loadConfig();
    const agentIds = resolveAgentIds(cfg, opts.agent);
    for (const agentId of agentIds) {
      await withManager({
        getManager: /* @__PURE__ */ __name(() => getMemorySearchManager({ cfg, agentId }), 'getManager'),
        onMissing: /* @__PURE__ */ __name((error) => defaultRuntime.log(error ?? 'Memory search disabled.'), 'onMissing'),
        onCloseError: /* @__PURE__ */ __name((err) => defaultRuntime.error(`Memory manager close failed: ${formatErrorMessage(err)}`), 'onCloseError'),
        close: /* @__PURE__ */ __name(async (manager) => {
          await manager.close?.();
        }, 'close'),
        run: /* @__PURE__ */ __name(async (manager) => {
          try {
            const syncFn = manager.sync ? manager.sync.bind(manager) : void 0;
            if (opts.verbose) {
              const status = manager.status();
              const rich = isRich();
              const heading = /* @__PURE__ */ __name((text) => colorize(rich, theme.heading, text), 'heading');
              const muted = /* @__PURE__ */ __name((text) => colorize(rich, theme.muted, text), 'muted');
              const info = /* @__PURE__ */ __name((text) => colorize(rich, theme.info, text), 'info');
              const warn = /* @__PURE__ */ __name((text) => colorize(rich, theme.warn, text), 'warn');
              const label = /* @__PURE__ */ __name((text) => muted(`${text}:`), 'label');
              const sourceLabels = (status.sources ?? []).map(
                (source) => formatSourceLabel(source, status.workspaceDir ?? '', agentId)
              );
              const extraPaths = status.workspaceDir ? formatExtraPaths(status.workspaceDir, status.extraPaths ?? []) : [];
              const requestedProvider = status.requestedProvider ?? status.provider;
              const modelLabel = status.model ?? status.provider;
              const lines = [
                `${heading('Memory Index')} ${muted(`(${agentId})`)}`,
                `${label('Provider')} ${info(status.provider)} ${muted(
                  `(requested: ${requestedProvider})`
                )}`,
                `${label('Model')} ${info(modelLabel)}`,
                sourceLabels.length ? `${label('Sources')} ${info(sourceLabels.join(', '))}` : null,
                extraPaths.length ? `${label('Extra paths')} ${info(extraPaths.join(', '))}` : null
              ].filter(Boolean);
              if (status.fallback) {
                lines.push(`${label('Fallback')} ${warn(status.fallback.from)}`);
              }
              defaultRuntime.log(lines.join('\n'));
              defaultRuntime.log('');
            }
            const startedAt = Date.now();
            let lastLabel = 'Indexing memory\u2026';
            let lastCompleted = 0;
            let lastTotal = 0;
            const formatElapsed = /* @__PURE__ */ __name(() => {
              const elapsedMs = Math.max(0, Date.now() - startedAt);
              const seconds = Math.floor(elapsedMs / 1e3);
              const minutes = Math.floor(seconds / 60);
              const remainingSeconds = seconds % 60;
              return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
            }, 'formatElapsed');
            const formatEta = /* @__PURE__ */ __name(() => {
              if (lastTotal <= 0 || lastCompleted <= 0) {
                return null;
              }
              const elapsedMs = Math.max(1, Date.now() - startedAt);
              const rate = lastCompleted / elapsedMs;
              if (!Number.isFinite(rate) || rate <= 0) {
                return null;
              }
              const remainingMs = Math.max(0, (lastTotal - lastCompleted) / rate);
              const seconds = Math.floor(remainingMs / 1e3);
              const minutes = Math.floor(seconds / 60);
              const remainingSeconds = seconds % 60;
              return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
            }, 'formatEta');
            const buildLabel = /* @__PURE__ */ __name(() => {
              const elapsed = formatElapsed();
              const eta = formatEta();
              return eta ? `${lastLabel} \xB7 elapsed ${elapsed} \xB7 eta ${eta}` : `${lastLabel} \xB7 elapsed ${elapsed}`;
            }, 'buildLabel');
            if (!syncFn) {
              defaultRuntime.log('Memory backend does not support manual reindex.');
              return;
            }
            await withProgressTotals(
              {
                label: 'Indexing memory\u2026',
                total: 0,
                fallback: opts.verbose ? 'line' : void 0
              },
              async (update, progress) => {
                const interval = setInterval(() => {
                  progress.setLabel(buildLabel());
                }, 1e3);
                try {
                  await syncFn({
                    reason: 'cli',
                    force: Boolean(opts.force),
                    progress: /* @__PURE__ */ __name((syncUpdate) => {
                      if (syncUpdate.label) {
                        lastLabel = syncUpdate.label;
                      }
                      lastCompleted = syncUpdate.completed;
                      lastTotal = syncUpdate.total;
                      update({
                        completed: syncUpdate.completed,
                        total: syncUpdate.total,
                        label: buildLabel()
                      });
                      progress.setLabel(buildLabel());
                    }, 'progress')
                  });
                } finally {
                  clearInterval(interval);
                }
              }
            );
            defaultRuntime.log(`Memory index updated (${agentId}).`);
          } catch (err) {
            const message = formatErrorMessage(err);
            defaultRuntime.error(`Memory index failed (${agentId}): ${message}`);
            process.exitCode = 1;
          }
        }, 'run')
      });
    }
  });
  memory.command('search').description('Search memory files').argument('<query>', 'Search query').option('--agent <id>', 'Agent id (default: default agent)').option('--max-results <n>', 'Max results', (value) => Number(value)).option('--min-score <n>', 'Minimum score', (value) => Number(value)).option('--json', 'Print JSON').action(
    async (query, opts) => {
      const cfg = loadConfig();
      const agentId = resolveAgent(cfg, opts.agent);
      await withManager({
        getManager: /* @__PURE__ */ __name(() => getMemorySearchManager({ cfg, agentId }), 'getManager'),
        onMissing: /* @__PURE__ */ __name((error) => defaultRuntime.log(error ?? 'Memory search disabled.'), 'onMissing'),
        onCloseError: /* @__PURE__ */ __name((err) => defaultRuntime.error(`Memory manager close failed: ${formatErrorMessage(err)}`), 'onCloseError'),
        close: /* @__PURE__ */ __name(async (manager) => {
          await manager.close?.();
        }, 'close'),
        run: /* @__PURE__ */ __name(async (manager) => {
          let results;
          try {
            results = await manager.search(query, {
              maxResults: opts.maxResults,
              minScore: opts.minScore
            });
          } catch (err) {
            const message = formatErrorMessage(err);
            defaultRuntime.error(`Memory search failed: ${message}`);
            process.exitCode = 1;
            return;
          }
          if (opts.json) {
            defaultRuntime.log(JSON.stringify({ results }, null, 2));
            return;
          }
          if (results.length === 0) {
            defaultRuntime.log('No matches.');
            return;
          }
          const rich = isRich();
          const lines = [];
          for (const result of results) {
            lines.push(
              `${colorize(rich, theme.success, result.score.toFixed(3))} ${colorize(
                rich,
                theme.accent,
                `${shortenHomePath(result.path)}:${result.startLine}-${result.endLine}`
              )}`
            );
            lines.push(colorize(rich, theme.muted, result.snippet));
            lines.push('');
          }
          defaultRuntime.log(lines.join('\n').trim());
        }, 'run')
      });
    }
  );
}
__name(registerMemoryCli, 'registerMemoryCli');
export {
  registerMemoryCli,
  runMemoryStatus
};
