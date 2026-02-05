/**
 * Sandbox container and image pruning.
 * @module agents/sandbox/prune
 */
import { stopBrowserBridgeServer } from '../../browser/bridge-server.js';
import { defaultRuntime } from '../../runtime.js';
import { BROWSER_BRIDGES } from './browser-bridges.js';
import { dockerContainerState, execDocker } from './docker.js';
import {
  readBrowserRegistry,
  readRegistry,
  removeBrowserRegistryEntry,
  removeRegistryEntry
} from './registry.js';
let lastPruneAtMs = 0;
async function pruneSandboxContainers(cfg) {
  const now = Date.now();
  const idleHours = cfg.prune.idleHours;
  const maxAgeDays = cfg.prune.maxAgeDays;
  if (idleHours === 0 && maxAgeDays === 0) {
    return;
  }
  const registry = await readRegistry();
  for (const entry of registry.entries) {
    const idleMs = now - entry.lastUsedAtMs;
    const ageMs = now - entry.createdAtMs;
    if (idleHours > 0 && idleMs > idleHours * 60 * 60 * 1e3 || maxAgeDays > 0 && ageMs > maxAgeDays * 24 * 60 * 60 * 1e3) {
      try {
        await execDocker(['rm', '-f', entry.containerName], {
          allowFailure: true
        });
      } catch {
        // intentionally ignored
      } finally {
        await removeRegistryEntry(entry.containerName);
      }
    }
  }
}
async function pruneSandboxBrowsers(cfg) {
  const now = Date.now();
  const idleHours = cfg.prune.idleHours;
  const maxAgeDays = cfg.prune.maxAgeDays;
  if (idleHours === 0 && maxAgeDays === 0) {
    return;
  }
  const registry = await readBrowserRegistry();
  for (const entry of registry.entries) {
    const idleMs = now - entry.lastUsedAtMs;
    const ageMs = now - entry.createdAtMs;
    if (idleHours > 0 && idleMs > idleHours * 60 * 60 * 1e3 || maxAgeDays > 0 && ageMs > maxAgeDays * 24 * 60 * 60 * 1e3) {
      try {
        await execDocker(['rm', '-f', entry.containerName], {
          allowFailure: true
        });
      } catch {
        // intentionally ignored
      } finally {
        await removeBrowserRegistryEntry(entry.containerName);
        const bridge = BROWSER_BRIDGES.get(entry.sessionKey);
        if (bridge?.containerName === entry.containerName) {
          await stopBrowserBridgeServer(bridge.bridge.server).catch(() => void 0);
          BROWSER_BRIDGES.delete(entry.sessionKey);
        }
      }
    }
  }
}
async function maybePruneSandboxes(cfg) {
  const now = Date.now();
  if (now - lastPruneAtMs < 5 * 60 * 1e3) {
    return;
  }
  lastPruneAtMs = now;
  try {
    await pruneSandboxContainers(cfg);
    await pruneSandboxBrowsers(cfg);
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    defaultRuntime.error?.(`Sandbox prune failed: ${message ?? 'unknown error'}`);
  }
}
async function ensureDockerContainerIsRunning(containerName) {
  const state = await dockerContainerState(containerName);
  if (state.exists && !state.running) {
    await execDocker(['start', containerName]);
  }
}
export {
  ensureDockerContainerIsRunning,
  maybePruneSandboxes
};
