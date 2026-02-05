/** @module gateway/chat-attachments -- Attachment processing for chat messages (images, files, media). */
import { detectMime } from '../media/mime.js';
function normalizeMime(mime) {
  if (!mime) {
    return void 0;
  }
  const cleaned = mime.split(';')[0]?.trim().toLowerCase();
  return cleaned || void 0;
}
async function sniffMimeFromBase64(base64) {
  const trimmed = base64.trim();
  if (!trimmed) {
    return void 0;
  }
  const take = Math.min(256, trimmed.length);
  const sliceLen = take - take % 4;
  if (sliceLen < 8) {
    return void 0;
  }
  try {
    const head = Buffer.from(trimmed.slice(0, sliceLen), 'base64');
    return await detectMime({ buffer: head });
  } catch {
    return void 0;
  }
}
function isImageMime(mime) {
  return typeof mime === 'string' && mime.startsWith('image/');
}
async function parseMessageWithAttachments(message, attachments, opts) {
  const maxBytes = opts?.maxBytes ?? 5e6;
  const log = opts?.log;
  if (!attachments || attachments.length === 0) {
    return { message, images: [] };
  }
  const images = [];
  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? '';
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;
    if (typeof content !== 'string') {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }
    let sizeBytes = 0;
    let b64 = content.trim();
    const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(b64);
    if (dataUrlMatch) {
      b64 = dataUrlMatch[1];
    }
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, 'base64').byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }
    const providedMime = normalizeMime(mime);
    const sniffedMime = normalizeMime(await sniffMimeFromBase64(b64));
    if (sniffedMime && !isImageMime(sniffedMime)) {
      log?.warn(`attachment ${label}: detected non-image (${sniffedMime}), dropping`);
      continue;
    }
    if (!sniffedMime && !isImageMime(providedMime)) {
      log?.warn(`attachment ${label}: unable to detect image mime type, dropping`);
      continue;
    }
    if (sniffedMime && providedMime && sniffedMime !== providedMime) {
      log?.warn(
        `attachment ${label}: mime mismatch (${providedMime} -> ${sniffedMime}), using sniffed`
      );
    }
    images.push({
      type: 'image',
      data: b64,
      mimeType: sniffedMime ?? providedMime ?? mime
    });
  }
  return { message, images };
}
function buildMessageWithAttachments(message, attachments, opts) {
  const maxBytes = opts?.maxBytes ?? 2e6;
  if (!attachments || attachments.length === 0) {
    return message;
  }
  const blocks = [];
  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? '';
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;
    if (typeof content !== 'string') {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }
    if (!mime.startsWith('image/')) {
      throw new Error(`attachment ${label}: only image/* supported`);
    }
    let sizeBytes = 0;
    const b64 = content.trim();
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, 'base64').byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }
    const safeLabel = label.replace(/\s+/g, '_');
    const dataUrl = `![${safeLabel}](data:${mime};base64,${content})`;
    blocks.push(dataUrl);
  }
  if (blocks.length === 0) {
    return message;
  }
  const separator = message.trim().length > 0 ? '\n\n' : '';
  return `${message}${separator}${blocks.join('\n\n')}`;
}
export {
  buildMessageWithAttachments,
  parseMessageWithAttachments
};
