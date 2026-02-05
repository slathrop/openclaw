/**
 * @module sandbox/types
 * Sandbox configuration and context type definitions.
 */

/**
 * @typedef {import("./types.docker.js").SandboxDockerConfig} SandboxDockerConfig
 */

/**
 * @typedef {object} SandboxToolPolicy
 * @property {string[]} [allow]
 * @property {string[]} [deny]
 */

/**
 * @typedef {object} SandboxToolPolicySource
 * @property {"agent" | "global" | "default"} source
 * @property {string} key - Config key path hint for humans.
 */

/**
 * @typedef {object} SandboxToolPolicyResolved
 * @property {string[]} allow
 * @property {string[]} deny
 * @property {object} sources
 * @property {SandboxToolPolicySource} sources.allow
 * @property {SandboxToolPolicySource} sources.deny
 */

/**
 * @typedef {"none" | "ro" | "rw"} SandboxWorkspaceAccess
 */

/**
 * @typedef {object} SandboxBrowserConfig
 * @property {boolean} enabled
 * @property {string} image
 * @property {string} containerPrefix
 * @property {number} cdpPort
 * @property {number} vncPort
 * @property {number} noVncPort
 * @property {boolean} headless
 * @property {boolean} enableNoVnc
 * @property {boolean} allowHostControl
 * @property {boolean} autoStart
 * @property {number} autoStartTimeoutMs
 */

/**
 * @typedef {object} SandboxPruneConfig
 * @property {number} idleHours
 * @property {number} maxAgeDays
 */

/**
 * @typedef {"session" | "agent" | "shared"} SandboxScope
 */

/**
 * @typedef {object} SandboxConfig
 * @property {"off" | "non-main" | "all"} mode
 * @property {SandboxScope} scope
 * @property {SandboxWorkspaceAccess} workspaceAccess
 * @property {string} workspaceRoot
 * @property {SandboxDockerConfig} docker
 * @property {SandboxBrowserConfig} browser
 * @property {SandboxToolPolicy} tools
 * @property {SandboxPruneConfig} prune
 */

/**
 * @typedef {object} SandboxBrowserContext
 * @property {string} bridgeUrl
 * @property {string} [noVncUrl]
 * @property {string} containerName
 */

/**
 * @typedef {object} SandboxContext
 * @property {boolean} enabled
 * @property {string} sessionKey
 * @property {string} workspaceDir
 * @property {string} agentWorkspaceDir
 * @property {SandboxWorkspaceAccess} workspaceAccess
 * @property {string} containerName
 * @property {string} containerWorkdir
 * @property {SandboxDockerConfig} docker
 * @property {SandboxToolPolicy} tools
 * @property {boolean} browserAllowHostControl
 * @property {SandboxBrowserContext} [browser]
 */

/**
 * @typedef {object} SandboxWorkspaceInfo
 * @property {string} workspaceDir
 * @property {string} containerWorkdir
 */
