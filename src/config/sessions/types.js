/**
 * @module sessions/types
 * Session entry types, merge logic, and default constants.
 */
import crypto from 'node:crypto';

/**
 * @typedef {'per-sender' | 'global'} SessionScope
 */

/**
 * @typedef {string} SessionChannelId
 */

/**
 * @typedef {string} SessionChatType
 */

/**
 * @typedef {{ label?: string, provider?: string, surface?: string, chatType?: SessionChatType, from?: string, to?: string, accountId?: string, threadId?: string | number }} SessionOrigin
 */

/**
 * @typedef {object} SessionEntry
 * @property {string} sessionId
 * @property {number} updatedAt
 * @property {string} [sessionFile]
 * @property {string} [lastHeartbeatText]
 * @property {number} [lastHeartbeatSentAt]
 * @property {string} [spawnedBy]
 * @property {boolean} [systemSent]
 * @property {boolean} [abortedLastRun]
 * @property {SessionChatType} [chatType]
 * @property {string} [thinkingLevel]
 * @property {string} [verboseLevel]
 * @property {string} [reasoningLevel]
 * @property {string} [elevatedLevel]
 * @property {string} [ttsAuto]
 * @property {string} [execHost]
 * @property {string} [execSecurity]
 * @property {string} [execAsk]
 * @property {string} [execNode]
 * @property {string} [responseUsage]
 * @property {string} [providerOverride]
 * @property {string} [modelOverride]
 * @property {string} [authProfileOverride]
 * @property {string} [authProfileOverrideSource]
 * @property {number} [authProfileOverrideCompactionCount]
 * @property {string} [groupActivation]
 * @property {boolean} [groupActivationNeedsSystemIntro]
 * @property {string} [sendPolicy]
 * @property {string} [queueMode]
 * @property {number} [queueDebounceMs]
 * @property {number} [queueCap]
 * @property {string} [queueDrop]
 * @property {number} [inputTokens]
 * @property {number} [outputTokens]
 * @property {number} [totalTokens]
 * @property {string} [modelProvider]
 * @property {string} [model]
 * @property {number} [contextTokens]
 * @property {number} [compactionCount]
 * @property {number} [memoryFlushAt]
 * @property {number} [memoryFlushCompactionCount]
 * @property {Record<string, string>} [cliSessionIds]
 * @property {string} [claudeCliSessionId]
 * @property {string} [label]
 * @property {string} [displayName]
 * @property {string} [channel]
 * @property {string} [groupId]
 * @property {string} [subject]
 * @property {string} [groupChannel]
 * @property {string} [space]
 * @property {SessionOrigin} [origin]
 * @property {object} [deliveryContext]
 * @property {SessionChannelId} [lastChannel]
 * @property {string} [lastTo]
 * @property {string} [lastAccountId]
 * @property {string | number} [lastThreadId]
 * @property {object} [skillsSnapshot]
 * @property {object} [systemPromptReport]
 */

/**
 * Merges a session entry with a partial patch, preserving existing fields.
 * @param {SessionEntry | undefined} existing
 * @param {Partial<SessionEntry>} patch
 * @returns {SessionEntry}
 */
export function mergeSessionEntry(existing, patch) {
  const sessionId = patch.sessionId ?? existing?.sessionId ?? crypto.randomUUID();
  const updatedAt = Math.max(existing?.updatedAt ?? 0, patch.updatedAt ?? 0, Date.now());
  if (!existing) {
    return {...patch, sessionId, updatedAt};
  }
  return {...existing, ...patch, sessionId, updatedAt};
}

/**
 * @typedef {{ key: string, channel?: string, id?: string, chatType?: SessionChatType }} GroupKeyResolution
 */

/**
 * @typedef {{ prompt: string, skills: Array<{ name: string, primaryEnv?: string }>, resolvedSkills?: Array<*>, version?: number }} SessionSkillSnapshot
 */

/**
 * @typedef {object} SessionSystemPromptReport
 * @property {string} source
 * @property {number} generatedAt
 * @property {string} [sessionId]
 * @property {string} [sessionKey]
 * @property {string} [provider]
 * @property {string} [model]
 * @property {string} [workspaceDir]
 * @property {number} [bootstrapMaxChars]
 * @property {object} [sandbox]
 * @property {object} systemPrompt
 * @property {Array<object>} injectedWorkspaceFiles
 * @property {object} skills
 * @property {object} tools
 */

export const DEFAULT_RESET_TRIGGER = '/new';
export const DEFAULT_RESET_TRIGGERS = ['/new', '/reset'];
export const DEFAULT_IDLE_MINUTES = 60;
