/**
 * Web auto-reply type definitions.
 * @typedef {object} WebChannelStatus
 * @property {boolean} running
 * @property {boolean} connected
 * @property {number} reconnectAttempts
 * @property {number | null} [lastConnectedAt]
 * @property {{at: number, status?: number, error?: string, loggedOut?: boolean} | null} [lastDisconnect]
 * @property {number | null} [lastMessageAt]
 * @property {number | null} [lastEventAt]
 * @property {string | null} [lastError]
 * @typedef {object} WebMonitorTuning
 * @property {Partial<import('../reconnect.js').ReconnectPolicy>} [reconnect]
 * @property {number} [heartbeatSeconds]
 * @property {(ms: number, signal?: AbortSignal) => Promise<void>} [sleep]
 * @property {(status: WebChannelStatus) => void} [statusSink]
 * @property {string} [accountId] - WhatsApp account id. Default: "default".
 * @property {number} [debounceMs] - Debounce window (ms) for batching rapid consecutive messages.
 */

// WebInboundMsg is a conditional/inferred type from monitorWebInbox's onMessage param.
// In JS it is not expressible as JSDoc; consumers should use the runtime value directly.

// This module is type-only; no runtime exports.
