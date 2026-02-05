/**
 * Type definitions for models list command
 * @module commands/models/list.types
 */

/**
 * @typedef {object} ConfiguredEntry
 * @property {string} key
 * @property {{provider: string, model: string}} ref
 * @property {Set<string>} tags
 * @property {string[]} aliases
 */

/**
 * @typedef {object} ModelRow
 * @property {string} key
 * @property {string} name
 * @property {string} input
 * @property {number|null} contextWindow
 * @property {boolean|null} local
 * @property {boolean|null} available
 * @property {string[]} tags
 * @property {boolean} missing
 */

/**
 * @typedef {object} ProviderAuthOverview
 * @property {string} provider
 * @property {{kind: 'profiles'|'env'|'models.json'|'missing', detail: string}} effective
 * @property {{count: number, oauth: number, token: number, apiKey: number, labels: string[]}} profiles
 * @property {{value: string, source: string}} [env]
 * @property {{value: string, source: string}} [modelsJson]
 */

export {};
