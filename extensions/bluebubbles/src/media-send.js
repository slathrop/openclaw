import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChannelMediaMaxBytes } from 'openclaw/plugin-sdk';
import { sendBlueBubblesAttachment } from './attachments.js';
import { resolveBlueBubblesMessageId } from './monitor.js';
import { getBlueBubblesRuntime } from './runtime.js';
import { sendMessageBlueBubbles } from './send.js';
const HTTP_URL_RE = /^https?:\/\//i;
const MB = 1024 * 1024;
function assertMediaWithinLimit(sizeBytes, maxBytes) {
  if (typeof maxBytes !== 'number' || maxBytes <= 0) {
    return;
  }
  if (sizeBytes <= maxBytes) {
    return;
  }
  const maxLabel = (maxBytes / MB).toFixed(0);
  const sizeLabel = (sizeBytes / MB).toFixed(2);
  throw new Error(`Media exceeds ${maxLabel}MB limit (got ${sizeLabel}MB)`);
}
function resolveLocalMediaPath(source) {
  if (!source.startsWith('file://')) {
    return source;
  }
  try {
    return fileURLToPath(source);
  } catch {
    throw new Error(`Invalid file:// URL: ${source}`);
  }
}
function resolveFilenameFromSource(source) {
  if (!source) {
    return void 0;
  }
  if (source.startsWith('file://')) {
    try {
      return path.basename(fileURLToPath(source)) || void 0;
    } catch {
      return void 0;
    }
  }
  if (HTTP_URL_RE.test(source)) {
    try {
      return path.basename(new URL(source).pathname) || void 0;
    } catch {
      return void 0;
    }
  }
  const base = path.basename(source);
  return base || void 0;
}
async function sendBlueBubblesMedia(params) {
  const {
    cfg,
    to,
    mediaUrl,
    mediaPath,
    mediaBuffer,
    contentType,
    filename,
    caption,
    replyToId,
    accountId,
    asVoice
  } = params;
  const core = getBlueBubblesRuntime();
  const maxBytes = resolveChannelMediaMaxBytes({
    cfg,
    resolveChannelLimitMb: ({ cfg: cfg2, accountId: accountId2 }) => cfg2.channels?.bluebubbles?.accounts?.[accountId2]?.mediaMaxMb ?? cfg2.channels?.bluebubbles?.mediaMaxMb,
    accountId
  });
  let buffer;
  let resolvedContentType = contentType ?? void 0;
  let resolvedFilename = filename ?? void 0;
  if (mediaBuffer) {
    assertMediaWithinLimit(mediaBuffer.byteLength, maxBytes);
    buffer = mediaBuffer;
    if (!resolvedContentType) {
      const hint = mediaPath ?? mediaUrl;
      const detected = await core.media.detectMime({
        buffer: Buffer.isBuffer(mediaBuffer) ? mediaBuffer : Buffer.from(mediaBuffer),
        filePath: hint
      });
      resolvedContentType = detected ?? void 0;
    }
    if (!resolvedFilename) {
      resolvedFilename = resolveFilenameFromSource(mediaPath ?? mediaUrl);
    }
  } else {
    const source = mediaPath ?? mediaUrl;
    if (!source) {
      throw new Error('BlueBubbles media delivery requires mediaUrl, mediaPath, or mediaBuffer.');
    }
    if (HTTP_URL_RE.test(source)) {
      const fetched = await core.channel.media.fetchRemoteMedia({
        url: source,
        maxBytes: typeof maxBytes === 'number' && maxBytes > 0 ? maxBytes : void 0
      });
      buffer = fetched.buffer;
      resolvedContentType = resolvedContentType ?? fetched.contentType ?? void 0;
      resolvedFilename = resolvedFilename ?? fetched.fileName;
    } else {
      const localPath = resolveLocalMediaPath(source);
      const fs = await import('node:fs/promises');
      if (typeof maxBytes === 'number' && maxBytes > 0) {
        const stats = await fs.stat(localPath);
        assertMediaWithinLimit(stats.size, maxBytes);
      }
      const data = await fs.readFile(localPath);
      assertMediaWithinLimit(data.byteLength, maxBytes);
      buffer = new Uint8Array(data);
      if (!resolvedContentType) {
        const detected = await core.media.detectMime({
          buffer: data,
          filePath: localPath
        });
        resolvedContentType = detected ?? void 0;
      }
      if (!resolvedFilename) {
        resolvedFilename = resolveFilenameFromSource(localPath);
      }
    }
  }
  const replyToMessageGuid = replyToId?.trim() ? resolveBlueBubblesMessageId(replyToId.trim(), { requireKnownShortId: true }) : void 0;
  const attachmentResult = await sendBlueBubblesAttachment({
    to,
    buffer,
    filename: resolvedFilename ?? 'attachment',
    contentType: resolvedContentType ?? void 0,
    replyToMessageGuid,
    asVoice,
    opts: {
      cfg,
      accountId
    }
  });
  const trimmedCaption = caption?.trim();
  if (trimmedCaption) {
    await sendMessageBlueBubbles(to, trimmedCaption, {
      cfg,
      accountId,
      replyToMessageGuid
    });
  }
  return attachmentResult;
}
export {
  sendBlueBubblesMedia
};
