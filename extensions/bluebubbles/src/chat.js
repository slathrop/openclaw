import crypto from 'node:crypto';
import { resolveBlueBubblesAccount } from './accounts.js';
import { blueBubblesFetchWithTimeout, buildBlueBubblesApiUrl } from './types.js';
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
async function markBlueBubblesChatRead(chatGuid, opts = {}) {
  const trimmed = chatGuid.trim();
  if (!trimmed) {
    return;
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmed)}/read`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(url, { method: 'POST' }, opts.timeoutMs);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles read failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
async function sendBlueBubblesTyping(chatGuid, typing, opts = {}) {
  const trimmed = chatGuid.trim();
  if (!trimmed) {
    return;
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmed)}/typing`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(
    url,
    { method: typing ? 'POST' : 'DELETE' },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles typing failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
async function editBlueBubblesMessage(messageGuid, newText, opts = {}) {
  const trimmedGuid = messageGuid.trim();
  if (!trimmedGuid) {
    throw new Error('BlueBubbles edit requires messageGuid');
  }
  const trimmedText = newText.trim();
  if (!trimmedText) {
    throw new Error('BlueBubbles edit requires newText');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/message/${encodeURIComponent(trimmedGuid)}/edit`,
    password
  });
  const payload = {
    editedMessage: trimmedText,
    backwardsCompatibilityMessage: opts.backwardsCompatMessage ?? `Edited to: ${trimmedText}`,
    partIndex: typeof opts.partIndex === 'number' ? opts.partIndex : 0
  };
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles edit failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
async function unsendBlueBubblesMessage(messageGuid, opts = {}) {
  const trimmedGuid = messageGuid.trim();
  if (!trimmedGuid) {
    throw new Error('BlueBubbles unsend requires messageGuid');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/message/${encodeURIComponent(trimmedGuid)}/unsend`,
    password
  });
  const payload = {
    partIndex: typeof opts.partIndex === 'number' ? opts.partIndex : 0
  };
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles unsend failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
async function renameBlueBubblesChat(chatGuid, displayName, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error('BlueBubbles rename requires chatGuid');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName })
    },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles rename failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
async function addBlueBubblesParticipant(chatGuid, address, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error('BlueBubbles addParticipant requires chatGuid');
  }
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new Error('BlueBubbles addParticipant requires address');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/participant`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: trimmedAddress })
    },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles addParticipant failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
async function removeBlueBubblesParticipant(chatGuid, address, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error('BlueBubbles removeParticipant requires chatGuid');
  }
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new Error('BlueBubbles removeParticipant requires address');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/participant`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: trimmedAddress })
    },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `BlueBubbles removeParticipant failed (${res.status}): ${errorText || 'unknown'}`
    );
  }
}
async function leaveBlueBubblesChat(chatGuid, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error('BlueBubbles leaveChat requires chatGuid');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/leave`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(url, { method: 'POST' }, opts.timeoutMs);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles leaveChat failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
async function setGroupIconBlueBubbles(chatGuid, buffer, filename, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error('BlueBubbles setGroupIcon requires chatGuid');
  }
  if (!buffer || buffer.length === 0) {
    throw new Error('BlueBubbles setGroupIcon requires image buffer');
  }
  const { baseUrl, password } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/icon`,
    password
  });
  const boundary = `----BlueBubblesFormBoundary${crypto.randomUUID().replace(/-/g, '')}`;
  const parts = [];
  const encoder = new TextEncoder();
  parts.push(encoder.encode(`--${boundary}\r
`));
  parts.push(
    encoder.encode(`Content-Disposition: form-data; name="icon"; filename="${filename}"\r
`)
  );
  parts.push(
    encoder.encode(`Content-Type: ${opts.contentType ?? 'application/octet-stream'}\r
\r
`)
  );
  parts.push(buffer);
  parts.push(encoder.encode('\r\n'));
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
    const errorText = await res.text().catch(() => '');
    throw new Error(`BlueBubbles setGroupIcon failed (${res.status}): ${errorText || 'unknown'}`);
  }
}
export {
  addBlueBubblesParticipant,
  editBlueBubblesMessage,
  leaveBlueBubblesChat,
  markBlueBubblesChatRead,
  removeBlueBubblesParticipant,
  renameBlueBubblesChat,
  sendBlueBubblesTyping,
  setGroupIconBlueBubbles,
  unsendBlueBubblesMessage
};
