/**
 * Type definitions for onboarding command options
 * @module commands/onboard-types
 */

/**
 * @typedef {'local'|'remote'} OnboardMode
 */

/**
 * @typedef {'oauth'|'setup-token'|'claude-cli'|'token'|'chutes'|'openai-codex'|'openai-api-key'|'openrouter-api-key'|'ai-gateway-api-key'|'cloudflare-ai-gateway-api-key'|'moonshot-api-key'|'moonshot-api-key-cn'|'kimi-code-api-key'|'synthetic-api-key'|'venice-api-key'|'codex-cli'|'apiKey'|'gemini-api-key'|'google-antigravity'|'google-gemini-cli'|'zai-api-key'|'xiaomi-api-key'|'minimax-cloud'|'minimax'|'minimax-api'|'minimax-api-lightning'|'minimax-portal'|'opencode-zen'|'github-copilot'|'copilot-proxy'|'qwen-portal'|'skip'} AuthChoice
 */

/**
 * @typedef {'token'|'password'} GatewayAuthChoice
 */

/**
 * @typedef {'config'|'config+creds+sessions'|'full'} ResetScope
 */

/**
 * @typedef {'loopback'|'lan'|'auto'|'custom'|'tailnet'} GatewayBind
 */

/**
 * @typedef {'off'|'serve'|'funnel'} TailscaleMode
 */

/**
 * @typedef {'npm'|'pnpm'|'bun'} NodeManagerChoice
 */

/**
 * @typedef {string} ChannelChoice
 */

/**
 * @typedef {ChannelChoice} ProviderChoice - Legacy alias (pre-rename)
 */

/**
 * @typedef {object} OnboardOptions
 * @property {OnboardMode} [mode]
 * @property {'quickstart'|'advanced'|'manual'} [flow] - "manual" is an alias for "advanced"
 * @property {string} [workspace]
 * @property {boolean} [nonInteractive]
 * @property {boolean} [acceptRisk] - Required for non-interactive onboarding
 * @property {boolean} [reset]
 * @property {AuthChoice} [authChoice]
 * @property {string} [tokenProvider] - Used when authChoice=token in non-interactive mode
 * @property {string} [token]
 * @property {string} [tokenProfileId]
 * @property {string} [tokenExpiresIn]
 * @property {string} [anthropicApiKey]
 * @property {string} [openaiApiKey]
 * @property {string} [openrouterApiKey]
 * @property {string} [aiGatewayApiKey]
 * @property {string} [cloudflareAiGatewayAccountId]
 * @property {string} [cloudflareAiGatewayGatewayId]
 * @property {string} [cloudflareAiGatewayApiKey]
 * @property {string} [moonshotApiKey]
 * @property {string} [kimiCodeApiKey]
 * @property {string} [geminiApiKey]
 * @property {string} [zaiApiKey]
 * @property {string} [xiaomiApiKey]
 * @property {string} [minimaxApiKey]
 * @property {string} [syntheticApiKey]
 * @property {string} [veniceApiKey]
 * @property {string} [opencodeZenApiKey]
 * @property {number} [gatewayPort]
 * @property {GatewayBind} [gatewayBind]
 * @property {GatewayAuthChoice} [gatewayAuth]
 * @property {string} [gatewayToken]
 * @property {string} [gatewayPassword]
 * @property {TailscaleMode} [tailscale]
 * @property {boolean} [tailscaleResetOnExit]
 * @property {boolean} [installDaemon]
 * @property {string} [daemonRuntime]
 * @property {boolean} [skipChannels]
 * @property {boolean} [skipProviders] - Legacy alias for skipChannels
 * @property {boolean} [skipSkills]
 * @property {boolean} [skipHealth]
 * @property {boolean} [skipUi]
 * @property {NodeManagerChoice} [nodeManager]
 * @property {string} [remoteUrl]
 * @property {string} [remoteToken]
 * @property {boolean} [json]
 */

export {};
