/**
 * Feishu typing indicator support.
 * Uses emoji reactions as a visual typing indicator since Feishu
 * doesn't have a native typing indicator API.
 * @module feishu/typing
 */
import { formatErrorMessage } from '../infra/errors.js';
import { getChildLogger } from '../logging.js';
import { addReactionFeishu, removeReactionFeishu, FeishuEmoji } from './reactions.js';

const logger = getChildLogger({ module: 'feishu-typing' });

/**
 * Add a typing indicator (reaction) to a message.
 * Requires permission: im:message.reaction:read_write
 * @param {object} client
 * @param {string} messageId
 * @returns {Promise<{messageId: string, reactionId: string|null}>}
 */
export async function addTypingIndicator(client, messageId) {
  try {
    const { reactionId } = await addReactionFeishu(client, messageId, FeishuEmoji.TYPING);
    logger.debug(`Added typing indicator reaction: ${reactionId}`);
    return { messageId, reactionId };
  } catch (err) {
    // Silently fail - typing indicator is not critical
    logger.debug(`Failed to add typing indicator: ${formatErrorMessage(err)}`);
    return { messageId, reactionId: null };
  }
}

/**
 * Remove a typing indicator (reaction) from a message.
 * @param {object} client
 * @param {{messageId: string, reactionId: string|null}} state
 * @returns {Promise<void>}
 */
export async function removeTypingIndicator(client, state) {
  if (!state.reactionId) {
    return;
  }

  try {
    await removeReactionFeishu(client, state.messageId, state.reactionId);
    logger.debug(`Removed typing indicator reaction: ${state.reactionId}`);
  } catch (err) {
    // Silently fail - cleanup is not critical
    logger.debug(`Failed to remove typing indicator: ${formatErrorMessage(err)}`);
  }
}

/**
 * Create typing indicator callbacks for use with reply dispatchers.
 * These callbacks automatically manage the typing indicator lifecycle.
 * @param {object} client
 * @param {string|undefined} messageId
 * @returns {{state: {current: object|null}, onReplyStart: () => Promise<void>, onIdle: () => Promise<void>}}
 */
export function createTypingIndicatorCallbacks(client, messageId) {
  const state = { current: null };

  return {
    state,
    onReplyStart: async () => {
      if (!messageId) {
        return;
      }
      state.current = await addTypingIndicator(client, messageId);
    },
    onIdle: async () => {
      if (!state.current) {
        return;
      }
      await removeTypingIndicator(client, state.current);
      state.current = null;
    }
  };
}
