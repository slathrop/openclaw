/**
 * Agent configuration and binding type definitions.
 *
 * Covers per-agent config, agent lists, and channel-to-agent bindings.
 */

/**
 * @typedef {string | object} AgentModelConfig
 */

/**
 * @typedef {object} AgentConfig
 * @property {string} id
 * @property {boolean} [default]
 * @property {string} [name]
 * @property {string} [workspace]
 * @property {string} [agentDir]
 * @property {AgentModelConfig} [model]
 * Optional allowlist of skills for this agent (omit = all skills; empty = none).
 * @property {string[]} [skills]
 * @property {MemorySearchConfig} [memorySearch]
 * Human-like delay between block replies for this agent.
 * @property {HumanDelayConfig} [humanDelay]
 * Optional per-agent heartbeat overrides.
 * @property {AgentDefaultsConfig["heartbeat"]} [heartbeat]
 * @property {IdentityConfig} [identity]
 * @property {GroupChatConfig} [groupChat]
 * @property {*} [subagents]
 * @property {*} [sandbox]
 * @property {AgentToolsConfig} [tools]
 */

/**
 * @typedef {object} AgentsConfig
 * @property {AgentDefaultsConfig} [defaults]
 * @property {AgentConfig[]} [list]
 */

/**
 * @typedef {object} AgentBinding
 * @property {string} agentId
 * @property {*} match
 */
