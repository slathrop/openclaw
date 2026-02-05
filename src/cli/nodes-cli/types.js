/**
 * Type definitions for nodes CLI commands
 * @module nodes-cli/types
 */

/**
 * @typedef {object} NodesRpcOpts
 * @property {string} [url]
 * @property {string} [token]
 * @property {string} [timeout]
 * @property {boolean} [json]
 * @property {string} [node]
 * @property {string} [command]
 * @property {string} [params]
 * @property {string} [invokeTimeout]
 * @property {string} [idempotencyKey]
 * @property {boolean} [connected]
 * @property {string} [lastConnected]
 * @property {string} [target]
 * @property {string} [x]
 * @property {string} [y]
 * @property {string} [width]
 * @property {string} [height]
 * @property {string} [js]
 * @property {string} [jsonl]
 * @property {string} [text]
 * @property {string} [cwd]
 * @property {string[]} [env]
 * @property {string} [commandTimeout]
 * @property {boolean} [needsScreenRecording]
 * @property {string} [title]
 * @property {string} [body]
 * @property {string} [sound]
 * @property {string} [priority]
 * @property {string} [delivery]
 * @property {string} [name]
 * @property {string} [facing]
 * @property {string} [format]
 * @property {string} [maxWidth]
 * @property {string} [quality]
 * @property {string} [delayMs]
 * @property {string} [deviceId]
 * @property {string} [maxAge]
 * @property {string} [accuracy]
 * @property {string} [locationTimeout]
 * @property {string} [duration]
 * @property {string} [screen]
 * @property {string} [fps]
 * @property {boolean} [audio]
 */

/**
 * @typedef {object} NodeListNode
 * @property {string} nodeId
 * @property {string} [displayName]
 * @property {string} [platform]
 * @property {string} [version]
 * @property {string} [coreVersion]
 * @property {string} [uiVersion]
 * @property {string} [remoteIp]
 * @property {string} [deviceFamily]
 * @property {string} [modelIdentifier]
 * @property {string} [pathEnv]
 * @property {string[]} [caps]
 * @property {string[]} [commands]
 * @property {{[key: string]: boolean}} [permissions]
 * @property {boolean} [paired]
 * @property {boolean} [connected]
 * @property {number} [connectedAtMs]
 */

/**
 * @typedef {object} PendingRequest
 * @property {string} requestId
 * @property {string} nodeId
 * @property {string} [displayName]
 * @property {string} [platform]
 * @property {string} [version]
 * @property {string} [coreVersion]
 * @property {string} [uiVersion]
 * @property {string} [remoteIp]
 * @property {boolean} [isRepair]
 * @property {number} ts
 */

/**
 * @typedef {object} PairedNode
 * @property {string} nodeId
 * @property {string} [token]
 * @property {string} [displayName]
 * @property {string} [platform]
 * @property {string} [version]
 * @property {string} [coreVersion]
 * @property {string} [uiVersion]
 * @property {string} [remoteIp]
 * @property {{[key: string]: boolean}} [permissions]
 * @property {number} [createdAtMs]
 * @property {number} [approvedAtMs]
 * @property {number} [lastConnectedAtMs]
 */

/**
 * @typedef {object} PairingList
 * @property {PendingRequest[]} pending
 * @property {PairedNode[]} paired
 */

export {};
