import crypto from 'node:crypto';
import path from 'node:path';
import { resolveBlueBubblesAccount } from './accounts.js';
import { resolveChatGuidForTarget } from './send.js';
import { parseBlueBubblesTarget, normalizeBlueBubblesHandle } from './targets.js';
import {
  blueBubblesFetchWithTimeout,
  buildBlueBubblesApiUrl
} from './types.js';
const DEFAULT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const AUDIO_MIME_MP3 = /* @__PURE__ */ new Set(['audio/mpeg', 'audio/mp3']);
const AUDIO_MIME_CAF = /* @__PURE__ */ new Set(['audio/x-caf', 'audio/caf']);
function sanitizeFilename(input, fallback) {
  const trimmed = input?.trim() ?? '';
  const base = trimmed ? path.basename(trimmed) : '';
  return base || fallback;
}
function ensureExtension(filename, extension, fallbackBase) {
  const currentExt = path.extname(filename);
  if (currentExt.toLowerCase() === extension) {
    return filename;
  }
  const base = currentExt ? filename.slice(0, -currentExt.length) : filename;
  return `${base || fallbackBase}${extension}`;
}
function resolveVoiceInfo(filename, contentType) {
  const normalizedType = contentType?.trim().toLowerCase();
  const extension = path.extname(filename).toLowerCase();
  const isMp3 = extension === '.mp3' || (normalizedType ? AUDIO_MIME_MP3.has(normalizedType) : false);
  const isCaf = extension === '.caf' || (normalizedType ? AUDIO_MIME_CAF.has(normalizedType) : false);
  const isAudio = isMp3 || isCaf || Boolean(normalizedType?.startsWith('audio/'));
  return { isAudio, isMp3, isCaf };
}
function resolveAccount(params) {
  const account = resolveBlueBubblesAccount({
    cfg: params.cfg ?? {},
    accountId: params.accountId
  });
  const baseUrl = params.serverUrl?.trim() || account.config.serverUrl?.trim();
  const password = params.password?.trim() || account.config.password?.trim();
  if (!baseUrl) {
    throw new Error('BlueBubbles serverUrl is required');
  }
  if (!password) {
    throw new Error('BlueBubbles password is required');
  }
  return { baseUrl, password };
}
async function downloadBlueBubblesAttachment(attachment, opts = {}) {
  const guid = attachment.guid?.trim();
  if (!guid) {
    throw new Error('BlueBubbles attachment guid is required');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/attachment/${encodeURIComponent(guid)}/download`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(url, { method: 'GET' }, opts.timeoutMs);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `BlueBubbles attachment download failed (${res.status}): ${errorText || 'unknown'}`
    );
  }
  const contentType = res.headers.get('content-type') ?? void 0;
  const buf = new Uint8Array(await res.arrayBuffer());
  const maxBytes = typeof opts.maxBytes === 'number' ? opts.maxBytes : DEFAULT_ATTACHMENT_MAX_BYTES;
  if (buf.byteLength > maxBytes) {
    throw new Error(`BlueBubbles attachment too large (${buf.byteLength} bytes)`);
  }
  return { buffer: buf, contentType: contentType ?? attachment.mimeType ?? void 0 };
}
function resolveSendTarget(raw) {
  const parsed = parseBlueBubblesTarget(raw);
  if (parsed.kind === 'handle') {
    return {
      kind: 'handle',
      address: normalizeBlueBubblesHandle(parsed.to),
      service: parsed.service
    };
  }
  if (parsed.kind === 'chat_id') {
    return { kind: 'chat_id', chatId: parsed.chatId };
  }
  if (parsed.kind === 'chat_guid') {
    return { kind: 'chat_guid', chatGuid: parsed.chatGuid };
  }
  return { kind: 'chat_identifier', chatIdentifier: parsed.chatIdentifier };
}
function extractMessageId(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'unknown';
  }
  const record = payload;
  const data = record.data && typeof record.data === 'object' ? record.data : null;
  const candidates = [
    record.messageId,
    record.guid,
    record.id,
    data?.messageId,
    data?.guid,
    data?.id
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return 'unknown';
}
async function sendBlueBubblesAttachment(params) {
  const { to, caption, replyToMessageGuid, replyToPartIndex, asVoice, opts = {} } = params;
  let { buffer, filename, contentType } = params;
  const wantsVoice = asVoice === true;
  const fallbackName = wantsVoice ? 'Audio Message' : 'attachment';
  filename = sanitizeFilename(filename, fallbackName);
  contentType = contentType?.trim() || void 0;
  const { baseUrl, password } = resolveAccount(opts);
  const isAudioMessage = wantsVoice;
  if (isAudioMessage) {
    const voiceInfo = resolveVoiceInfo(filename, contentType);
    if (!voiceInfo.isAudio) {
      throw new Error('BlueBubbles voice messages require audio media (mp3 or caf).');
    }
    if (voiceInfo.isMp3) {
      filename = ensureExtension(filename, '.mp3', fallbackName);
      contentType = contentType ?? 'audio/mpeg';
    } else if (voiceInfo.isCaf) {
      filename = ensureExtension(filename, '.caf', fallbackName);
      contentType = contentType ?? 'audio/x-caf';
    } else {
      throw new Error(
        'BlueBubbles voice messages require mp3 or caf audio (convert before sending).'
      );
    }
  }
  const target = resolveSendTarget(to);
  const chatGuid = await resolveChatGuidForTarget({
    baseUrl,
    password,
    timeoutMs: opts.timeoutMs,
    target
  });
  if (!chatGuid) {
    throw new Error(
      'BlueBubbles attachment send failed: chatGuid not found for target. Use a chat_guid target or ensure the chat exists.'
    );
  }
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: '/api/v1/message/attachment',
    password
  });
  const boundary = `----BlueBubblesFormBoundary${crypto.randomUUID().replace(/-/g, '')}`;
  const parts = [];
  const encoder = new TextEncoder();
  const addField = (name, value) => {
    parts.push(encoder.encode(`--${boundary}\r
`));
    parts.push(encoder.encode(`Content-Disposition: form-data; name="${name}"\r
\r
`));
    parts.push(encoder.encode(`${value}\r
`));
  };
  const addFile = (name, fileBuffer, fileName, mimeType) => {
    parts.push(encoder.encode(`--${boundary}\r
`));
    parts.push(
      encoder.encode(`Content-Disposition: form-data; name="${name}"; filename="${fileName}"\r
`)
    );
    parts.push(encoder.encode(`Content-Type: ${mimeType ?? 'application/octet-stream'}\r
\r
`));
    parts.push(fileBuffer);
    parts.push(encoder.encode('\r\n'));
  };
  addFile('attachment', buffer, filename, contentType);
  addField('chatGuid', chatGuid);
  addField('name', filename);
  addField('tempGuid', `temp-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`);
  addField('method', 'private-api');
  if (isAudioMessage) {
    addField('isAudioMessage', 'true');
  }
  const trimmedReplyTo = replyToMessageGuid?.trim();
  if (trimmedReplyTo) {
    addField('selectedMessageGuid', trimmedReplyTo);
    addField('partIndex', typeof replyToPartIndex === 'number' ? String(replyToPartIndex) : '0');
  }
  if (caption) {
    addField('message', caption);
    addField('text', caption);
    addField('caption', caption);
  }
  parts.push(encoder.encode(`--${boundary}--\r
`));
  const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    },
    opts.timeoutMs ?? 6e4
    // longer timeout for file uploads
  );
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `BlueBubbles attachment send failed (${res.status}): ${errorText || 'unknown'}`
    );
  }
  const responseBody = await res.text();
  if (!responseBody) {
    return { messageId: 'ok' };
  }
  try {
    const parsed = JSON.parse(responseBody);
    return { messageId: extractMessageId(parsed) };
  } catch {
    return { messageId: 'ok' };
  }
}
export {
  downloadBlueBubblesAttachment,
  sendBlueBubblesAttachment
};
