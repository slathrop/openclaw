/**
 * Remote skill management for paired nodes.
 *
 * Tracks remote node capabilities (platforms, bins, commands)
 * and probes them for available binaries needed by skills.
 * Supports macOS remote nodes for cross-platform skill execution.
 */

import {resolveAgentWorkspaceDir, resolveDefaultAgentId} from '../agents/agent-scope.js';
import {loadWorkspaceSkillEntries} from '../agents/skills.js';
import {bumpSkillsSnapshotVersion} from '../agents/skills/refresh.js';
import {createSubsystemLogger} from '../logging/subsystem.js';
import {listNodePairing, updatePairedNodeMetadata} from './node-pairing.js';

const log = createSubsystemLogger('gateway/skills-remote');
const remoteNodes = new Map();
let remoteRegistry = null;

/**
 * Returns a human-readable description of a remote node.
 * @param {string} nodeId
 * @returns {string}
 */
function describeNode(nodeId) {
  const record = remoteNodes.get(nodeId);
  const name = record?.displayName?.trim();
  const base = name && name !== nodeId ? `${name} (${nodeId})` : nodeId;
  const ip = record?.remoteIp?.trim();
  return ip ? `${base} @ ${ip}` : base;
}

/**
 * Extracts a message string from an unknown error value.
 * @param {unknown} err
 * @returns {string | undefined}
 */
function extractErrorMessage(err) {
  if (!err) {
    return undefined;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err);
  }
  if (typeof err === 'symbol') {
    return err.toString();
  }
  if (typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Logs a remote bin probe failure with appropriate severity.
 * @param {string} nodeId
 * @param {unknown} err
 */
function logRemoteBinProbeFailure(nodeId, err) {
  const message = extractErrorMessage(err);
  const label = describeNode(nodeId);
  // Node unavailable errors are expected when nodes have transient connections
  if (message?.includes('node not connected') || message?.includes('node disconnected')) {
    log.info(`remote bin probe skipped: node unavailable (${label})`);
    return;
  }
  if (message?.includes('invoke timed out') || message?.includes('timeout')) {
    log.warn(`remote bin probe timed out (${label}); check node connectivity for ${label}`);
    return;
  }
  log.warn(`remote bin probe error (${label}): ${message ?? 'unknown'}`);
}

/**
 * Checks if a node is a Mac platform.
 * @param {string} [platform]
 * @param {string} [deviceFamily]
 * @returns {boolean}
 */
function isMacPlatform(platform, deviceFamily) {
  const platformNorm = String(platform ?? '')
    .trim()
    .toLowerCase();
  const familyNorm = String(deviceFamily ?? '')
    .trim()
    .toLowerCase();
  if (platformNorm.includes('mac')) {
    return true;
  }
  if (platformNorm.includes('darwin')) {
    return true;
  }
  if (familyNorm === 'mac') {
    return true;
  }
  return false;
}

/**
 * @param {string[]} [commands]
 * @returns {boolean}
 */
function supportsSystemRun(commands) {
  return Array.isArray(commands) && commands.includes('system.run');
}

/**
 * @param {string[]} [commands]
 * @returns {boolean}
 */
function supportsSystemWhich(commands) {
  return Array.isArray(commands) && commands.includes('system.which');
}

/**
 * Inserts or updates a remote node record.
 * @param {{ nodeId: string, displayName?: string, platform?: string, deviceFamily?: string, commands?: string[], remoteIp?: string, bins?: string[] }} record
 */
function upsertNode(record) {
  const existing = remoteNodes.get(record.nodeId);
  const bins = new Set(record.bins ?? existing?.bins ?? []);
  remoteNodes.set(record.nodeId, {
    nodeId: record.nodeId,
    displayName: record.displayName ?? existing?.displayName,
    platform: record.platform ?? existing?.platform,
    deviceFamily: record.deviceFamily ?? existing?.deviceFamily,
    commands: record.commands ?? existing?.commands,
    remoteIp: record.remoteIp ?? existing?.remoteIp,
    bins
  });
}

/**
 * Sets the node registry used for remote invocations.
 * @param {object | null} registry
 */
export function setSkillsRemoteRegistry(registry) {
  remoteRegistry = registry;
}

/**
 * Primes the remote skills cache from paired node metadata.
 */
export async function primeRemoteSkillsCache() {
  try {
    const list = await listNodePairing();
    let sawMac = false;
    for (const node of list.paired) {
      upsertNode({
        nodeId: node.nodeId,
        displayName: node.displayName,
        platform: node.platform,
        deviceFamily: node.deviceFamily,
        commands: node.commands,
        remoteIp: node.remoteIp,
        bins: node.bins
      });
      if (isMacPlatform(node.platform, node.deviceFamily) && supportsSystemRun(node.commands)) {
        sawMac = true;
      }
    }
    if (sawMac) {
      bumpSkillsSnapshotVersion({reason: 'remote-node'});
    }
  } catch (err) {
    log.warn(`failed to prime remote skills cache: ${String(err)}`);
  }
}

/**
 * Records information about a remote node.
 * @param {{ nodeId: string, displayName?: string, platform?: string, deviceFamily?: string, commands?: string[], remoteIp?: string }} node
 */
export function recordRemoteNodeInfo(node) {
  upsertNode(node);
}

/**
 * Records available bins for a remote node.
 * @param {string} nodeId
 * @param {string[]} bins
 */
export function recordRemoteNodeBins(nodeId, bins) {
  upsertNode({nodeId, bins});
}

/**
 * Lists workspace directories from config.
 * @param {object} cfg
 * @returns {string[]}
 */
function listWorkspaceDirs(cfg) {
  const dirs = new Set();
  const list = cfg.agents?.list;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (entry && typeof entry === 'object' && typeof entry.id === 'string') {
        dirs.add(resolveAgentWorkspaceDir(cfg, entry.id));
      }
    }
  }
  dirs.add(resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg)));
  return [...dirs];
}

