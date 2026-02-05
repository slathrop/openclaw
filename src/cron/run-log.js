import fs from 'node:fs/promises';
import path from 'node:path';
function resolveCronRunLogPath(params) {
  const storePath = path.resolve(params.storePath);
  const dir = path.dirname(storePath);
  return path.join(dir, 'runs', `${params.jobId}.jsonl`);
}
const writesByPath = /* @__PURE__ */ new Map();
async function pruneIfNeeded(filePath, opts) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || stat.size <= opts.maxBytes) {
    return;
  }
  const raw = await fs.readFile(filePath, 'utf-8').catch(() => '');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const kept = lines.slice(Math.max(0, lines.length - opts.keepLines));
  const tmp = `${filePath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tmp, `${kept.join('\n')}
`, 'utf-8');
  await fs.rename(tmp, filePath);
}
async function appendCronRunLog(filePath, entry, opts) {
  const resolved = path.resolve(filePath);
  const prev = writesByPath.get(resolved) ?? Promise.resolve();
  const next = prev.catch(() => void 0).then(async () => {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.appendFile(resolved, `${JSON.stringify(entry)}
`, 'utf-8');
    await pruneIfNeeded(resolved, {
      maxBytes: opts?.maxBytes ?? 2e6,
      keepLines: opts?.keepLines ?? 2e3
    });
  });
  writesByPath.set(resolved, next);
  await next;
}
async function readCronRunLogEntries(filePath, opts) {
  const limit = Math.max(1, Math.min(5e3, Math.floor(opts?.limit ?? 200)));
  const jobId = opts?.jobId?.trim() || void 0;
  const raw = await fs.readFile(path.resolve(filePath), 'utf-8').catch(() => '');
  if (!raw.trim()) {
    return [];
  }
  const parsed = [];
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0 && parsed.length < limit; i--) {
    const line = lines[i]?.trim();
    if (!line) {
      continue;
    }
    try {
      const obj = JSON.parse(line);
      if (!obj || typeof obj !== 'object') {
        continue;
      }
      if (obj.action !== 'finished') {
        continue;
      }
      if (typeof obj.jobId !== 'string' || obj.jobId.trim().length === 0) {
        continue;
      }
      if (typeof obj.ts !== 'number' || !Number.isFinite(obj.ts)) {
        continue;
      }
      if (jobId && obj.jobId !== jobId) {
        continue;
      }
      parsed.push(obj);
    } catch {
      // Intentionally ignored
    }
  }
  return parsed.toReversed();
}
export {
  appendCronRunLog,
  readCronRunLogEntries,
  resolveCronRunLogPath
};
