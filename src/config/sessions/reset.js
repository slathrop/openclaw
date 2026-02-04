/**
 * @module sessions/reset
 * Session reset policy resolution and freshness evaluation.
 */
import {normalizeMessageChannel} from '../../utils/message-channel.js';
import {DEFAULT_IDLE_MINUTES} from './types.js';

/**
 * @typedef {'daily' | 'idle'} SessionResetMode
 */

/**
 * @typedef {'dm' | 'group' | 'thread'} SessionResetType
 */

/**
 * @typedef {{ mode: SessionResetMode, atHour: number, idleMinutes?: number }} SessionResetPolicy
 */

/**
 * @typedef {{ fresh: boolean, dailyResetAt?: number, idleExpiresAt?: number }} SessionFreshness
 */

export const DEFAULT_RESET_MODE = 'daily';
export const DEFAULT_RESET_AT_HOUR = 4;

const THREAD_SESSION_MARKERS = [':thread:', ':topic:'];
const GROUP_SESSION_MARKERS = [':group:', ':channel:'];

/**
 * @param {string | null} [sessionKey]
 * @returns {boolean}
 */
export function isThreadSessionKey(sessionKey) {
  const normalized = (sessionKey ?? '').toLowerCase();
  if (!normalized) {
    return false;
  }
  return THREAD_SESSION_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * Determines the reset type (dm, group, or thread) for a session key.
 * @param {{ sessionKey?: string | null, isGroup?: boolean, isThread?: boolean }} params
 * @returns {SessionResetType}
 */
export function resolveSessionResetType(params) {
  if (params.isThread || isThreadSessionKey(params.sessionKey)) {
    return 'thread';
  }
  if (params.isGroup) {
    return 'group';
  }
  const normalized = (params.sessionKey ?? '').toLowerCase();
  if (GROUP_SESSION_MARKERS.some((marker) => normalized.includes(marker))) {
    return 'group';
  }
  return 'dm';
}

/**
 * Resolves the thread flag from various indicators.
 * @param {{ sessionKey?: string | null, messageThreadId?: string | number | null, threadLabel?: string | null, threadStarterBody?: string | null, parentSessionKey?: string | null }} params
 * @returns {boolean}
 */
export function resolveThreadFlag(params) {
  if (params.messageThreadId !== null && params.messageThreadId !== undefined) {
    return true;
  }
  if (params.threadLabel?.trim()) {
    return true;
  }
  if (params.threadStarterBody?.trim()) {
    return true;
  }
  if (params.parentSessionKey?.trim()) {
    return true;
  }
  return isThreadSessionKey(params.sessionKey);
}

/**
 * @param {number} now
 * @param {number} atHour
 * @returns {number}
 */
export function resolveDailyResetAtMs(now, atHour) {
  const normalizedAtHour = normalizeResetAtHour(atHour);
  const resetAt = new Date(now);
  resetAt.setHours(normalizedAtHour, 0, 0, 0);
  if (now < resetAt.getTime()) {
    resetAt.setDate(resetAt.getDate() - 1);
  }
  return resetAt.getTime();
}

/**
 * Resolves the session reset policy from config.
 * @param {{ sessionCfg?: object, resetType: SessionResetType, resetOverride?: object }} params
 * @returns {SessionResetPolicy}
 */
export function resolveSessionResetPolicy(params) {
  const sessionCfg = params.sessionCfg;
  const baseReset = params.resetOverride ?? sessionCfg?.reset;
  const typeReset = params.resetOverride ? undefined : sessionCfg?.resetByType?.[params.resetType];
  const hasExplicitReset = Boolean(baseReset || sessionCfg?.resetByType);
  const legacyIdleMinutes = params.resetOverride ? undefined : sessionCfg?.idleMinutes;
  const mode =
    typeReset?.mode ??
    baseReset?.mode ??
    (!hasExplicitReset && legacyIdleMinutes !== null && legacyIdleMinutes !== undefined ? 'idle' : DEFAULT_RESET_MODE);
  const atHour = normalizeResetAtHour(
    typeReset?.atHour ?? baseReset?.atHour ?? DEFAULT_RESET_AT_HOUR
  );
  const idleMinutesRaw = typeReset?.idleMinutes ?? baseReset?.idleMinutes ?? legacyIdleMinutes;

  let idleMinutes;
  if (idleMinutesRaw !== null && idleMinutesRaw !== undefined) {
    const normalized = Math.floor(idleMinutesRaw);
    if (Number.isFinite(normalized)) {
      idleMinutes = Math.max(normalized, 1);
    }
  } else if (mode === 'idle') {
    idleMinutes = DEFAULT_IDLE_MINUTES;
  }

  return {mode, atHour, idleMinutes};
}

/**
 * Resolves channel-specific reset config.
 * @param {{ sessionCfg?: object, channel?: string | null }} params
 * @returns {object | undefined}
 */
export function resolveChannelResetConfig(params) {
  const resetByChannel = params.sessionCfg?.resetByChannel;
  if (!resetByChannel) {
    return undefined;
  }
  const normalized = normalizeMessageChannel(params.channel);
  const fallback = params.channel?.trim().toLowerCase();
  const key = normalized ?? fallback;
  if (!key) {
    return undefined;
  }
  return resetByChannel[key] ?? resetByChannel[key.toLowerCase()];
}

/**
 * Evaluates whether a session is fresh based on its reset policy.
 * @param {{ updatedAt: number, now: number, policy: SessionResetPolicy }} params
 * @returns {SessionFreshness}
 */
export function evaluateSessionFreshness(params) {
  const dailyResetAt =
    params.policy.mode === 'daily'
      ? resolveDailyResetAtMs(params.now, params.policy.atHour)
      : undefined;
  const idleExpiresAt =
    params.policy.idleMinutes !== null && params.policy.idleMinutes !== undefined
      ? params.updatedAt + params.policy.idleMinutes * 60_000
      : undefined;
  const staleDaily = dailyResetAt !== null && dailyResetAt !== undefined && params.updatedAt < dailyResetAt;
  const staleIdle = idleExpiresAt !== null && idleExpiresAt !== undefined && params.now > idleExpiresAt;
  return {
    fresh: !(staleDaily || staleIdle),
    dailyResetAt,
    idleExpiresAt
  };
}

/**
 * @param {number | undefined} value
 * @returns {number}
 */
function normalizeResetAtHour(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RESET_AT_HOUR;
  }
  const normalized = Math.floor(value);
  if (!Number.isFinite(normalized)) {
    return DEFAULT_RESET_AT_HOUR;
  }
  if (normalized < 0) {
    return 0;
  }
  if (normalized > 23) {
    return 23;
  }
  return normalized;
}
