import { fileTypeFromBuffer } from 'file-type';
import path from 'node:path';
import { mediaKindFromMime } from './constants.js';
const EXT_BY_MIME = {
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/x-m4a': '.m4a',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'application/pdf': '.pdf',
  'application/json': '.json',
  'application/zip': '.zip',
  'application/gzip': '.gz',
  'application/x-tar': '.tar',
  'application/x-7z-compressed': '.7z',
  'application/vnd.rar': '.rar',
  'application/msword': '.doc',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'text/markdown': '.md'
};
const MIME_BY_EXT = {
  ...Object.fromEntries(Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime])),
  // Additional extension aliases
  '.jpeg': 'image/jpeg'
};
const AUDIO_FILE_EXTENSIONS = /* @__PURE__ */ new Set([
  '.aac',
  '.flac',
  '.m4a',
  '.mp3',
  '.oga',
  '.ogg',
  '.opus',
  '.wav'
]);
function normalizeHeaderMime(mime) {
  if (!mime) {
    return void 0;
  }
  const cleaned = mime.split(';')[0]?.trim().toLowerCase();
  return cleaned || void 0;
}
async function sniffMime(buffer) {
  if (!buffer) {
    return void 0;
  }
  try {
    const type = await fileTypeFromBuffer(buffer);
    return type?.mime ?? void 0;
  } catch {
    return void 0;
  }
}
function getFileExtension(filePath) {
  if (!filePath) {
    return void 0;
  }
  try {
    if (/^https?:\/\//i.test(filePath)) {
      const url = new URL(filePath);
      return path.extname(url.pathname).toLowerCase() || void 0;
    }
  } catch {
    // Intentionally ignored
  }
  const ext = path.extname(filePath).toLowerCase();
  return ext || void 0;
}
function isAudioFileName(fileName) {
  const ext = getFileExtension(fileName);
  if (!ext) {
    return false;
  }
  return AUDIO_FILE_EXTENSIONS.has(ext);
}
function detectMime(opts) {
  return detectMimeImpl(opts);
}
function isGenericMime(mime) {
  if (!mime) {
    return true;
  }
  const m = mime.toLowerCase();
  return m === 'application/octet-stream' || m === 'application/zip';
}
async function detectMimeImpl(opts) {
  const ext = getFileExtension(opts.filePath);
  const extMime = ext ? MIME_BY_EXT[ext] : void 0;
  const headerMime = normalizeHeaderMime(opts.headerMime);
  const sniffed = await sniffMime(opts.buffer);
  if (sniffed && (!isGenericMime(sniffed) || !extMime)) {
    return sniffed;
  }
  if (extMime) {
    return extMime;
  }
  if (headerMime && !isGenericMime(headerMime)) {
    return headerMime;
  }
  if (sniffed) {
    return sniffed;
  }
  if (headerMime) {
    return headerMime;
  }
  return void 0;
}
function extensionForMime(mime) {
  if (!mime) {
    return void 0;
  }
  return EXT_BY_MIME[mime.toLowerCase()];
}
function isGifMedia(opts) {
  if (opts.contentType?.toLowerCase() === 'image/gif') {
    return true;
  }
  const ext = getFileExtension(opts.fileName);
  return ext === '.gif';
}
function imageMimeFromFormat(format) {
  if (!format) {
    return void 0;
  }
  switch (format.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return void 0;
  }
}
function kindFromMime(mime) {
  return mediaKindFromMime(mime);
}
export {
  detectMime,
  extensionForMime,
  getFileExtension,
  imageMimeFromFormat,
  isAudioFileName,
  isGifMedia,
  kindFromMime
};
