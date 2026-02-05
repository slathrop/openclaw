const IMAGE_EXT_RE = /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i;
const IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const ATTACHMENT_TAG_RE = /<attachment[^>]+id=["']([^"']+)["'][^>]*>/gi;
const DEFAULT_MEDIA_HOST_ALLOWLIST = [
  'graph.microsoft.com',
  'graph.microsoft.us',
  'graph.microsoft.de',
  'graph.microsoft.cn',
  'sharepoint.com',
  'sharepoint.us',
  'sharepoint.de',
  'sharepoint.cn',
  'sharepoint-df.com',
  '1drv.ms',
  'onedrive.com',
  'teams.microsoft.com',
  'teams.cdn.office.net',
  'statics.teams.cdn.office.net',
  'office.com',
  'office.net',
  // Azure Media Services / Skype CDN for clipboard-pasted images
  'asm.skype.com',
  'ams.skype.com',
  'media.ams.skype.com',
  // Bot Framework attachment URLs
  'trafficmanager.net',
  'blob.core.windows.net',
  'azureedge.net',
  'microsoft.com'
];
const DEFAULT_MEDIA_AUTH_HOST_ALLOWLIST = [
  'api.botframework.com',
  'botframework.com',
  'graph.microsoft.com',
  'graph.microsoft.us',
  'graph.microsoft.de',
  'graph.microsoft.cn'
];
const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function normalizeContentType(value) {
  if (typeof value !== 'string') {
    return void 0;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : void 0;
}
function inferPlaceholder(params) {
  const mime = params.contentType?.toLowerCase() ?? '';
  const name = params.fileName?.toLowerCase() ?? '';
  const fileType = params.fileType?.toLowerCase() ?? '';
  const looksLikeImage = mime.startsWith('image/') || IMAGE_EXT_RE.test(name) || IMAGE_EXT_RE.test(`x.${fileType}`);
  return looksLikeImage ? '<media:image>' : '<media:document>';
}
function isLikelyImageAttachment(att) {
  const contentType = normalizeContentType(att.contentType) ?? '';
  const name = typeof att.name === 'string' ? att.name : '';
  if (contentType.startsWith('image/')) {
    return true;
  }
  if (IMAGE_EXT_RE.test(name)) {
    return true;
  }
  if (contentType === 'application/vnd.microsoft.teams.file.download.info' && isRecord(att.content)) {
    const fileType = typeof att.content.fileType === 'string' ? att.content.fileType : '';
    if (fileType && IMAGE_EXT_RE.test(`x.${fileType}`)) {
      return true;
    }
    const fileName = typeof att.content.fileName === 'string' ? att.content.fileName : '';
    if (fileName && IMAGE_EXT_RE.test(fileName)) {
      return true;
    }
  }
  return false;
}
function isDownloadableAttachment(att) {
  const contentType = normalizeContentType(att.contentType) ?? '';
  if (contentType === 'application/vnd.microsoft.teams.file.download.info' && isRecord(att.content) && typeof att.content.downloadUrl === 'string') {
    return true;
  }
  if (typeof att.contentUrl === 'string' && att.contentUrl.trim()) {
    return true;
  }
  return false;
}
function isHtmlAttachment(att) {
  const contentType = normalizeContentType(att.contentType) ?? '';
  return contentType.startsWith('text/html');
}
function extractHtmlFromAttachment(att) {
  if (!isHtmlAttachment(att)) {
    return void 0;
  }
  if (typeof att.content === 'string') {
    return att.content;
  }
  if (!isRecord(att.content)) {
    return void 0;
  }
  const text = typeof att.content.text === 'string' ? att.content.text : typeof att.content.body === 'string' ? att.content.body : typeof att.content.content === 'string' ? att.content.content : void 0;
  return text;
}
function decodeDataImage(src) {
  const match = /^data:(image\/[a-z0-9.+-]+)?(;base64)?,(.*)$/i.exec(src);
  if (!match) {
    return null;
  }
  const contentType = match[1]?.toLowerCase();
  const isBase64 = Boolean(match[2]);
  if (!isBase64) {
    return null;
  }
  const payload = match[3] ?? '';
  if (!payload) {
    return null;
  }
  try {
    const data = Buffer.from(payload, 'base64');
    return { kind: 'data', data, contentType, placeholder: '<media:image>' };
  } catch {
    return null;
  }
}
function fileHintFromUrl(src) {
  try {
    const url = new URL(src);
    const name = url.pathname.split('/').pop();
    return name || void 0;
  } catch {
    return void 0;
  }
}
function extractInlineImageCandidates(attachments) {
  const out = [];
  for (const att of attachments) {
    const html = extractHtmlFromAttachment(att);
    if (!html) {
      continue;
    }
    IMG_SRC_RE.lastIndex = 0;
    let match = IMG_SRC_RE.exec(html);
    while (match) {
      const src = match[1]?.trim();
      if (src && !src.startsWith('cid:')) {
        if (src.startsWith('data:')) {
          const decoded = decodeDataImage(src);
          if (decoded) {
            out.push(decoded);
          }
        } else {
          out.push({
            kind: 'url',
            url: src,
            fileHint: fileHintFromUrl(src),
            placeholder: '<media:image>'
          });
        }
      }
      match = IMG_SRC_RE.exec(html);
    }
  }
  return out;
}
function safeHostForUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return 'invalid-url';
  }
}
function normalizeAllowHost(value) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  if (trimmed === '*') {
    return '*';
  }
  return trimmed.replace(/^\*\.?/, '');
}
function resolveAllowedHosts(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return DEFAULT_MEDIA_HOST_ALLOWLIST.slice();
  }
  const normalized = input.map(normalizeAllowHost).filter(Boolean);
  if (normalized.includes('*')) {
    return ['*'];
  }
  return normalized;
}
function resolveAuthAllowedHosts(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return DEFAULT_MEDIA_AUTH_HOST_ALLOWLIST.slice();
  }
  const normalized = input.map(normalizeAllowHost).filter(Boolean);
  if (normalized.includes('*')) {
    return ['*'];
  }
  return normalized;
}
function isHostAllowed(host, allowlist) {
  if (allowlist.includes('*')) {
    return true;
  }
  const normalized = host.toLowerCase();
  return allowlist.some((entry) => normalized === entry || normalized.endsWith(`.${entry}`));
}
function isUrlAllowed(url, allowlist) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    return isHostAllowed(parsed.hostname, allowlist);
  } catch {
    return false;
  }
}
export {
  ATTACHMENT_TAG_RE,
  DEFAULT_MEDIA_AUTH_HOST_ALLOWLIST,
  DEFAULT_MEDIA_HOST_ALLOWLIST,
  GRAPH_ROOT,
  IMAGE_EXT_RE,
  IMG_SRC_RE,
  extractHtmlFromAttachment,
  extractInlineImageCandidates,
  inferPlaceholder,
  isDownloadableAttachment,
  isLikelyImageAttachment,
  isRecord,
  isUrlAllowed,
  normalizeContentType,
  resolveAllowedHosts,
  resolveAuthAllowedHosts,
  safeHostForUrl
};
