import { formatErrorMessage } from '../infra/errors.js';
import { getChildLogger } from '../logging.js';
import { mediaKindFromMime } from '../media/constants.js';
import { loadWebMedia } from '../web/media.js';
import { containsMarkdown, markdownToFeishuPost } from './format.js';
const logger = getChildLogger({ module: 'feishu-send' });
async function uploadImageFeishu(client, imageBuffer) {
  const res = await client.im.image.create({
    data: {
      image_type: 'message',
      image: imageBuffer
    }
  });
  if (!res?.image_key) {
    throw new Error('Feishu image upload failed: no image_key returned');
  }
  return res.image_key;
}
async function uploadFileFeishu(client, fileBuffer, fileName, fileType, duration) {
  logger.info(
    `Uploading file to Feishu: name=${fileName}, type=${fileType}, size=${fileBuffer.length}`
  );
  let res;
  try {
    res = await client.im.file.create({
      data: {
        file_type: fileType,
        file_name: fileName,
        file: fileBuffer,
        ...duration ? { duration } : {}
      }
    });
  } catch (err) {
    const errMsg = formatErrorMessage(err);
    logger.error(`Feishu file upload exception: ${errMsg}`);
    if (err && typeof err === 'object') {
      const response = err.response;
      if (response?.data) {
        logger.error(`Response data: ${JSON.stringify(response.data)}`);
      }
      if (response?.status) {
        logger.error(`Response status: ${response.status}`);
      }
    }
    throw new Error(`Feishu file upload failed: ${errMsg}`, { cause: err });
  }
  logger.info(`Feishu file upload response: ${JSON.stringify(res)}`);
  const responseMeta = res && typeof res === 'object' ? res : {};
  if (typeof responseMeta.code === 'number' && responseMeta.code !== 0) {
    const code = responseMeta.code;
    const msg = responseMeta.msg || 'unknown error';
    logger.error(`Feishu file upload API error: code=${code}, msg=${msg}`);
    throw new Error(`Feishu file upload failed: ${msg} (code: ${code})`);
  }
  const fileKey = res?.file_key;
  if (!fileKey) {
    logger.error(`Feishu file upload failed - no file_key in response: ${JSON.stringify(res)}`);
    throw new Error('Feishu file upload failed: no file_key returned');
  }
  logger.info(`Feishu file upload successful: file_key=${fileKey}`);
  return fileKey;
}
function resolveFeishuFileType(contentType, fileName) {
  const ct = contentType?.toLowerCase() ?? '';
  const fn = fileName?.toLowerCase() ?? '';
  if (ct.includes('audio/') || fn.endsWith('.opus') || fn.endsWith('.ogg')) {
    return 'opus';
  }
  if (ct.includes('video/') || fn.endsWith('.mp4') || fn.endsWith('.mov')) {
    return 'mp4';
  }
  if (ct.includes('pdf') || fn.endsWith('.pdf')) {
    return 'pdf';
  }
  if (ct.includes('msword') || ct.includes('wordprocessingml') || fn.endsWith('.doc') || fn.endsWith('.docx')) {
    return 'doc';
  }
  if (ct.includes('excel') || ct.includes('spreadsheetml') || fn.endsWith('.xls') || fn.endsWith('.xlsx')) {
    return 'xls';
  }
  if (ct.includes('powerpoint') || ct.includes('presentationml') || fn.endsWith('.ppt') || fn.endsWith('.pptx')) {
    return 'ppt';
  }
  return 'stream';
}
async function sendMessageFeishu(client, receiveId, content, opts = {}) {
  const receiveIdType = opts.receiveIdType || 'chat_id';
  let msgType = opts.msgType || 'text';
  let finalContent = content;
  const contentText = typeof content === 'object' && content !== null && 'text' in content ? content.text : void 0;
  if (opts.mediaUrl) {
    try {
      logger.info(`Loading media from: ${opts.mediaUrl}`);
      const media = await loadWebMedia(opts.mediaUrl, opts.maxBytes);
      const kind = mediaKindFromMime(media.contentType ?? void 0);
      const fileName = media.fileName ?? 'file';
      logger.info(
        `Media loaded: kind=${kind}, contentType=${media.contentType}, fileName=${fileName}, size=${media.buffer.length}`
      );
      if (kind === 'image') {
        const imageKey = await uploadImageFeishu(client, media.buffer);
        msgType = 'image';
        finalContent = { image_key: imageKey };
      } else if (kind === 'video') {
        const fileKey = await uploadFileFeishu(client, media.buffer, fileName, 'mp4');
        msgType = 'media';
        finalContent = { file_key: fileKey };
      } else if (kind === 'audio') {
        const isOpus = media.contentType?.includes('opus') || media.contentType?.includes('ogg') || fileName.toLowerCase().endsWith('.opus') || fileName.toLowerCase().endsWith('.ogg');
        if (isOpus) {
          logger.info(`Uploading opus audio: ${fileName}`);
          const fileKey = await uploadFileFeishu(client, media.buffer, fileName, 'opus');
          logger.info(`Opus upload successful, file_key: ${fileKey}`);
          msgType = 'audio';
          finalContent = { file_key: fileKey };
        } else {
          logger.info(`Uploading non-opus audio as file: ${fileName}`);
          const fileKey = await uploadFileFeishu(client, media.buffer, fileName, 'stream');
          logger.info(`File upload successful, file_key: ${fileKey}`);
          msgType = 'file';
          finalContent = { file_key: fileKey };
        }
      } else {
        const fileType = resolveFeishuFileType(media.contentType, fileName);
        const fileKey = await uploadFileFeishu(client, media.buffer, fileName, fileType);
        msgType = 'file';
        finalContent = { file_key: fileKey };
      }
      if (typeof contentText === 'string' && contentText.trim()) {
        const mediaRes = await client.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: receiveId,
            msg_type: msgType,
            content: JSON.stringify(finalContent)
          }
        });
        if (mediaRes.code !== 0) {
          logger.error(`Feishu media send failed: ${mediaRes.code} - ${mediaRes.msg}`);
          throw new Error(`Feishu API Error: ${mediaRes.msg}`);
        }
        const textRes = await client.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: receiveId,
            msg_type: 'text',
            content: JSON.stringify({ text: contentText })
          }
        });
        return textRes.data ?? null;
      }
    } catch (err) {
      const errMsg = formatErrorMessage(err);
      const errStack = err instanceof Error ? err.stack : void 0;
      logger.error(`Feishu media upload/send error: ${errMsg}`);
      if (errStack) {
        logger.error(`Stack: ${errStack}`);
      }
      throw new Error(`Feishu media upload failed: ${errMsg}`, { cause: err });
    }
  }
  const autoRichText = opts.autoRichText !== false;
  const finalText = typeof finalContent === 'object' && finalContent !== null && 'text' in finalContent ? finalContent.text : void 0;
  if (autoRichText && msgType === 'text' && typeof finalText === 'string' && containsMarkdown(finalText)) {
    try {
      const postContent = markdownToFeishuPost(finalText);
      msgType = 'post';
      finalContent = postContent;
      logger.debug('Converted Markdown to Feishu post format');
    } catch (err) {
      logger.warn(
        `Failed to convert Markdown to post, falling back to text: ${formatErrorMessage(err)}`
      );
    }
  }
  const contentStr = typeof finalContent === 'string' ? finalContent : JSON.stringify(finalContent);
  try {
    const res = await client.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: msgType,
        content: contentStr
      }
    });
    if (res.code !== 0) {
      logger.error(`Feishu send failed: ${res.code} - ${res.msg}`);
      throw new Error(`Feishu API Error: ${res.msg}`);
    }
    return res.data ?? null;
  } catch (err) {
    logger.error(`Feishu send error: ${formatErrorMessage(err)}`);
    throw err;
  }
}
export {
  sendMessageFeishu,
  uploadFileFeishu,
  uploadImageFeishu
};
