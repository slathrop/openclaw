/**
 * Port management type definitions.
 *
 * JSDoc typedefs for port listener, usage status, and diagnostics
 * used across the ports-* modules.
 */

/**
 * @typedef {{
 *   pid?: number,
 *   command?: string,
 *   commandLine?: string,
 *   user?: string,
 *   address?: string
 * }} PortListener
 */

/**
 * @typedef {"free" | "busy" | "unknown"} PortUsageStatus
 */

/**
 * @typedef {{
 *   port: number,
 *   status: PortUsageStatus,
 *   listeners: PortListener[],
 *   hints: string[],
 *   detail?: string,
 *   errors?: string[]
 * }} PortUsage
 */

/**
 * @typedef {"gateway" | "ssh" | "unknown"} PortListenerKind
 */
