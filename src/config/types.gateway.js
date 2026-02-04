/**
 * Gateway server configuration type definitions.
 *
 * SECURITY: Controls bind mode, TLS, auth (token/password), Tailscale
 * exposure, trusted proxies, HTTP endpoints, and node routing.
 */

/**
 * @typedef {"auto" | "lan" | "loopback" | "custom" | "tailnet"} GatewayBindMode
 */

/**
 * @typedef {object} GatewayTlsConfig
 * Enable TLS for the gateway server.
 * @property {boolean} [enabled]
 * Auto-generate a self-signed cert if cert/key are missing (default: true).
 * @property {boolean} [autoGenerate]
 * PEM certificate path for the gateway server.
 * @property {string} [certPath]
 * PEM private key path for the gateway server.
 * @property {string} [keyPath]
 * Optional PEM CA bundle for TLS clients (mTLS or custom roots).
 * @property {string} [caPath]
 */

/**
 * @typedef {object} WideAreaDiscoveryConfig
 * @property {boolean} [enabled]
 * Optional unicast DNS-SD domain (e.g. "openclaw.internal").
 * @property {string} [domain]
 */

/**
 * @typedef {"off" | "minimal" | "full"} MdnsDiscoveryMode
 */

/**
 * @typedef {object} MdnsDiscoveryConfig
 * mDNS/Bonjour discovery broadcast mode (default: minimal). - off: disable mDNS entirely - minimal: omit cliPath/sshPort from TXT records - full: include cliPath/sshPort in TXT records
 * @property {MdnsDiscoveryMode} [mode]
 */

/**
 * @typedef {object} DiscoveryConfig
 * @property {WideAreaDiscoveryConfig} [wideArea]
 * @property {MdnsDiscoveryConfig} [mdns]
 */

/**
 * @typedef {object} CanvasHostConfig
 * @property {boolean} [enabled]
 * Directory to serve (default: ~/.openclaw/workspace/canvas).
 * @property {string} [root]
 * HTTP port to listen on (default: 18793).
 * @property {number} [port]
 * Enable live-reload file watching + WS reloads (default: true).
 * @property {boolean} [liveReload]
 */

/**
 * @typedef {object} TalkConfig
 * Default ElevenLabs voice ID for Talk mode.
 * @property {string} [voiceId]
 * Optional voice name -> ElevenLabs voice ID map.
 * @property {{[key: string]: string}} [voiceAliases]
 * Default ElevenLabs model ID for Talk mode.
 * @property {string} [modelId]
 * Default ElevenLabs output format (e.g. mp3_44100_128).
 * @property {string} [outputFormat]
 * ElevenLabs API key (optional; falls back to ELEVENLABS_API_KEY).
 * @property {string} [apiKey]
 * Stop speaking when user starts talking (default: true).
 * @property {boolean} [interruptOnSpeech]
 */

/**
 * @typedef {object} GatewayControlUiConfig
 * If false, the Gateway will not serve the Control UI (default /).
 * @property {boolean} [enabled]
 * Optional base path prefix for the Control UI (e.g. "/openclaw").
 * @property {string} [basePath]
 * Optional filesystem root for Control UI assets (defaults to dist/control-ui).
 * @property {string} [root]
 * Allowed browser origins for Control UI/WebChat websocket connections.
 * @property {string[]} [allowedOrigins]
 * Allow token-only auth over insecure HTTP (default: false).
 * @property {boolean} [allowInsecureAuth]
 * DANGEROUS: Disable device identity checks for the Control UI (default: false).
 * @property {boolean} [dangerouslyDisableDeviceAuth]
 */

/**
 * @typedef {"token" | "password"} GatewayAuthMode
 */

/**
 * @typedef {object} GatewayAuthConfig
 * Authentication mode for Gateway connections. Defaults to token when set.
 * @property {GatewayAuthMode} [mode]
 * Shared token for token mode (stored locally for CLI auth).
 * @property {string} [token]
 * Shared password for password mode (consider env instead).
 * @property {string} [password]
 * Allow Tailscale identity headers when serve mode is enabled.
 * @property {boolean} [allowTailscale]
 */

/**
 * @typedef {"off" | "serve" | "funnel"} GatewayTailscaleMode
 */

/**
 * @typedef {object} GatewayTailscaleConfig
 * Tailscale exposure mode for the Gateway control UI.
 * @property {GatewayTailscaleMode} [mode]
 * Reset serve/funnel configuration on shutdown.
 * @property {boolean} [resetOnExit]
 */

/**
 * @typedef {object} GatewayRemoteConfig
 * Remote Gateway WebSocket URL (ws:// or wss://).
 * @property {string} [url]
 * Transport for macOS remote connections (ssh tunnel or direct WS).
 * @property {"ssh" | "direct"} [transport]
 * Token for remote auth (when the gateway requires token auth).
 * @property {string} [token]
 * Password for remote auth (when the gateway requires password auth).
 * @property {string} [password]
 * Expected TLS certificate fingerprint (sha256) for remote gateways.
 * @property {string} [tlsFingerprint]
 * SSH target for tunneling remote Gateway (user@host).
 * @property {string} [sshTarget]
 * SSH identity file path for tunneling remote Gateway.
 * @property {string} [sshIdentity]
 */

