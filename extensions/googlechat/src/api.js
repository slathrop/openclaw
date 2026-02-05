import crypto from 'node:crypto';
import { getGoogleChatAccessToken } from './auth.js';
const CHAT_API_BASE = 'https://chat.googleapis.com/v1';
const CHAT_UPLOAD_BASE = 'https://chat.googleapis.com/upload/v1';
const headersToObject = (headers) => headers instanceof Headers ? Object.fromEntries(headers.entries()) : Array.isArray(headers) ? Object.fromEntries(headers) : headers || {};
async function fetchJson(account, url, init) {
  const token = await getGoogleChatAccessToken(account);
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headersToObject(init.headers),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Chat API ${res.status}: ${text || res.statusText}`);
  }
  return await res.json();
}
async function fetchOk(account, url, init) {
  const token = await getGoogleChatAccessToken(account);
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headersToObject(init.headers),
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Chat API ${res.status}: ${text || res.statusText}`);
  }
}
async function fetchBuffer(account, url, init, options) {
  const token = await getGoogleChatAccessToken(account);
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headersToObject(init?.headers),
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Chat API ${res.status}: ${text || res.statusText}`);
  }
  const maxBytes = options?.maxBytes;
  const lengthHeader = res.headers.get('content-length');
  if (maxBytes && lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > maxBytes) {
      throw new Error(`Google Chat media exceeds max bytes (${maxBytes})`);
    }
  }
  if (!maxBytes || !res.body) {
    const buffer2 = Buffer.from(await res.arrayBuffer());
    const contentType2 = res.headers.get('content-type') ?? void 0;
    return { buffer: buffer2, contentType: contentType2 };
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Google Chat media exceeds max bytes (${maxBytes})`);
    }
    chunks.push(Buffer.from(value));
  }
  const buffer = Buffer.concat(chunks, total);
  const contentType = res.headers.get('content-type') ?? void 0;
  return { buffer, contentType };
}
async function sendGoogleChatMessage(params) {
  const { account, space, text, thread, attachments } = params;
  const body = {};
  if (text) {
    body.text = text;
  }
  if (thread) {
    body.thread = { name: thread };
  }
  if (attachments && attachments.length > 0) {
    body.attachment = attachments.map((item) => ({
      attachmentDataRef: { attachmentUploadToken: item.attachmentUploadToken },
      ...item.contentName ? { contentName: item.contentName } : {}
    }));
  }
  const url = `${CHAT_API_BASE}/${space}/messages`;
  const result = await fetchJson(account, url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return result ? { messageName: result.name } : null;
}
async function updateGoogleChatMessage(params) {
  const { account, messageName, text } = params;
  const url = `${CHAT_API_BASE}/${messageName}?updateMask=text`;
  const result = await fetchJson(account, url, {
    method: 'PATCH',
    body: JSON.stringify({ text })
  });
  return { messageName: result.name };
}
async function deleteGoogleChatMessage(params) {
  const { account, messageName } = params;
  const url = `${CHAT_API_BASE}/${messageName}`;
  await fetchOk(account, url, { method: 'DELETE' });
}
async function uploadGoogleChatAttachment(params) {
  const { account, space, filename, buffer, contentType } = params;
  const boundary = `openclaw-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ filename });
  const header = `--${boundary}\r
Content-Type: application/json; charset=UTF-8\r
\r
${metadata}\r
`;
  const mediaHeader = `--${boundary}\r
Content-Type: ${contentType ?? 'application/octet-stream'}\r
\r
`;
  const footer = `\r
--${boundary}--\r
`;
  const body = Buffer.concat([
    Buffer.from(header, 'utf8'),
    Buffer.from(mediaHeader, 'utf8'),
    buffer,
    Buffer.from(footer, 'utf8')
  ]);
  const token = await getGoogleChatAccessToken(account);
  const url = `${CHAT_UPLOAD_BASE}/${space}/attachments:upload?uploadType=multipart`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Chat upload ${res.status}: ${text || res.statusText}`);
  }
  const payload = await res.json();
  return {
    attachmentUploadToken: payload.attachmentDataRef?.attachmentUploadToken
  };
}
async function downloadGoogleChatMedia(params) {
  const { account, resourceName, maxBytes } = params;
  const url = `${CHAT_API_BASE}/media/${resourceName}?alt=media`;
  return await fetchBuffer(account, url, void 0, { maxBytes });
}
async function createGoogleChatReaction(params) {
  const { account, messageName, emoji } = params;
  const url = `${CHAT_API_BASE}/${messageName}/reactions`;
  return await fetchJson(account, url, {
    method: 'POST',
    body: JSON.stringify({ emoji: { unicode: emoji } })
  });
}
async function listGoogleChatReactions(params) {
  const { account, messageName, limit } = params;
  const url = new URL(`${CHAT_API_BASE}/${messageName}/reactions`);
  if (limit && limit > 0) {
    url.searchParams.set('pageSize', String(limit));
  }
  const result = await fetchJson(account, url.toString(), {
    method: 'GET'
  });
  return result.reactions ?? [];
}
async function deleteGoogleChatReaction(params) {
  const { account, reactionName } = params;
  const url = `${CHAT_API_BASE}/${reactionName}`;
  await fetchOk(account, url, { method: 'DELETE' });
}
async function findGoogleChatDirectMessage(params) {
  const { account, userName } = params;
  const url = new URL(`${CHAT_API_BASE}/spaces:findDirectMessage`);
  url.searchParams.set('name', userName);
  return await fetchJson(account, url.toString(), {
    method: 'GET'
  });
}
async function probeGoogleChat(account) {
  try {
    const url = new URL(`${CHAT_API_BASE}/spaces`);
    url.searchParams.set('pageSize', '1');
    await fetchJson(account, url.toString(), {
      method: 'GET'
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
export {
  createGoogleChatReaction,
  deleteGoogleChatMessage,
  deleteGoogleChatReaction,
  downloadGoogleChatMedia,
  findGoogleChatDirectMessage,
  listGoogleChatReactions,
  probeGoogleChat,
  sendGoogleChatMessage,
  updateGoogleChatMessage,
  uploadGoogleChatAttachment
};