/**
 * Collects required bin names from skill entries for a target platform.
 * @param {object[]} entries
 * @param {string} targetPlatform
 * @returns {string[]}
 */
function collectRequiredBins(entries, targetPlatform) {
  const bins = new Set();
  for (const entry of entries) {
    const os = entry.metadata?.os ?? [];
    if (os.length > 0 && !os.includes(targetPlatform)) {
      continue;
    }
    const required = entry.metadata?.requires?.bins ?? [];
    const anyBins = entry.metadata?.requires?.anyBins ?? [];
    for (const bin of required) {
      if (bin.trim()) {
        bins.add(bin.trim());
      }
    }
    for (const bin of anyBins) {
      if (bin.trim()) {
        bins.add(bin.trim());
      }
    }
  }
  return [...bins];
}

/**
 * Builds a shell script to probe for available bins.
 * @param {string[]} bins
 * @returns {string}
 */
function buildBinProbeScript(bins) {
  const escaped = bins.map((bin) => `'${bin.replace(/'/g, '\'\\\'\'')}'`).join(' ');
  return `for b in ${escaped}; do if command -v "$b" >/dev/null 2>&1; then echo "$b"; fi; done`;
}

/**
 * Parses the response from a bin probe invocation.
 * @param {string | null | undefined} payloadJSON
 * @param {unknown} [payload]
 * @returns {string[]}
 */
