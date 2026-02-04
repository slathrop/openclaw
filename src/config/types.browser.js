/**
 * Browser configuration type definitions.
 *
 * Covers CDP endpoints, profiles, headless mode, and snapshot settings.
 */

/**
 * @typedef {object} BrowserProfileConfig
 * CDP port for this profile. Allocated once at creation, persisted permanently.
 * @property {number} [cdpPort]
 * CDP URL for this profile (use for remote Chrome).
 * @property {string} [cdpUrl]
 * Profile driver (default: openclaw).
 * @property {"openclaw" | "extension"} [driver]
 * Profile color (hex). Auto-assigned at creation.
 * @property {string} color
 */

/**
 * @typedef {object} BrowserSnapshotDefaults
 * Default snapshot mode (applies when mode is not provided).
 * @property {"efficient"} [mode]
 */

/**
 * @typedef {object} BrowserConfig
 * @property {boolean} [enabled]
 * If false, disable browser act:evaluate (arbitrary JS). Default: true
 * @property {boolean} [evaluateEnabled]
 * Base URL of the CDP endpoint (for remote browsers). Default: loopback CDP on the derived port.
 * @property {string} [cdpUrl]
 * Remote CDP HTTP timeout (ms). Default: 1500.
 * @property {number} [remoteCdpTimeoutMs]
 * Remote CDP WebSocket handshake timeout (ms). Default: max(remoteCdpTimeoutMs 2, 2000).
 * @property {number} [remoteCdpHandshakeTimeoutMs]
 * Accent color for the openclaw browser profile (hex). Default: #FF4500
 * @property {string} [color]
 * Override the browser executable path (all platforms).
 * @property {string} [executablePath]
 * Start Chrome headless (best-effort). Default: false
 * @property {boolean} [headless]
 * Pass --no-sandbox to Chrome (Linux containers). Default: false
 * @property {boolean} [noSandbox]
 * If true: never launch; only attach to an existing browser. Default: false
 * @property {boolean} [attachOnly]
 * Default profile to use when profile param is omitted. Default: "chrome"
 * @property {string} [defaultProfile]
 * Named browser profiles with explicit CDP ports or URLs.
 * @property {{[key: string]: BrowserProfileConfig}} [profiles]
 * Default snapshot options (applied by the browser tool/CLI when unset).
 * @property {BrowserSnapshotDefaults} [snapshotDefaults]
 */
