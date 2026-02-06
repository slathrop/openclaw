/**
 * Feishu message reaction support.
 * @module feishu/reactions
 */

/**
 * Add a reaction (emoji) to a message.
 * @param {object} client - Feishu SDK client
 * @param {string} messageId
 * @param {string} emojiType - e.g. "SMILE", "THUMBSUP", "HEART", "Typing"
 * @returns {Promise<{reactionId: string}>}
 * @see https://open.feishu.cn/document/server-docs/im-v1/message-reaction/emojis-introduce
 */
export async function addReactionFeishu(client, messageId, emojiType) {
  const response = await client.im.messageReaction.create({
    path: { message_id: messageId },
    data: {
      reaction_type: {
        emoji_type: emojiType
      }
    }
  });

  if (response.code !== 0) {
    throw new Error(`Feishu add reaction failed: ${response.msg || `code ${response.code}`}`);
  }

  const reactionId = response.data?.reaction_id;
  if (!reactionId) {
    throw new Error('Feishu add reaction failed: no reaction_id returned');
  }

  return { reactionId };
}

/**
 * Remove a reaction from a message.
 * @param {object} client - Feishu SDK client
 * @param {string} messageId
 * @param {string} reactionId
 * @returns {Promise<void>}
 */
export async function removeReactionFeishu(client, messageId, reactionId) {
  const response = await client.im.messageReaction.delete({
    path: {
      message_id: messageId,
      reaction_id: reactionId
    }
  });

  if (response.code !== 0) {
    throw new Error(`Feishu remove reaction failed: ${response.msg || `code ${response.code}`}`);
  }
}

/**
 * List all reactions for a message.
 * @param {object} client - Feishu SDK client
 * @param {string} messageId
 * @param {string} [emojiType]
 * @returns {Promise<Array<{reactionId: string, emojiType: string, operatorType: string, operatorId: string}>>}
 */
export async function listReactionsFeishu(client, messageId, emojiType) {
  const response = await client.im.messageReaction.list({
    path: { message_id: messageId },
    params: emojiType ? { reaction_type: emojiType } : undefined
  });

  if (response.code !== 0) {
    throw new Error(`Feishu list reactions failed: ${response.msg || `code ${response.code}`}`);
  }

  const items = response.data?.items ?? [];
  return items.map((item) => ({
    reactionId: item.reaction_id ?? '',
    emojiType: item.reaction_type?.emoji_type ?? '',
    operatorType: item.operator_type === 'app' ? 'app' : 'user',
    operatorId:
      item.operator_id?.open_id ?? item.operator_id?.user_id ?? item.operator_id?.union_id ?? ''
  }));
}

/**
 * Common Feishu emoji types for convenience.
 * @see https://open.feishu.cn/document/server-docs/im-v1/message-reaction/emojis-introduce
 */
export const FeishuEmoji = {
  // Common reactions
  THUMBSUP: 'THUMBSUP',
  THUMBSDOWN: 'THUMBSDOWN',
  HEART: 'HEART',
  SMILE: 'SMILE',
  GRINNING: 'GRINNING',
  LAUGHING: 'LAUGHING',
  CRY: 'CRY',
  ANGRY: 'ANGRY',
  SURPRISED: 'SURPRISED',
  THINKING: 'THINKING',
  CLAP: 'CLAP',
  OK: 'OK',
  FIST: 'FIST',
  PRAY: 'PRAY',
  FIRE: 'FIRE',
  PARTY: 'PARTY',
  CHECK: 'CHECK',
  CROSS: 'CROSS',
  QUESTION: 'QUESTION',
  EXCLAMATION: 'EXCLAMATION',
  // Special typing indicator
  TYPING: 'Typing'
};
