/**
 * Feishu Streaming Card Support
 *
 * Implements typing indicator and streaming text output for Feishu using
 * the Card Kit streaming API
 */
import { getChildLogger } from '../logging.js';
import { resolveFeishuApiBase, resolveFeishuDomain } from './domain.js';

/**
 * @typedef {object} FeishuStreamingCredentials
 * @property {string} appId
 * @property {string} appSecret
 * @property {string} [domain]
 */

/**
 * @typedef {object} FeishuStreamingCardState
 * @property {string} cardId
 * @property {string} messageId
 * @property {number} sequence
 * @property {string} elementId
 * @property {string} currentText
 */
const logger = getChildLogger({ module: 'feishu-streaming' });
const tokenCache = /* @__PURE__ */ new Map();
const getTokenCacheKey = (credentials) => `${resolveFeishuDomain(credentials.domain)}|${credentials.appId}`;
async function getTenantAccessToken(credentials) {
  const cacheKey = getTokenCacheKey(credentials);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 6e4) {
    return cached.token;
  }
  const apiBase = resolveFeishuApiBase(credentials.domain);
  const response = await fetch(`${apiBase}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: credentials.appId,
      app_secret: credentials.appSecret
    })
  });
  const result = await response.json();
  if (result.code !== 0 || !result.tenant_access_token) {
    throw new Error(`Failed to get tenant access token: ${result.msg}`);
  }
  tokenCache.set(cacheKey, {
    token: result.tenant_access_token,
    expiresAt: Date.now() + (result.expire ?? 7200) * 1e3
  });
  return result.tenant_access_token;
}
async function createStreamingCard(credentials, title) {
  const cardJson = {
    schema: '2.0',
    ...title ? {
      header: {
        title: {
          content: title,
          tag: 'plain_text'
        }
      }
    } : {},
    config: {
      streaming_mode: true,
      summary: {
        content: '[Generating...]'
      },
      streaming_config: {
        print_frequency_ms: { default: 50 },
        print_step: { default: 2 },
        print_strategy: 'fast'
      }
    },
    body: {
      elements: [
        {
          tag: 'markdown',
          content: '\u23F3 Thinking...',
          element_id: 'streaming_content'
        }
      ]
    }
  };
  const apiBase = resolveFeishuApiBase(credentials.domain);
  const response = await fetch(`${apiBase}/cardkit/v1/cards`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getTenantAccessToken(credentials)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'card_json',
      data: JSON.stringify(cardJson)
    })
  });
  const result = await response.json();
  if (result.code !== 0 || !result.data?.card_id) {
    throw new Error(`Failed to create streaming card: ${result.msg}`);
  }
  logger.debug(`Created streaming card: ${result.data.card_id}`);
  return { cardId: result.data.card_id };
}
async function sendStreamingCard(client, receiveId, cardId, receiveIdType = 'chat_id') {
  const content = JSON.stringify({
    type: 'card',
    data: { card_id: cardId }
  });
  const res = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: 'interactive',
      content
    }
  });
  if (res.code !== 0 || !res.data?.message_id) {
    throw new Error(`Failed to send streaming card: ${res.msg}`);
  }
  logger.debug(`Sent streaming card message: ${res.data.message_id}`);
  return { messageId: res.data.message_id };
}
async function updateStreamingCardText(credentials, cardId, elementId, text, sequence) {
  const apiBase = resolveFeishuApiBase(credentials.domain);
  const response = await fetch(
    `${apiBase}/cardkit/v1/cards/${cardId}/elements/${elementId}/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${await getTenantAccessToken(credentials)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: text,
        sequence,
        uuid: `stream_${cardId}_${sequence}`
      })
    }
  );
  const result = await response.json();
  if (result.code !== 0) {
    logger.warn(`Failed to update streaming card text: ${result.msg}`);
  }
}
async function closeStreamingMode(credentials, cardId, sequence, finalSummary) {
  const configObj = {
    streaming_mode: false,
    summary: { content: finalSummary || '' }
  };
  const settings = { config: configObj };
  const apiBase = resolveFeishuApiBase(credentials.domain);
  const response = await fetch(`${apiBase}/cardkit/v1/cards/${cardId}/settings`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${await getTenantAccessToken(credentials)}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      settings: JSON.stringify(settings),
      sequence,
      uuid: `close_${cardId}_${sequence}`
    })
  });
  const result = await response.json();
  if (result.code !== 0) {
    logger.warn(`Failed to close streaming mode: ${result.msg}`);
  } else {
    logger.debug(`Closed streaming mode for card: ${cardId}`);
  }
}
class FeishuStreamingSession {
  _client;
  _credentials;
  _state = null;
  _updateQueue = Promise.resolve();
  _closed = false;
  constructor(client, credentials) {
    this._client = client;
    this._credentials = credentials;
  }
  /**
   * Start a streaming session - creates and sends a streaming card
   * @param receiveId
   * @param receiveIdType
   * @param title
   */
  async start(receiveId, receiveIdType = 'chat_id', title) {
    if (this._state) {
      logger.warn('Streaming session already started');
      return;
    }
    try {
      const { cardId } = await createStreamingCard(this._credentials, title);
      const { messageId } = await sendStreamingCard(this._client, receiveId, cardId, receiveIdType);
      this._state = {
        cardId,
        messageId,
        sequence: 1,
        elementId: 'streaming_content',
        currentText: ''
      };
      logger.info(`Started streaming session: cardId=${cardId}, messageId=${messageId}`);
    } catch (err) {
      logger.error(`Failed to start streaming session: ${String(err)}`);
      throw err;
    }
  }
  /**
   * Update the streaming card with new text (appends to existing)
   * @param text
   */
  async update(text) {
    if (!this._state || this._closed) {
      return;
    }
    this._updateQueue = this._updateQueue.then(async () => {
      if (!this._state || this._closed) {
        return;
      }
      this._state.currentText = text;
      this._state.sequence += 1;
      try {
        await updateStreamingCardText(
          this._credentials,
          this._state.cardId,
          this._state.elementId,
          text,
          this._state.sequence
        );
      } catch (err) {
        logger.debug(`Streaming update failed (will retry): ${String(err)}`);
      }
    });
    await this._updateQueue;
  }
  /**
   * Finalize and close the streaming session
   * @param finalText
   * @param summary
   */
  async close(finalText, summary) {
    if (!this._state || this._closed) {
      return;
    }
    this._closed = true;
    await this._updateQueue;
    const text = finalText ?? this._state.currentText;
    this._state.sequence += 1;
    try {
      if (text) {
        await updateStreamingCardText(
          this._credentials,
          this._state.cardId,
          this._state.elementId,
          text,
          this._state.sequence
        );
      }
      this._state.sequence += 1;
      await closeStreamingMode(
        this._credentials,
        this._state.cardId,
        this._state.sequence,
        summary ?? truncateForSummary(text)
      );
      logger.info(`Closed streaming session: cardId=${this._state.cardId}`);
    } catch (err) {
      logger.error(`Failed to close streaming session: ${String(err)}`);
    }
  }
  /**
   * Check if session is active
   */
  isActive() {
    return this._state !== null && !this._closed;
  }
  /**
   * Get the message ID of the streaming card
   */
  getMessageId() {
    return this._state?.messageId ?? null;
  }
}
function truncateForSummary(text, maxLength = 50) {
  if (!text) {
    return '';
  }
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 3)  }...`;
}
export {
  FeishuStreamingSession,
  closeStreamingMode,
  createStreamingCard,
  sendStreamingCard,
  updateStreamingCardText
};
