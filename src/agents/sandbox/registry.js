/**
 * Sandbox registry for tracking active sandbox instances.
 * @module agents/sandbox/registry
 */
import fs from 'node:fs/promises';
import {
  SANDBOX_BROWSER_REGISTRY_PATH,
  SANDBOX_REGISTRY_PATH,
  SANDBOX_STATE_DIR
} from './constants.js';
async function readRegistry() {
  try {
    const raw = await fs.readFile(SANDBOX_REGISTRY_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed;
    }
  } catch {
    // intentionally ignored
  }
  return { entries: [] };
}
async function writeRegistry(registry) {
  await fs.mkdir(SANDBOX_STATE_DIR, { recursive: true });
  await fs.writeFile(SANDBOX_REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}
`, 'utf-8');
}
async function updateRegistry(entry) {
  const registry = await readRegistry();
  const existing = registry.entries.find((item) => item.containerName === entry.containerName);
  const next = registry.entries.filter((item) => item.containerName !== entry.containerName);
  next.push({
    ...entry,
    createdAtMs: existing?.createdAtMs ?? entry.createdAtMs,
    image: existing?.image ?? entry.image,
    configHash: entry.configHash ?? existing?.configHash
  });
  await writeRegistry({ entries: next });
}
async function removeRegistryEntry(containerName) {
  const registry = await readRegistry();
  const next = registry.entries.filter((item) => item.containerName !== containerName);
  if (next.length === registry.entries.length) {
    return;
  }
  await writeRegistry({ entries: next });
}
async function readBrowserRegistry() {
  try {
    const raw = await fs.readFile(SANDBOX_BROWSER_REGISTRY_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed;
    }
  } catch {
    // intentionally ignored
  }
  return { entries: [] };
}
async function writeBrowserRegistry(registry) {
  await fs.mkdir(SANDBOX_STATE_DIR, { recursive: true });
  await fs.writeFile(
    SANDBOX_BROWSER_REGISTRY_PATH,
    `${JSON.stringify(registry, null, 2)}
`,
    'utf-8'
  );
}
async function updateBrowserRegistry(entry) {
  const registry = await readBrowserRegistry();
  const existing = registry.entries.find((item) => item.containerName === entry.containerName);
  const next = registry.entries.filter((item) => item.containerName !== entry.containerName);
  next.push({
    ...entry,
    createdAtMs: existing?.createdAtMs ?? entry.createdAtMs,
    image: existing?.image ?? entry.image
  });
  await writeBrowserRegistry({ entries: next });
}
async function removeBrowserRegistryEntry(containerName) {
  const registry = await readBrowserRegistry();
  const next = registry.entries.filter((item) => item.containerName !== containerName);
  if (next.length === registry.entries.length) {
    return;
  }
  await writeBrowserRegistry({ entries: next });
}
export {
  readBrowserRegistry,
  readRegistry,
  removeBrowserRegistryEntry,
  removeRegistryEntry,
  updateBrowserRegistry,
  updateRegistry
};
