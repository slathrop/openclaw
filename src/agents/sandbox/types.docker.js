/**
 * @module sandbox/types.docker
 * Docker-specific sandbox configuration type definitions.
 */

/**
 * @typedef {object} SandboxDockerConfig
 * @property {string} image
 * @property {string} containerPrefix
 * @property {string} workdir
 * @property {boolean} readOnlyRoot
 * @property {string[]} tmpfs
 * @property {string} network
 * @property {string} [user]
 * @property {string[]} capDrop
 * @property {Record<string, string>} [env]
 * @property {string} [setupCommand]
 * @property {number} [pidsLimit]
 * @property {string|number} [memory]
 * @property {string|number} [memorySwap]
 * @property {number} [cpus]
 * @property {Record<string, string|number|{soft?: number, hard?: number}>} [ulimits]
 * @property {string} [seccompProfile]
 * @property {string} [apparmorProfile]
 * @property {string[]} [dns]
 * @property {string[]} [extraHosts]
 * @property {string[]} [binds]
 */
