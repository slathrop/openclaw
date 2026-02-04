/**
 * Text-to-speech configuration type definitions.
 *
 * Covers ElevenLabs, OpenAI, and Edge TTS providers and settings.
 */

/**
 * @typedef {"elevenlabs" | "openai" | "edge"} TtsProvider
 */

/**
 * @typedef {"final" | "all"} TtsMode
 */

/**
 * @typedef {"off" | "always" | "inbound" | "tagged"} TtsAutoMode
 */

/**
 * @typedef {object} TtsModelOverrideConfig
 * Enable model-provided overrides for TTS.
 * @property {boolean} [enabled]
 * Allow model-provided TTS text blocks.
 * @property {boolean} [allowText]
 * Allow model-provided provider override.
 * @property {boolean} [allowProvider]
 * Allow model-provided voice/voiceId override.
 * @property {boolean} [allowVoice]
 * Allow model-provided modelId override.
 * @property {boolean} [allowModelId]
 * Allow model-provided voice settings override.
 * @property {boolean} [allowVoiceSettings]
 * Allow model-provided normalization or language overrides.
 * @property {boolean} [allowNormalization]
 * Allow model-provided seed override.
 * @property {boolean} [allowSeed]
 */

/**
 * @typedef {object} TtsConfig
 * Auto-TTS mode (preferred).
 * @property {TtsAutoMode} [auto]
 * Legacy: enable auto-TTS when `auto` is not set.
 * @property {boolean} [enabled]
 * Apply TTS to final replies only or to all replies (tool/block/final).
 * @property {TtsMode} [mode]
 * Primary TTS provider (fallbacks are automatic).
 * @property {TtsProvider} [provider]
 * Optional model override for TTS auto-summary (provider/model or alias).
 * @property {string} [summaryModel]
 * Allow the model to override TTS parameters.
 * @property {TtsModelOverrideConfig} [modelOverrides]
 * ElevenLabs configuration.
 * @property {*} [elevenlabs]
 * OpenAI configuration.
 * @property {object} [openai]
 * Microsoft Edge (node-edge-tts) configuration.
 * @property {object} [edge]
 * Optional path for local TTS user preferences JSON.
 * @property {string} [prefsPath]
 * Hard cap for text sent to TTS (chars).
 * @property {number} [maxTextLength]
 * API request timeout (ms).
 * @property {number} [timeoutMs]
 */
