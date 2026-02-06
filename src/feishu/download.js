import { formatErrorMessage } from '../infra/errors.js';
import { getChildLogger } from '../logging.js';
import { saveMediaBuffer } from '../media/store.js';
const logger = getChildLogger({ module: 'feishu-download' });

/**
 * Download a resource from a user message using messageResource.get
 * This is the correct API for downloading resources from messages sent by users.
 *
 * @param {object} client
 * @param {string} messageId
 * @param {string} fileKey
 * @param {"image"|"file"} type - Resource type: "image" or "file" only (per Feishu API docs).
 *                                Audio/video must use type="file" despite being different media types.
 * @param {number} [maxBytes]
 * @returns {Promise<{path: string, contentType: string, placeholder: string}>}
 * @see https://open.feishu.cn/document/server-docs/im-v1/message/get-2
 */
async function downloadFeishuMessageResource(client, messageId, fileKey, type, maxBytes = 30 * 1024 * 1024) {
  logger.debug(`Downloading Feishu ${type}: messageId=${messageId}, fileKey=${fileKey}`);
  const res = await client.im.messageResource.get({
    params: { type },
    path: {
      message_id: messageId,
      file_key: fileKey
    }
  });
  if (!res) {
    throw new Error(`Failed to get ${type} resource: no response`);
  }
  const stream = res.getReadableStream();
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of stream) {
    totalSize += chunk.length;
    if (totalSize > maxBytes) {
      throw new Error(`${type} resource exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`);
    }
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  const contentType = res.headers?.['content-type'] ?? res.headers?.['Content-Type'] ?? getDefaultContentType(type);
  const saved = await saveMediaBuffer(buffer, contentType, 'inbound', maxBytes);
  return {
    path: saved.path,
    contentType: saved.contentType,
    placeholder: getPlaceholder(type)
  };
}
function getDefaultContentType(type) {
  switch (type) {
    case 'image':
      return 'image/jpeg';
    case 'audio':
      return 'audio/ogg';
    case 'video':
      return 'video/mp4';
    default:
      return 'application/octet-stream';
  }
}
function getPlaceholder(type) {
  switch (type) {
    case 'image':
      return '<media:image>';
    case 'audio':
      return '<media:audio>';
    case 'video':
      return '<media:video>';
    default:
      return '<media:document>';
  }
}
async function resolveFeishuMedia(client, message, maxBytes = 30 * 1024 * 1024) {
  const msgType = message.message_type;
  const messageId = message.message_id;
  if (!messageId) {
    logger.warn('Cannot download media: message_id is missing');
    return null;
  }
  try {
    const rawContent = message.content;
    if (!rawContent) {
      return null;
    }
    if (msgType === 'image') {
      const content = JSON.parse(rawContent);
      if (content.image_key) {
        return await downloadFeishuMessageResource(
          client,
          messageId,
          content.image_key,
          'image',
          maxBytes
        );
      }
    } else if (msgType === 'file') {
      const content = JSON.parse(rawContent);
      if (content.file_key) {
        return await downloadFeishuMessageResource(
          client,
          messageId,
          content.file_key,
          'file',
          maxBytes
        );
      }
    } else if (msgType === 'audio') {
      // Note: Feishu API only supports type="image" or type="file" for messageResource.get
      // Audio must be downloaded using type="file" per official docs:
      // https://open.feishu.cn/document/server-docs/im-v1/message/get-2
      const content = JSON.parse(rawContent);
      if (content.file_key) {
        const result = await downloadFeishuMessageResource(
          client,
          messageId,
          content.file_key,
          'file', // Use "file" type for audio download (API limitation)
          maxBytes
        );
        // Override placeholder to indicate audio content
        return {
          ...result,
          placeholder: '<media:audio>'
        };
      }
    } else if (msgType === 'media') {
      // Video message: content = { file_key: "...", image_key: "..." (thumbnail) }
      // Note: Video must also be downloaded using type="file" per Feishu API docs
      const content = JSON.parse(rawContent);
      if (content.file_key) {
        const result = await downloadFeishuMessageResource(
          client,
          messageId,
          content.file_key,
          'file', // Use "file" type for video download (API limitation)
          maxBytes
        );
        // Override placeholder to indicate video content
        return {
          ...result,
          placeholder: '<media:video>'
        };
      }
    } else if (msgType === 'sticker') {
      logger.debug('Sticker messages are not supported for download');
      return null;
    }
  } catch (err) {
    logger.error(`Failed to resolve Feishu media (${msgType}): ${formatErrorMessage(err)}`);
  }
  return null;
}

/**
 * Extract image keys from post (rich text) message content.
 * Post content structure: { post: { locale: { content: [[{ tag: "img", image_key: "..." }]] } } }
 * @param {unknown} content
 * @returns {string[]}
 */
function extractPostImageKeys(content) {
  const imageKeys = [];

  if (!content || typeof content !== 'object') {
    return imageKeys;
  }

  const obj = content;

  // Handle locale-wrapped format: { post: { zh_cn: { content: [...] } } }
  let postData = obj;
  if (obj.post && typeof obj.post === 'object') {
    const post = obj.post;
    const localeKey = Object.keys(post).find((key) => post[key] && typeof post[key] === 'object');
    if (localeKey) {
      postData = post[localeKey];
    }
  }

  // Extract image_key from content elements
  const contentArray = postData.content;
  if (!Array.isArray(contentArray)) {
    return imageKeys;
  }

  for (const line of contentArray) {
    if (!Array.isArray(line)) {
      continue;
    }
    for (const element of line) {
      if (
        element &&
        typeof element === 'object' &&
        element.tag === 'img' &&
        typeof element.image_key === 'string'
      ) {
        imageKeys.push(element.image_key);
      }
    }
  }

  return imageKeys;
}

/**
 * Download embedded images from a post (rich text) message.
 * @param {object} client
 * @param {string} messageId
 * @param {string[]} imageKeys
 * @param {number} [maxBytes]
 * @param {number} [maxImages]
 * @returns {Promise<Array<{path: string, contentType: string, placeholder: string}>>}
 */
async function downloadPostImages(client, messageId, imageKeys, maxBytes = 30 * 1024 * 1024, maxImages = 5) {
  const results = [];

  for (const imageKey of imageKeys.slice(0, maxImages)) {
    try {
      const media = await downloadFeishuMessageResource(
        client,
        messageId,
        imageKey,
        'image',
        maxBytes
      );
      results.push(media);
    } catch (err) {
      logger.warn(`Failed to download post image ${imageKey}: ${formatErrorMessage(err)}`);
    }
  }

  return results;
}

export {
  downloadFeishuMessageResource,
  downloadPostImages,
  extractPostImageKeys,
  resolveFeishuMedia
};
