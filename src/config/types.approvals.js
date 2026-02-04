/**
 * Execution approval forwarding type definitions.
 *
 * SECURITY: Controls how exec approval prompts are forwarded to chat
 * channels, including target selection and filtering.
 */

/**
 * @typedef {"session" | "targets" | "both"} ExecApprovalForwardingMode
 */

/**
 * @typedef {object} ExecApprovalForwardTarget
 * Channel id (e.g. "discord", "slack", or plugin channel id).
 * @property {string} channel
 * Destination id (channel id, user id, etc. depending on channel).
 * @property {string} to
 * Optional account id for multi-account channels.
 * @property {string} [accountId]
 * Optional thread id to reply inside a thread.
 * @property {string | number} [threadId]
 */

/**
 * @typedef {object} ExecApprovalForwardingConfig
 * Enable forwarding exec approvals to chat channels. Default: false.
 * @property {boolean} [enabled]
 * Delivery mode (session=origin chat, targets=config targets, both=both). Default: session.
 * @property {ExecApprovalForwardingMode} [mode]
 * Only forward approvals for these agent IDs. Omit = all agents.
 * @property {string[]} [agentFilter]
 * Only forward approvals matching these session key patterns (substring or regex).
 * @property {string[]} [sessionFilter]
 * Explicit delivery targets (used when mode includes targets).
 * @property {ExecApprovalForwardTarget[]} [targets]
 */

/**
 * @typedef {object} ApprovalsConfig
 * @property {ExecApprovalForwardingConfig} [exec]
 */