/**
 * @typedef {"off" | "restart" | "hot" | "hybrid"} GatewayReloadMode
 */

/**
 * @typedef {object} GatewayReloadConfig
 * Reload strategy for config changes (default: hybrid).
 * @property {GatewayReloadMode} [mode]
 * Debounce window for config reloads (ms). Default: 300.
 * @property {number} [debounceMs]
 */

/**
 * @typedef {object} GatewayHttpChatCompletionsConfig
 * If false, the Gateway will not serve `POST /v1/chat/completions`. Default: false when absent.
 * @property {boolean} [enabled]
 */

/**
 * @typedef {object} GatewayHttpResponsesConfig
 * If false, the Gateway will not serve `POST /v1/responses` (OpenResponses API). Default: false when absent.
 * @property {boolean} [enabled]
 * Max request body size in bytes for `/v1/responses`. Default: 20MB.
 * @property {number} [maxBodyBytes]
 * File inputs (input_file).
 * @property {GatewayHttpResponsesFilesConfig} [files]
 * Image inputs (input_image).
 * @property {GatewayHttpResponsesImagesConfig} [images]
 */

/**
 * @typedef {object} GatewayHttpResponsesFilesConfig
 * Allow URL fetches for input_file. Default: true.
 * @property {boolean} [allowUrl]
 * Allowed MIME types (case-insensitive).
 * @property {string[]} [allowedMimes]
 * Max bytes per file. Default: 5MB.
 * @property {number} [maxBytes]
 * Max decoded characters per file. Default: 200k.
 * @property {number} [maxChars]
 * Max redirects when fetching a URL. Default: 3.
 * @property {number} [maxRedirects]
 * Fetch timeout in ms. Default: 10s.
 * @property {number} [timeoutMs]
 * PDF handling (application/pdf).
 * @property {GatewayHttpResponsesPdfConfig} [pdf]
 */

/**
 * @typedef {object} GatewayHttpResponsesPdfConfig
 * Max pages to parse/render. Default: 4.
 * @property {number} [maxPages]
 * Max pixels per rendered page. Default: 4M.
 * @property {number} [maxPixels]
 * Minimum extracted text length to skip rasterization. Default: 200 chars.
 * @property {number} [minTextChars]
 */

/**
 * @typedef {object} GatewayHttpResponsesImagesConfig
 * Allow URL fetches for input_image. Default: true.
 * @property {boolean} [allowUrl]
 * Allowed MIME types (case-insensitive).
 * @property {string[]} [allowedMimes]
 * Max bytes per image. Default: 10MB.
 * @property {number} [maxBytes]
 * Max redirects when fetching a URL. Default: 3.
 * @property {number} [maxRedirects]
 * Fetch timeout in ms. Default: 10s.
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {object} GatewayHttpEndpointsConfig
 * @property {GatewayHttpChatCompletionsConfig} [chatCompletions]
 * @property {GatewayHttpResponsesConfig} [responses]
 */

/**
 * @typedef {object} GatewayHttpConfig
 * @property {GatewayHttpEndpointsConfig} [endpoints]
 */

/**
 * @typedef {object} GatewayNodesConfig
 * Browser routing policy for node-hosted browser proxies.
 * @property {*} [browser]
 * Additional node.invoke commands to allow on the gateway.
 * @property {string[]} [allowCommands]
 * Commands to deny even if they appear in the defaults or node claims.
 * @property {string[]} [denyCommands]
 */

/**
 * @typedef {object} GatewayConfig
 * Single multiplexed port for Gateway WS + HTTP (default: 18789).
 * @property {number} [port]
 * Explicit gateway mode. When set to "remote", local gateway start is disabled. When set to "local", the CLI may start the gateway locally.
 * @property {"local" | "remote"} [mode]
 * Bind address policy for the Gateway WebSocket + Control UI HTTP server. - auto: Loopback (127.0.0.1) if available, else 0.0.0.0 (fallback to all interfaces) - lan: 0.0.0.0 (all interfaces, no fallback) - loopback: 127.0.0.1 (local-only) - tailnet: Tailnet IPv4 if available (100.64.0.0/10), else loopback - custom: User-specified IP, fallback to 0.0.0.0 if unavailable (requires customBindHost) Default: loopback (127.0.0.1).
 * @property {GatewayBindMode} [bind]
 * Custom IP address for bind="custom" mode. Fallback: 0.0.0.0.
 * @property {string} [customBindHost]
 * @property {GatewayControlUiConfig} [controlUi]
 * @property {GatewayAuthConfig} [auth]
 * @property {GatewayTailscaleConfig} [tailscale]
 * @property {GatewayRemoteConfig} [remote]
 * @property {GatewayReloadConfig} [reload]
 * @property {GatewayTlsConfig} [tls]
 * @property {GatewayHttpConfig} [http]
 * @property {GatewayNodesConfig} [nodes]
 * IPs of trusted reverse proxies (e.g. Traefik, nginx). When a connection arrives from one of these IPs, the Gateway trusts `x-forwarded-for` (or `x-real-ip`) to determine the client IP for local pairing and HTTP checks.
 * @property {string[]} [trustedProxies]
 */
