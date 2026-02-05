/**
 * @module session-write-lock
 * Session file write locking with PID-based stale lock detection.
 */
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
const HELD_LOCKS = /* @__PURE__ */ new Map();
const CLEANUP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGABRT'];
const cleanupHandlers = /* @__PURE__ */ new Map();
function isAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function releaseAllLocksSync() {
  for (const [sessionFile, held] of HELD_LOCKS) {
    try {
      if (typeof held.handle.close === 'function') {
        void held.handle.close().catch(() => {
        });
      }
    } catch {
    // intentionally ignored
    }
    try {
      fsSync.rmSync(held.lockPath, { force: true });
    } catch {
    // intentionally ignored
    }
    HELD_LOCKS.delete(sessionFile);
  }
}
let cleanupRegistered = false;
function handleTerminationSignal(signal) {
  releaseAllLocksSync();
  const shouldReraise = process.listenerCount(signal) === 1;
  if (shouldReraise) {
    const handler = cleanupHandlers.get(signal);
    if (handler) {
      process.off(signal, handler);
    }
    try {
      process.kill(process.pid, signal);
    } catch {
    // intentionally ignored
    }
  }
}
function registerCleanupHandlers() {
  if (cleanupRegistered) {
    return;
  }
  cleanupRegistered = true;
  process.on('exit', () => {
    releaseAllLocksSync();
  });
  for (const signal of CLEANUP_SIGNALS) {
    try {
      const handler = () => handleTerminationSignal(signal);
      cleanupHandlers.set(signal, handler);
      process.on(signal, handler);
    } catch {
    // intentionally ignored
    }
  }
}
async function readLockPayload(lockPath) {
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid !== 'number') {
      return null;
    }
    if (typeof parsed.createdAt !== 'string') {
      return null;
    }
    return { pid: parsed.pid, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}
async function acquireSessionWriteLock(params) {
  registerCleanupHandlers();
  const timeoutMs = params.timeoutMs ?? 1e4;
  const staleMs = params.staleMs ?? 30 * 60 * 1e3;
  const sessionFile = path.resolve(params.sessionFile);
  const sessionDir = path.dirname(sessionFile);
  await fs.mkdir(sessionDir, { recursive: true });
  let normalizedDir = sessionDir;
  try {
    normalizedDir = await fs.realpath(sessionDir);
  } catch {
  // intentionally ignored
  }
  const normalizedSessionFile = path.join(normalizedDir, path.basename(sessionFile));
  const lockPath = `${normalizedSessionFile}.lock`;
  const held = HELD_LOCKS.get(normalizedSessionFile);
  if (held) {
    held.count += 1;
    return {
      release: async () => {
        const current = HELD_LOCKS.get(normalizedSessionFile);
        if (!current) {
          return;
        }
        current.count -= 1;
        if (current.count > 0) {
          return;
        }
        HELD_LOCKS.delete(normalizedSessionFile);
        await current.handle.close();
        await fs.rm(current.lockPath, { force: true });
      }
    };
  }
  const startedAt = Date.now();
  let attempt = 0;
  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(
        JSON.stringify({ pid: process.pid, createdAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2),
        'utf8'
      );
      HELD_LOCKS.set(normalizedSessionFile, { count: 1, handle, lockPath });
      return {
        release: async () => {
          const current = HELD_LOCKS.get(normalizedSessionFile);
          if (!current) {
            return;
          }
          current.count -= 1;
          if (current.count > 0) {
            return;
          }
          HELD_LOCKS.delete(normalizedSessionFile);
          await current.handle.close();
          await fs.rm(current.lockPath, { force: true });
        }
      };
    } catch (err) {
      const code = err.code;
      if (code !== 'EEXIST') {
        throw err;
      }
      const payload2 = await readLockPayload(lockPath);
      const createdAt = payload2?.createdAt ? Date.parse(payload2.createdAt) : NaN;
      const stale = !Number.isFinite(createdAt) || Date.now() - createdAt > staleMs;
      const alive = payload2?.pid ? isAlive(payload2.pid) : false;
      if (stale || !alive) {
        await fs.rm(lockPath, { force: true });
        continue;
      }
      const delay = Math.min(1e3, 50 * attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  const payload = await readLockPayload(lockPath);
  const owner = payload?.pid ? `pid=${payload.pid}` : 'unknown';
  throw new Error(`session file locked (timeout ${timeoutMs}ms): ${owner} ${lockPath}`);
}
const __testing = {
  cleanupSignals: [...CLEANUP_SIGNALS],
  handleTerminationSignal,
  releaseAllLocksSync
};
export {
  __testing,
  acquireSessionWriteLock
};
