/**
 * Message handling configuration type definitions.
 *
 * Covers group chat, DM, queue, broadcast, audio, response prefix,
 * and command settings.
 */

/**
 * @typedef {object} GroupChatConfig
 * @property {string[]} [mentionPatterns]
 * @property {number} [historyLimit]
 */

/**
 * @typedef {object} DmConfig
 * @property {number} [historyLimit]
 */

/**
 * @typedef {object} QueueConfig
 * @property {QueueMode} [mode]
 * @property {QueueModeByProvider} [byChannel]
 * @property {number} [debounceMs]
 * Per-channel debounce overrides (ms).
 * @property {InboundDebounceByProvider} [debounceMsByChannel]
 * @property {number} [cap]
 * @property {QueueDropPolicy} [drop]
 */

/**
 * @typedef {{[key: string]: number}} InboundDebounceByProvider
 */

/**
 * @typedef {object} InboundDebounceConfig
 * @property {number} [debounceMs]
 * @property {InboundDebounceByProvider} [byChannel]
 */

/**
 * @typedef {"parallel" | "sequential"} BroadcastStrategy
 */

/**
 * @typedef {object} BroadcastConfig
 * Default processing strategy for broadcast peers.
 * @property {BroadcastStrategy} [strategy]
 * Map peer IDs to arrays of agent IDs that should ALL process messages.  Note: the index signature includes `undefined` so `strategy?: ...` remains type-safe.
 * @property {string[] | BroadcastStrategy | undefined} [peerId]
 */

/**
 * @typedef {object} AudioConfig
 * @deprecated Use tools.media.audio.models instead.
 * @property {object} [transcription]
 */

/**
 * @typedef {object} MessagesConfig
 * @deprecated Use `whatsapp.messagePrefix` (WhatsApp-only inbound prefix).
 * @property {string} [messagePrefix]
 * Prefix auto-added to all outbound replies.  - string: explicit prefix (may include template variables) - special value: `"auto"` derives `[{agents.list[].identity.name}]` for the routed agent (when set)  Supported template variables (case-insensitive): - `{model}` - short model name (e.g., `claude-opus-4-5`, `gpt-4o`) - `{modelFull}` - full model identifier (e.g., `anthropic/claude-opus-4-5`) - `{provider}` - provider name (e.g., `anthropic`, `openai`) - `{thinkingLevel}` or `{think}` - current thinking level (`high`, `low`, `off`) - `{identity.name}` or `{identityName}` - agent identity name  Example: `"[{model} | think:{thinkingLevel}]"` → `"[claude-opus-4-5 | think:high]"`  Unresolved variables remain as literal text (e.g., `{model}` if context unavailable).  Default: none
 * @property {string} [responsePrefix]
 * @property {GroupChatConfig} [groupChat]
 * @property {QueueConfig} [queue]
 * Debounce rapid inbound messages per sender (global + per-channel overrides).
 * @property {InboundDebounceConfig} [inbound]
 * Emoji reaction used to acknowledge inbound messages (empty disables).
 * @property {string} [ackReaction]
 * When to send ack reactions. Default: "group-mentions".
 * @property {"group-mentions" | "group-all" | "direct" | "all"} [ackReactionScope]
 * Remove ack reaction after reply is sent (default: false).
 * @property {boolean} [removeAckAfterReply]
 * Text-to-speech settings for outbound replies.
 * @property {TtsConfig} [tts]
 */

/**
 * @typedef {boolean | "auto"} NativeCommandsSetting
 */

/**
 * @typedef {object} CommandsConfig
 * Enable native command registration when supported (default: "auto").
 * @property {NativeCommandsSetting} [native]
 * Enable native skill command registration when supported (default: "auto").
 * @property {NativeCommandsSetting} [nativeSkills]
 * Enable text command parsing (default: true).
 * @property {boolean} [text]
 * Allow bash chat command (`!`; `/bash` alias) (default: false).
 * @property {boolean} [bash]
 * How long bash waits before backgrounding (default: 2000; 0 backgrounds immediately).
 * @property {number} [bashForegroundMs]
 * Allow /config command (default: false).
 * @property {boolean} [config]
 * Allow /debug command (default: false).
 * @property {boolean} [debug]
 * Allow restart commands/tools (default: false).
 * @property {boolean} [restart]
 * Enforce access-group allowlists/policies for commands (default: true).
 * @property {boolean} [useAccessGroups]
 * Explicit owner allowlist for owner-only tools/commands (channel-native IDs).
 * @property {Array<string|number>} [ownerAllowFrom]
 */

/**
 * @typedef {object} ProviderCommandsConfig
 * Override native command registration for this provider (bool or "auto").
 * @property {NativeCommandsSetting} [native]
 * Override native skill command registration for this provider (bool or "auto").
 * @property {NativeCommandsSetting} [nativeSkills]
 */
