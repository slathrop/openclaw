/**
 * Sandbox lifecycle management (create, start, stop, destroy).
 * @module agents/sandbox/manage
 */
import { stopBrowserBridgeServer } from '../../browser/bridge-server.js';
import { loadConfig } from '../../config/config.js';
import { BROWSER_BRIDGES } from './browser-bridges.js';
import { resolveSandboxConfigForAgent } from './config.js';
import { dockerContainerState, execDocker } from './docker.js';
import {
  readBrowserRegistry,
  readRegistry,
  removeBrowserRegistryEntry,
  removeRegistryEntry
} from './registry.js';
import { resolveSandboxAgentId } from './shared.js';
async function listSandboxContainers() {
  const config = loadConfig();
  const registry = await readRegistry();
  const results = [];
  for (const entry of registry.entries) {
    const state = await dockerContainerState(entry.containerName);
    let actualImage = entry.image;
    if (state.exists) {
      try {
        const result = await execDocker(
          ['inspect', '-f', '{{.Config.Image}}', entry.containerName],
          { allowFailure: true }
        );
        if (result.code === 0) {
          actualImage = result.stdout.trim();
        }
      } catch {
        // intentionally ignored
      }
    }
    const agentId = resolveSandboxAgentId(entry.sessionKey);
    const configuredImage = resolveSandboxConfigForAgent(config, agentId).docker.image;
    results.push({
      ...entry,
      image: actualImage,
      running: state.running,
      imageMatch: actualImage === configuredImage
    });
  }
  return results;
}
async function listSandboxBrowsers() {
  const config = loadConfig();
  const registry = await readBrowserRegistry();
  const results = [];
  for (const entry of registry.entries) {
    const state = await dockerContainerState(entry.containerName);
    let actualImage = entry.image;
    if (state.exists) {
      try {
        const result = await execDocker(
          ['inspect', '-f', '{{.Config.Image}}', entry.containerName],
          { allowFailure: true }
        );
        if (result.code === 0) {
          actualImage = result.stdout.trim();
        }
      } catch {
        // intentionally ignored
      }
    }
    const agentId = resolveSandboxAgentId(entry.sessionKey);
    const configuredImage = resolveSandboxConfigForAgent(config, agentId).browser.image;
    results.push({
      ...entry,
      image: actualImage,
      running: state.running,
      imageMatch: actualImage === configuredImage
    });
  }
  return results;
}
async function removeSandboxContainer(containerName) {
  try {
    await execDocker(['rm', '-f', containerName], { allowFailure: true });
  } catch {
    // intentionally ignored
  }
  await removeRegistryEntry(containerName);
}
async function removeSandboxBrowserContainer(containerName) {
  try {
    await execDocker(['rm', '-f', containerName], { allowFailure: true });
  } catch {
    // intentionally ignored
  }
  await removeBrowserRegistryEntry(containerName);
  for (const [sessionKey, bridge] of BROWSER_BRIDGES.entries()) {
    if (bridge.containerName === containerName) {
      await stopBrowserBridgeServer(bridge.bridge.server).catch(() => void 0);
      BROWSER_BRIDGES.delete(sessionKey);
    }
  }
}
export {
  listSandboxBrowsers,
  listSandboxContainers,
  removeSandboxBrowserContainer,
  removeSandboxContainer
};
