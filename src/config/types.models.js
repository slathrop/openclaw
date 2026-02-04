/**
 * Model provider configuration type definitions.
 *
 * Covers provider URLs, API types, model definitions, cost,
 * context windows, and Bedrock discovery.
 */

/**
 * @typedef {"openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai" | "github-copilot" | "bedrock-converse-stream"} ModelApi
 */

/**
 * @typedef {object} ModelCompatConfig
 * @property {boolean} [supportsStore]
 * @property {boolean} [supportsDeveloperRole]
 * @property {boolean} [supportsReasoningEffort]
 * @property {"max_completion_tokens" | "max_tokens"} [maxTokensField]
 */

/**
 * @typedef {"api-key" | "aws-sdk" | "oauth" | "token"} ModelProviderAuthMode
 */

/**
 * @typedef {object} ModelDefinitionConfig
 * @property {string} id
 * @property {string} name
 * @property {ModelApi} [api]
 * @property {boolean} reasoning
 * @property {Array<"text" | "image">} input
 * @property {object} cost
 * @property {number} contextWindow
 * @property {number} maxTokens
 * @property {{[key: string]: string}} [headers]
 * @property {ModelCompatConfig} [compat]
 */

/**
 * @typedef {object} ModelProviderConfig
 * @property {string} baseUrl
 * @property {string} [apiKey]
 * @property {ModelProviderAuthMode} [auth]
 * @property {ModelApi} [api]
 * @property {{[key: string]: string}} [headers]
 * @property {boolean} [authHeader]
 * @property {ModelDefinitionConfig[]} models
 */

/**
 * @typedef {object} BedrockDiscoveryConfig
 * @property {boolean} [enabled]
 * @property {string} [region]
 * @property {string[]} [providerFilter]
 * @property {number} [refreshInterval]
 * @property {number} [defaultContextWindow]
 * @property {number} [defaultMaxTokens]
 */

/**
 * @typedef {object} ModelsConfig
 * @property {"merge" | "replace"} [mode]
 * @property {{[key: string]: ModelProviderConfig}} [providers]
 * @property {BedrockDiscoveryConfig} [bedrockDiscovery]
 */
