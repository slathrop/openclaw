/**
 * Delivery context normalization and merging utilities.
 *
 * A delivery context identifies where a message should be delivered:
 * channel, recipient, account, and optional thread. These helpers
 * normalize, merge, and derive delivery contexts from session state.
 */
import {normalizeAccountId} from './account-id.js';
import {normalizeMessageChannel} from './message-channel.js';

/**
 * @typedef {object} DeliveryContext
 * @property {string} [channel] - Channel type identifier.
 * @property {string} [to] - Recipient identifier.
 * @property {string} [accountId] - Account identifier.
 * @property {string | number} [threadId] - Thread identifier.
 */

/**
 * @typedef {object} DeliveryContextSessionSource
 * @property {string} [channel]
 * @property {string} [lastChannel]
 * @property {string} [lastTo]
 * @property {string} [lastAccountId]
 * @property {string | number} [lastThreadId]
 * @property {DeliveryContext} [deliveryContext]
 */

/**
 * Normalizes a delivery context by trimming strings and dropping empty values.
 * @param {DeliveryContext} [context]
 * @returns {DeliveryContext | undefined}
 */
export function normalizeDeliveryContext(context) {
  if (!context) {
    return undefined;
  }
  const channel =
    typeof context.channel === 'string'
      ? (normalizeMessageChannel(context.channel) ?? context.channel.trim())
      : undefined;
  const to = typeof context.to === 'string' ? context.to.trim() : undefined;
  const accountId = normalizeAccountId(context.accountId);
  const threadId =
    typeof context.threadId === 'number' && Number.isFinite(context.threadId)
      ? Math.trunc(context.threadId)
      : typeof context.threadId === 'string'
        ? context.threadId.trim()
        : undefined;
  const normalizedThreadId =
    typeof threadId === 'string' ? (threadId ? threadId : undefined) : threadId;
  if (!channel && !to && !accountId && (normalizedThreadId === null || normalizedThreadId === undefined)) {
    return undefined;
  }
  const normalized = {
    channel: channel || undefined,
    to: to || undefined,
    accountId
  };
  if (normalizedThreadId !== null && normalizedThreadId !== undefined) {
    normalized.threadId = normalizedThreadId;
  }
  return normalized;
}

/**
 * Normalizes session delivery fields and mirrors them on the returned object.
 * @param {DeliveryContextSessionSource} [source]
 * @returns {{deliveryContext?: DeliveryContext, lastChannel?: string, lastTo?: string, lastAccountId?: string, lastThreadId?: string | number}}
 */
export function normalizeSessionDeliveryFields(source) {
  if (!source) {
    return {
      deliveryContext: undefined,
      lastChannel: undefined,
      lastTo: undefined,
      lastAccountId: undefined,
      lastThreadId: undefined
    };
  }

  const merged = mergeDeliveryContext(
    normalizeDeliveryContext({
      channel: source.lastChannel ?? source.channel,
      to: source.lastTo,
      accountId: source.lastAccountId,
      threadId: source.lastThreadId
    }),
    normalizeDeliveryContext(source.deliveryContext)
  );

  if (!merged) {
    return {
      deliveryContext: undefined,
      lastChannel: undefined,
      lastTo: undefined,
      lastAccountId: undefined,
      lastThreadId: undefined
    };
  }

  return {
    deliveryContext: merged,
    lastChannel: merged.channel,
    lastTo: merged.to,
    lastAccountId: merged.accountId,
    lastThreadId: merged.threadId
  };
}

/**
 * Derives a delivery context from a session entry, including origin threadId fallback.
 * @param {DeliveryContextSessionSource & {origin?: {threadId?: string | number}}} [entry]
 * @returns {DeliveryContext | undefined}
 */
export function deliveryContextFromSession(entry) {
  if (!entry) {
    return undefined;
  }
  const source = {
    channel: entry.channel,
    lastChannel: entry.lastChannel,
    lastTo: entry.lastTo,
    lastAccountId: entry.lastAccountId,
    lastThreadId: entry.lastThreadId ?? entry.deliveryContext?.threadId ?? entry.origin?.threadId,
    deliveryContext: entry.deliveryContext
  };
  return normalizeSessionDeliveryFields(source).deliveryContext;
}

/**
 * Merges two delivery contexts, preferring primary values over fallback.
 * @param {DeliveryContext} [primary]
 * @param {DeliveryContext} [fallback]
 * @returns {DeliveryContext | undefined}
 */
export function mergeDeliveryContext(primary, fallback) {
  const normalizedPrimary = normalizeDeliveryContext(primary);
  const normalizedFallback = normalizeDeliveryContext(fallback);
  if (!normalizedPrimary && !normalizedFallback) {
    return undefined;
  }
  return normalizeDeliveryContext({
    channel: normalizedPrimary?.channel ?? normalizedFallback?.channel,
    to: normalizedPrimary?.to ?? normalizedFallback?.to,
    accountId: normalizedPrimary?.accountId ?? normalizedFallback?.accountId,
    threadId: normalizedPrimary?.threadId ?? normalizedFallback?.threadId
  });
}

/**
 * Builds a stable string key for a delivery context (channel|to|accountId|threadId).
 * @param {DeliveryContext} [context]
 * @returns {string | undefined}
 */
export function deliveryContextKey(context) {
  const normalized = normalizeDeliveryContext(context);
  if (!normalized?.channel || !normalized?.to) {
    return undefined;
  }
  const threadId =
    normalized.threadId !== null && normalized.threadId !== undefined && normalized.threadId !== '' ? String(normalized.threadId) : '';
  return `${normalized.channel}|${normalized.to}|${normalized.accountId ?? ''}|${threadId}`;
}
