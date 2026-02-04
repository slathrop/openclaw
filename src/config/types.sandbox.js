/**
 * Sandbox configuration type definitions.
 *
 * SECURITY: Controls Docker container isolation, resource limits,
 * capability dropping, seccomp/AppArmor profiles, and browser sandbox.
 */

/**
 * @typedef {object} SandboxDockerSettings
 * Docker image to use for sandbox containers.
 * @property {string} [image]
 * Prefix for sandbox container names.
 * @property {string} [containerPrefix]
 * Container workdir mount path (default: /workspace).
 * @property {string} [workdir]
 * Run container rootfs read-only.
 * @property {boolean} [readOnlyRoot]
 * Extra tmpfs mounts for read-only containers.
 * @property {string[]} [tmpfs]
 * Container network mode (bridge|none|custom).
 * @property {string} [network]
 * Container user (uid:gid).
 * @property {string} [user]
 * Drop Linux capabilities.
 * @property {string[]} [capDrop]
 * Extra environment variables for sandbox exec.
 * @property {{[key: string]: string}} [env]
 * Optional setup command run once after container creation.
 * @property {string} [setupCommand]
 * Limit container PIDs (0 = Docker default).
 * @property {number} [pidsLimit]
 * Limit container memory (e.g. 512m, 2g, or bytes as number).
 * @property {string | number} [memory]
 * Limit container memory swap (same format as memory).
 * @property {string | number} [memorySwap]
 * Limit container CPU shares (e.g. 0.5, 1, 2).
 * @property {number} [cpus]
 * Set ulimit values by name (e.g. nofile, nproc). Use "soft:hard" string, a number, or { soft, hard }.
 * @property {{[key: string]: string | number | object}} [ulimits]
 * Seccomp profile (path or profile name).
 * @property {string} [seccompProfile]
 * AppArmor profile name.
 * @property {string} [apparmorProfile]
 * DNS servers (e.g. ["1.1.1.1", "8.8.8.8"]).
 * @property {string[]} [dns]
 * Extra host mappings (e.g. ["api.local:10.0.0.2"]).
 * @property {string[]} [extraHosts]
 * Additional bind mounts (host:container:mode format, e.g. ["/host/path:/container/path:rw"]).
 * @property {string[]} [binds]
 */

/**
 * @typedef {object} SandboxBrowserSettings
 * @property {boolean} [enabled]
 * @property {string} [image]
 * @property {string} [containerPrefix]
 * @property {number} [cdpPort]
 * @property {number} [vncPort]
 * @property {number} [noVncPort]
 * @property {boolean} [headless]
 * @property {boolean} [enableNoVnc]
 * Allow sandboxed sessions to target the host browser control server. Default: false.
 * @property {boolean} [allowHostControl]
 * When true (default), sandboxed browser control will try to start/reattach to the sandbox browser container when a tool call needs it.
 * @property {boolean} [autoStart]
 * Max time to wait for CDP to become reachable after auto-start (ms).
 * @property {number} [autoStartTimeoutMs]
 */

/**
 * @typedef {object} SandboxPruneSettings
 * Prune if idle for more than N hours (0 disables).
 * @property {number} [idleHours]
 * Prune if older than N days (0 disables).
 * @property {number} [maxAgeDays]
 */
