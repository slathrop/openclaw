const STORAGE_KEY = 'openclaw.device.auth.v1';
function normalizeRole(role) {
  return role.trim();
}
function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) {
    return [];
  }
  const out = /* @__PURE__ */ new Set();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed) {
      out.add(trimmed);
    }
  }
  return [...out].toSorted();
}
function readStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) {
      return null;
    }
    if (!parsed.deviceId || typeof parsed.deviceId !== 'string') {
      return null;
    }
    if (!parsed.tokens || typeof parsed.tokens !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function writeStore(store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
  }
}
function loadDeviceAuthToken(params) {
  const store = readStore();
  if (!store || store.deviceId !== params.deviceId) {
    return null;
  }
  const role = normalizeRole(params.role);
  const entry = store.tokens[role];
  if (!entry || typeof entry.token !== 'string') {
    return null;
  }
  return entry;
}
function storeDeviceAuthToken(params) {
  const role = normalizeRole(params.role);
  const next = {
    version: 1,
    deviceId: params.deviceId,
    tokens: {}
  };
  const existing = readStore();
  if (existing && existing.deviceId === params.deviceId) {
    next.tokens = { ...existing.tokens };
  }
  const entry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now()
  };
  next.tokens[role] = entry;
  writeStore(next);
  return entry;
}
function clearDeviceAuthToken(params) {
  const store = readStore();
  if (!store || store.deviceId !== params.deviceId) {
    return;
  }
  const role = normalizeRole(params.role);
  if (!store.tokens[role]) {
    return;
  }
  const next = { ...store, tokens: { ...store.tokens } };
  delete next.tokens[role];
  writeStore(next);
}
export {
  clearDeviceAuthToken,
  loadDeviceAuthToken,
  storeDeviceAuthToken
};
