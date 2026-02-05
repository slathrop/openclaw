import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import lockfile from 'proper-lockfile';
const STORE_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 1e4,
    randomize: true
  },
  stale: 3e4
};
function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = safeParseJson(raw);
    if (parsed === null) {
      return { value: fallback, exists: true };
    }
    return { value: parsed, exists: true };
  } catch (err) {
    const code = err.code;
    if (code === 'ENOENT') {
      return { value: fallback, exists: false };
    }
    return { value: fallback, exists: false };
  }
}
async function writeJsonFile(filePath, value) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true, mode: 448 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  await fs.promises.writeFile(tmp, `${JSON.stringify(value, null, 2)}
`, {
    encoding: 'utf-8'
  });
  await fs.promises.chmod(tmp, 384);
  await fs.promises.rename(tmp, filePath);
}
async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.promises.access(filePath);
  } catch {
    await writeJsonFile(filePath, fallback);
  }
}
async function withFileLock(filePath, fallback, fn) {
  await ensureJsonFile(filePath, fallback);
  let release;
  try {
    release = await lockfile.lock(filePath, STORE_LOCK_OPTIONS);
    return await fn();
  } finally {
    if (release) {
      try {
        await release();
      } catch { /* intentionally empty */ }
    }
  }
}
export {
  readJsonFile,
  withFileLock,
  writeJsonFile
};
