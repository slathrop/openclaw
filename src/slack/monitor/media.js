import { fetchRemoteMedia } from '../../media/fetch.js';
import { saveMediaBuffer } from '../../media/store.js';
function normalizeHostname(hostname) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1);
  }
  return normalized;
}
function isSlackHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return false;
  }
  const allowedSuffixes = ['slack.com', 'slack-edge.com', 'slack-files.com'];
  return allowedSuffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`)
  );
}
function assertSlackFileUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Slack file URL: ${rawUrl}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Refusing Slack file URL with non-HTTPS protocol: ${parsed.protocol}`);
  }
  if (!isSlackHostname(parsed.hostname)) {
    throw new Error(
      `Refusing to send Slack token to non-Slack host "${parsed.hostname}" (url: ${rawUrl})`
    );
  }
  return parsed;
}
function resolveRequestUrl(input) {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if ('url' in input && typeof input.url === 'string') {
    return input.url;
  }
  throw new Error('Unsupported fetch input: expected string, URL, or Request');
}
function createSlackMediaFetch(token) {
  let includeAuth = true;
  return async (input, init) => {
    const url = resolveRequestUrl(input);
    // eslint-disable-next-line no-unused-vars
    const { headers: initHeaders, redirect: _redirect, ...rest } = init ?? {};
    const headers = new Headers(initHeaders);
    if (includeAuth) {
      includeAuth = false;
      const parsed = assertSlackFileUrl(url);
      headers.set('Authorization', `Bearer ${token}`);
      return fetch(parsed.href, { ...rest, headers, redirect: 'manual' });
    }
    headers.delete('Authorization');
    return fetch(url, { ...rest, headers, redirect: 'manual' });
  };
}
async function fetchWithSlackAuth(url, token) {
  const parsed = assertSlackFileUrl(url);
  const initialRes = await fetch(parsed.href, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'manual'
  });
  if (initialRes.status < 300 || initialRes.status >= 400) {
    return initialRes;
  }
  const redirectUrl = initialRes.headers.get('location');
  if (!redirectUrl) {
    return initialRes;
  }
  const resolvedUrl = new URL(redirectUrl, parsed.href);
  if (resolvedUrl.protocol !== 'https:') {
    return initialRes;
  }
  return fetch(resolvedUrl.toString(), { redirect: 'follow' });
}
async function resolveSlackMedia(params) {
  const files = params.files ?? [];
  for (const file of files) {
    const url = file.url_private_download ?? file.url_private;
    if (!url) {
      continue;
    }
    try {
      const fetchImpl = createSlackMediaFetch(params.token);
      const fetched = await fetchRemoteMedia({
        url,
        fetchImpl,
        filePathHint: file.name,
        maxBytes: params.maxBytes
      });
      if (fetched.buffer.byteLength > params.maxBytes) {
        continue;
      }
      const saved = await saveMediaBuffer(
        fetched.buffer,
        fetched.contentType ?? file.mimetype,
        'inbound',
        params.maxBytes
      );
      const label = fetched.fileName ?? file.name;
      return {
        path: saved.path,
        contentType: saved.contentType,
        placeholder: label ? `[Slack file: ${label}]` : '[Slack file]'
      };
    } catch {
    // Intentionally ignored
    }
  }
  return null;
}
const THREAD_STARTER_CACHE = /* @__PURE__ */ new Map();
async function resolveSlackThreadStarter(params) {
  const cacheKey = `${params.channelId}:${params.threadTs}`;
  const cached = THREAD_STARTER_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const response = await params.client.conversations.replies({
      channel: params.channelId,
      ts: params.threadTs,
      limit: 1,
      inclusive: true
    });
    const message = response?.messages?.[0];
    const text = (message?.text ?? '').trim();
    if (!message || !text) {
      return null;
    }
    const starter = {
      text,
      userId: message.user,
      ts: message.ts,
      files: message.files
    };
    THREAD_STARTER_CACHE.set(cacheKey, starter);
    return starter;
  } catch {
    return null;
  }
}
export {
  fetchWithSlackAuth,
  resolveSlackMedia,
  resolveSlackThreadStarter
};