function parseBinProbePayload(payloadJSON, payload) {
  if (!payloadJSON && !payload) {
    return [];
  }
  try {
    const parsed = payloadJSON ?
      JSON.parse(payloadJSON) :
      payload;
    if (Array.isArray(parsed.bins)) {
      return parsed.bins.map((bin) => String(bin).trim()).filter(Boolean);
    }
    if (typeof parsed.stdout === 'string') {
      return parsed.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}

/**
 * Compares two bin sets for equality.
 * @param {Set<string> | undefined} a
 * @param {Set<string>} b
 * @returns {boolean}
 */
function areBinSetsEqual(a, b) {
  if (!a) {
    return false;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const bin of b) {
    if (!a.has(bin)) {
      return false;
    }
  }
  return true;
}

/**
 * Refreshes the bin cache for a specific remote node.
 * @param {{ nodeId: string, platform?: string, deviceFamily?: string, commands?: string[], cfg: object, timeoutMs?: number }} params
 */
export async function refreshRemoteNodeBins(params) {
  if (!remoteRegistry) {
    return;
  }
  if (!isMacPlatform(params.platform, params.deviceFamily)) {
    return;
  }
  const canWhich = supportsSystemWhich(params.commands);
  const canRun = supportsSystemRun(params.commands);
  if (!canWhich && !canRun) {
    return;
  }

  const workspaceDirs = listWorkspaceDirs(params.cfg);
  const requiredBins = new Set();
  for (const workspaceDir of workspaceDirs) {
    const entries = loadWorkspaceSkillEntries(workspaceDir, {config: params.cfg});
    for (const bin of collectRequiredBins(entries, 'darwin')) {
      requiredBins.add(bin);
    }
  }
  if (requiredBins.size === 0) {
    return;
  }

  try {
    const binsList = [...requiredBins];
    const res = await remoteRegistry.invoke(
      canWhich ?
        {
          nodeId: params.nodeId,
          command: 'system.which',
          params: {bins: binsList},
          timeoutMs: params.timeoutMs ?? 15_000
        } :
        {
          nodeId: params.nodeId,
          command: 'system.run',
          params: {
            command: ['/bin/sh', '-lc', buildBinProbeScript(binsList)]
          },
          timeoutMs: params.timeoutMs ?? 15_000
        }
    );
    if (!res.ok) {
      logRemoteBinProbeFailure(params.nodeId, res.error?.message ?? 'unknown');
      return;
    }
    const bins = parseBinProbePayload(res.payloadJSON, res.payload);
    const existingBins = remoteNodes.get(params.nodeId)?.bins;
    const nextBins = new Set(bins);
    const hasChanged = !areBinSetsEqual(existingBins, nextBins);
    recordRemoteNodeBins(params.nodeId, bins);
    if (!hasChanged) {
      return;
    }
    await updatePairedNodeMetadata(params.nodeId, {bins});
    bumpSkillsSnapshotVersion({reason: 'remote-node'});
  } catch (err) {
    logRemoteBinProbeFailure(params.nodeId, err);
  }
}

/**
 * Returns remote skill eligibility context for macOS nodes.
 * @returns {{ platforms: string[], hasBin: (bin: string) => boolean, hasAnyBin: (required: string[]) => boolean, note: string } | undefined}
 */
export function getRemoteSkillEligibility() {
  const macNodes = [...remoteNodes.values()].filter(
    (node) => isMacPlatform(node.platform, node.deviceFamily) && supportsSystemRun(node.commands)
  );
  if (macNodes.length === 0) {
    return undefined;
  }
  const bins = new Set();
  for (const node of macNodes) {
    for (const bin of node.bins) {
      bins.add(bin);
    }
  }
  const labels = macNodes.map((node) => node.displayName ?? node.nodeId).filter(Boolean);
  const note =
    labels.length > 0 ?
      `Remote macOS node available (${labels.join(', ')}). Run macOS-only skills via nodes.run on that node.` :
      'Remote macOS node available. Run macOS-only skills via nodes.run on that node.';
  return {
    platforms: ['darwin'],
    hasBin: (bin) => bins.has(bin),
    hasAnyBin: (required) => required.some((bin) => bins.has(bin)),
    note
  };
}

/**
 * Refreshes bins for all currently connected remote nodes.
 * @param {object} cfg
 */
export async function refreshRemoteBinsForConnectedNodes(cfg) {
  if (!remoteRegistry) {
    return;
  }
  const connected = remoteRegistry.listConnected();
  for (const node of connected) {
    await refreshRemoteNodeBins({
      nodeId: node.nodeId,
      platform: node.platform,
      deviceFamily: node.deviceFamily,
      commands: node.commands,
      cfg
    });
  }
}
