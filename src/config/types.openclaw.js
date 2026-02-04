/**
 * Top-level OpenClaw configuration type definitions.
 *
 * Aggregates all config sections into the root OpenClawConfig type,
 * plus validation issue, legacy issue, and file snapshot types.
 */

/**
 * @typedef {object} OpenClawConfig
 * @property {object} [meta]
 * @property {AuthConfig} [auth]
 * @property {*} [env]
 * @property {*} [wizard]
 * @property {DiagnosticsConfig} [diagnostics]
 * @property {LoggingConfig} [logging]
 * @property {*} [update]
 * @property {BrowserConfig} [browser]
 * @property {object} [ui]
 * @property {SkillsConfig} [skills]
 * @property {PluginsConfig} [plugins]
 * @property {ModelsConfig} [models]
 * @property {NodeHostConfig} [nodeHost]
 * @property {AgentsConfig} [agents]
 * @property {ToolsConfig} [tools]
 * @property {AgentBinding[]} [bindings]
 * @property {BroadcastConfig} [broadcast]
 * @property {AudioConfig} [audio]
 * @property {MessagesConfig} [messages]
 * @property {CommandsConfig} [commands]
 * @property {ApprovalsConfig} [approvals]
 * @property {SessionConfig} [session]
 * @property {WebConfig} [web]
 * @property {ChannelsConfig} [channels]
 * @property {CronConfig} [cron]
 * @property {HooksConfig} [hooks]
 * @property {DiscoveryConfig} [discovery]
 * @property {CanvasHostConfig} [canvasHost]
 * @property {TalkConfig} [talk]
 * @property {GatewayConfig} [gateway]
 * @property {MemoryConfig} [memory]
 */

/**
 * @typedef {object} ConfigValidationIssue
 * @property {string} path
 * @property {string} message
 */

/**
 * @typedef {object} LegacyConfigIssue
 * @property {string} path
 * @property {string} message
 */

/**
 * @typedef {object} ConfigFileSnapshot
 * @property {string} path
 * @property {boolean} exists
 * @property {string | null} raw
 * @property {*} parsed
 * @property {boolean} valid
 * @property {OpenClawConfig} config
 * @property {string} [hash]
 * @property {ConfigValidationIssue[]} issues
 * @property {ConfigValidationIssue[]} warnings
 * @property {LegacyConfigIssue[]} legacyIssues
 */
