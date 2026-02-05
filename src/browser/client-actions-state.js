import { fetchBrowserJson } from './client-fetch.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

function buildProfileQuery(profile) {
  return profile ? `?profile=${encodeURIComponent(profile)}` : '';
}
function withBaseUrl(baseUrl, path) {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return path;
  }
  return `${trimmed.replace(/\/$/, '')}${path}`;
}
async function browserCookies(baseUrl, opts = {}) {
  const q = new URLSearchParams();
  if (opts.targetId) {
    q.set('targetId', opts.targetId);
  }
  if (opts.profile) {
    q.set('profile', opts.profile);
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/cookies${suffix}`), { timeoutMs: 2e4 });
}
async function browserCookiesSet(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/cookies/set${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: opts.targetId, cookie: opts.cookie }),
    timeoutMs: 2e4
  });
}
async function browserCookiesClear(baseUrl, opts = {}) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/cookies/clear${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: opts.targetId }),
    timeoutMs: 2e4
  });
}
async function browserStorageGet(baseUrl, opts) {
  const q = new URLSearchParams();
  if (opts.targetId) {
    q.set('targetId', opts.targetId);
  }
  if (opts.key) {
    q.set('key', opts.key);
  }
  if (opts.profile) {
    q.set('profile', opts.profile);
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/storage/${opts.kind}${suffix}`), { timeoutMs: 2e4 });
}
async function browserStorageSet(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(
    withBaseUrl(baseUrl, `/storage/${opts.kind}/set${q}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: opts.targetId,
        key: opts.key,
        value: opts.value
      }),
      timeoutMs: 2e4
    }
  );
}
async function browserStorageClear(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(
    withBaseUrl(baseUrl, `/storage/${opts.kind}/clear${q}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: opts.targetId }),
      timeoutMs: 2e4
    }
  );
}
async function browserSetOffline(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/set/offline${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: opts.targetId, offline: opts.offline }),
    timeoutMs: 2e4
  });
}
async function browserSetHeaders(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/set/headers${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: opts.targetId, headers: opts.headers }),
    timeoutMs: 2e4
  });
}
async function browserSetHttpCredentials(baseUrl, opts = {}) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(
    withBaseUrl(baseUrl, `/set/credentials${q}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: opts.targetId,
        username: opts.username,
        password: opts.password,
        clear: opts.clear
      }),
      timeoutMs: 2e4
    }
  );
}
async function browserSetGeolocation(baseUrl, opts = {}) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(
    withBaseUrl(baseUrl, `/set/geolocation${q}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: opts.targetId,
        latitude: opts.latitude,
        longitude: opts.longitude,
        accuracy: opts.accuracy,
        origin: opts.origin,
        clear: opts.clear
      }),
      timeoutMs: 2e4
    }
  );
}
async function browserSetMedia(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/set/media${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetId: opts.targetId,
      colorScheme: opts.colorScheme
    }),
    timeoutMs: 2e4
  });
}
async function browserSetTimezone(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/set/timezone${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetId: opts.targetId,
      timezoneId: opts.timezoneId
    }),
    timeoutMs: 2e4
  });
}
async function browserSetLocale(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/set/locale${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: opts.targetId, locale: opts.locale }),
    timeoutMs: 2e4
  });
}
async function browserSetDevice(baseUrl, opts) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/set/device${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: opts.targetId, name: opts.name }),
    timeoutMs: 2e4
  });
}
async function browserClearPermissions(baseUrl, opts = {}) {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson(withBaseUrl(baseUrl, `/set/geolocation${q}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: opts.targetId, clear: true }),
    timeoutMs: 2e4
  });
}
export {
  browserClearPermissions,
  browserCookies,
  browserCookiesClear,
  browserCookiesSet,
  browserSetDevice,
  browserSetGeolocation,
  browserSetHeaders,
  browserSetHttpCredentials,
  browserSetLocale,
  browserSetMedia,
  browserSetOffline,
  browserSetTimezone,
  browserStorageClear,
  browserStorageGet,
  browserStorageSet
};
