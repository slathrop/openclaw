import { handleRouteError, readBody, requirePwAi, resolveProfileContext } from './agent.shared.js';
import { jsonError, toBoolean, toNumber, toStringOrEmpty } from './utils.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

function registerBrowserAgentStorageRoutes(app, ctx) {
  app.get('/cookies', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const targetId = typeof req.query.targetId === 'string' ? req.query.targetId.trim() : '';
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId || void 0);
      const pw = await requirePwAi(res, 'cookies');
      if (!pw) {
        return;
      }
      const result = await pw.cookiesGetViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/cookies/set', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const cookie = body.cookie && typeof body.cookie === 'object' && !Array.isArray(body.cookie) ? body.cookie : null;
    if (!cookie) {
      return jsonError(res, 400, 'cookie is required');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'cookies set');
      if (!pw) {
        return;
      }
      await pw.cookiesSetViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        cookie: {
          name: toStringOrEmpty(cookie.name),
          value: toStringOrEmpty(cookie.value),
          url: toStringOrEmpty(cookie.url) || void 0,
          domain: toStringOrEmpty(cookie.domain) || void 0,
          path: toStringOrEmpty(cookie.path) || void 0,
          expires: toNumber(cookie.expires) ?? void 0,
          httpOnly: toBoolean(cookie.httpOnly) ?? void 0,
          secure: toBoolean(cookie.secure) ?? void 0,
          sameSite: cookie.sameSite === 'Lax' || cookie.sameSite === 'None' || cookie.sameSite === 'Strict' ? cookie.sameSite : void 0
        }
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/cookies/clear', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'cookies clear');
      if (!pw) {
        return;
      }
      await pw.cookiesClearViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.get('/storage/:kind', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const kind = toStringOrEmpty(req.params.kind);
    if (kind !== 'local' && kind !== 'session') {
      return jsonError(res, 400, 'kind must be local|session');
    }
    const targetId = typeof req.query.targetId === 'string' ? req.query.targetId.trim() : '';
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId || void 0);
      const pw = await requirePwAi(res, 'storage get');
      if (!pw) {
        return;
      }
      const result = await pw.storageGetViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        kind,
        key: key.trim() || void 0
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/storage/:kind/set', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const kind = toStringOrEmpty(req.params.kind);
    if (kind !== 'local' && kind !== 'session') {
      return jsonError(res, 400, 'kind must be local|session');
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const key = toStringOrEmpty(body.key);
    if (!key) {
      return jsonError(res, 400, 'key is required');
    }
    const value = typeof body.value === 'string' ? body.value : '';
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'storage set');
      if (!pw) {
        return;
      }
      await pw.storageSetViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        kind,
        key,
        value
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/storage/:kind/clear', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const kind = toStringOrEmpty(req.params.kind);
    if (kind !== 'local' && kind !== 'session') {
      return jsonError(res, 400, 'kind must be local|session');
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'storage clear');
      if (!pw) {
        return;
      }
      await pw.storageClearViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        kind
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/offline', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const offline = toBoolean(body.offline);
    if (offline === void 0) {
      return jsonError(res, 400, 'offline is required');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'offline');
      if (!pw) {
        return;
      }
      await pw.setOfflineViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        offline
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/headers', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const headers = body.headers && typeof body.headers === 'object' && !Array.isArray(body.headers) ? body.headers : null;
    if (!headers) {
      return jsonError(res, 400, 'headers is required');
    }
    const parsed = {};
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string') {
        parsed[k] = v;
      }
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'headers');
      if (!pw) {
        return;
      }
      await pw.setExtraHTTPHeadersViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        headers: parsed
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/credentials', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const clear = toBoolean(body.clear) ?? false;
    const username = toStringOrEmpty(body.username) || void 0;
    const password = typeof body.password === 'string' ? body.password : void 0;
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'http credentials');
      if (!pw) {
        return;
      }
      await pw.setHttpCredentialsViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        username,
        password,
        clear
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/geolocation', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const clear = toBoolean(body.clear) ?? false;
    const latitude = toNumber(body.latitude);
    const longitude = toNumber(body.longitude);
    const accuracy = toNumber(body.accuracy) ?? void 0;
    const origin = toStringOrEmpty(body.origin) || void 0;
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'geolocation');
      if (!pw) {
        return;
      }
      await pw.setGeolocationViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        latitude,
        longitude,
        accuracy,
        origin,
        clear
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/media', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const schemeRaw = toStringOrEmpty(body.colorScheme);
    const colorScheme = schemeRaw === 'dark' || schemeRaw === 'light' || schemeRaw === 'no-preference' ? schemeRaw : schemeRaw === 'none' ? null : void 0;
    if (colorScheme === void 0) {
      return jsonError(res, 400, 'colorScheme must be dark|light|no-preference|none');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'media emulation');
      if (!pw) {
        return;
      }
      await pw.emulateMediaViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        colorScheme
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/timezone', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const timezoneId = toStringOrEmpty(body.timezoneId);
    if (!timezoneId) {
      return jsonError(res, 400, 'timezoneId is required');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'timezone');
      if (!pw) {
        return;
      }
      await pw.setTimezoneViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        timezoneId
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/locale', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const locale = toStringOrEmpty(body.locale);
    if (!locale) {
      return jsonError(res, 400, 'locale is required');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'locale');
      if (!pw) {
        return;
      }
      await pw.setLocaleViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        locale
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/set/device', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const name = toStringOrEmpty(body.name);
    if (!name) {
      return jsonError(res, 400, 'name is required');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'device emulation');
      if (!pw) {
        return;
      }
      await pw.setDeviceViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        name
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
}
export {
  registerBrowserAgentStorageRoutes
};
