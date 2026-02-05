import path from 'node:path';
import { ensureMediaDir, saveMediaBuffer } from '../../media/store.js';
import { captureScreenshot, snapshotAria } from '../cdp.js';
import {
  DEFAULT_AI_SNAPSHOT_EFFICIENT_DEPTH,
  DEFAULT_AI_SNAPSHOT_EFFICIENT_MAX_CHARS,
  DEFAULT_AI_SNAPSHOT_MAX_CHARS
} from '../constants.js';
import {
  DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES,
  DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE,
  normalizeBrowserScreenshot
} from '../screenshot.js';
import {
  getPwAiModule,
  handleRouteError,
  readBody,
  requirePwAi,
  resolveProfileContext
} from './agent.shared.js';
import { jsonError, toBoolean, toNumber, toStringOrEmpty } from './utils.js';
function registerBrowserAgentSnapshotRoutes(app, ctx) {
  app.post('/navigate', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const url = toStringOrEmpty(body.url);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    if (!url) {
      return jsonError(res, 400, 'url is required');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'navigate');
      if (!pw) {
        return;
      }
      const result = await pw.navigateViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        url
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/pdf', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, 'pdf');
      if (!pw) {
        return;
      }
      const pdf = await pw.pdfViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId
      });
      await ensureMediaDir();
      const saved = await saveMediaBuffer(
        pdf.buffer,
        'application/pdf',
        'browser',
        pdf.buffer.byteLength
      );
      res.json({
        ok: true,
        path: path.resolve(saved.path),
        targetId: tab.targetId,
        url: tab.url
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.post('/screenshot', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || void 0;
    const fullPage = toBoolean(body.fullPage) ?? false;
    const ref = toStringOrEmpty(body.ref) || void 0;
    const element = toStringOrEmpty(body.element) || void 0;
    const type = body.type === 'jpeg' ? 'jpeg' : 'png';
    if (fullPage && (ref || element)) {
      return jsonError(res, 400, 'fullPage is not supported for element screenshots');
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      let buffer;
      const shouldUsePlaywright = profileCtx.profile.driver === 'extension' || !tab.wsUrl || Boolean(ref) || Boolean(element);
      if (shouldUsePlaywright) {
        const pw = await requirePwAi(res, 'screenshot');
        if (!pw) {
          return;
        }
        const snap = await pw.takeScreenshotViaPlaywright({
          cdpUrl: profileCtx.profile.cdpUrl,
          targetId: tab.targetId,
          ref,
          element,
          fullPage,
          type
        });
        buffer = snap.buffer;
      } else {
        buffer = await captureScreenshot({
          wsUrl: tab.wsUrl ?? '',
          fullPage,
          format: type,
          quality: type === 'jpeg' ? 85 : void 0
        });
      }
      const normalized = await normalizeBrowserScreenshot(buffer, {
        maxSide: DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE,
        maxBytes: DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES
      });
      await ensureMediaDir();
      const saved = await saveMediaBuffer(
        normalized.buffer,
        normalized.contentType ?? `image/${type}`,
        'browser',
        DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES
      );
      res.json({
        ok: true,
        path: path.resolve(saved.path),
        targetId: tab.targetId,
        url: tab.url
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
  app.get('/snapshot', async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const targetId = typeof req.query.targetId === 'string' ? req.query.targetId.trim() : '';
    const mode = req.query.mode === 'efficient' ? 'efficient' : void 0;
    const labels = toBoolean(req.query.labels) ?? void 0;
    const explicitFormat = req.query.format === 'aria' ? 'aria' : req.query.format === 'ai' ? 'ai' : void 0;
    const format = explicitFormat ?? (mode ? 'ai' : await getPwAiModule() ? 'ai' : 'aria');
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : void 0;
    const hasMaxChars = Object.hasOwn(req.query, 'maxChars');
    const maxCharsRaw = typeof req.query.maxChars === 'string' ? Number(req.query.maxChars) : void 0;
    const limit = Number.isFinite(limitRaw) ? limitRaw : void 0;
    const maxChars = typeof maxCharsRaw === 'number' && Number.isFinite(maxCharsRaw) && maxCharsRaw > 0 ? Math.floor(maxCharsRaw) : void 0;
    const resolvedMaxChars = format === 'ai' ? hasMaxChars ? maxChars : mode === 'efficient' ? DEFAULT_AI_SNAPSHOT_EFFICIENT_MAX_CHARS : DEFAULT_AI_SNAPSHOT_MAX_CHARS : void 0;
    const interactiveRaw = toBoolean(req.query.interactive);
    const compactRaw = toBoolean(req.query.compact);
    const depthRaw = toNumber(req.query.depth);
    const refsModeRaw = toStringOrEmpty(req.query.refs).trim();
    const refsMode = refsModeRaw === 'aria' ? 'aria' : refsModeRaw === 'role' ? 'role' : void 0;
    const interactive = interactiveRaw ?? (mode === 'efficient' ? true : void 0);
    const compact = compactRaw ?? (mode === 'efficient' ? true : void 0);
    const depth = depthRaw ?? (mode === 'efficient' ? DEFAULT_AI_SNAPSHOT_EFFICIENT_DEPTH : void 0);
    const selector = toStringOrEmpty(req.query.selector);
    const frameSelector = toStringOrEmpty(req.query.frame);
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId || void 0);
      if ((labels || mode === 'efficient') && format === 'aria') {
        return jsonError(res, 400, 'labels/mode=efficient require format=ai');
      }
      if (format === 'ai') {
        const pw = await requirePwAi(res, 'ai snapshot');
        if (!pw) {
          return;
        }
        const wantsRoleSnapshot = labels === true || mode === 'efficient' || interactive === true || compact === true || depth !== void 0 || Boolean(selector.trim()) || Boolean(frameSelector.trim());
        const snap2 = wantsRoleSnapshot ? await pw.snapshotRoleViaPlaywright({
          cdpUrl: profileCtx.profile.cdpUrl,
          targetId: tab.targetId,
          selector: selector.trim() || void 0,
          frameSelector: frameSelector.trim() || void 0,
          refsMode,
          options: {
            interactive: interactive ?? void 0,
            compact: compact ?? void 0,
            maxDepth: depth ?? void 0
          }
        }) : await pw.snapshotAiViaPlaywright({
          cdpUrl: profileCtx.profile.cdpUrl,
          targetId: tab.targetId,
          ...typeof resolvedMaxChars === 'number' ? { maxChars: resolvedMaxChars } : {}
        }).catch(async (err) => {
          if (String(err).toLowerCase().includes('_snapshotforai')) {
            return await pw.snapshotRoleViaPlaywright({
              cdpUrl: profileCtx.profile.cdpUrl,
              targetId: tab.targetId,
              selector: selector.trim() || void 0,
              frameSelector: frameSelector.trim() || void 0,
              refsMode,
              options: {
                interactive: interactive ?? void 0,
                compact: compact ?? void 0,
                maxDepth: depth ?? void 0
              }
            });
          }
          throw err;
        });
        if (labels) {
          const labeled = await pw.screenshotWithLabelsViaPlaywright({
            cdpUrl: profileCtx.profile.cdpUrl,
            targetId: tab.targetId,
            refs: 'refs' in snap2 ? snap2.refs : {},
            type: 'png'
          });
          const normalized = await normalizeBrowserScreenshot(labeled.buffer, {
            maxSide: DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE,
            maxBytes: DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES
          });
          await ensureMediaDir();
          const saved = await saveMediaBuffer(
            normalized.buffer,
            normalized.contentType ?? 'image/png',
            'browser',
            DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES
          );
          const imageType = normalized.contentType?.includes('jpeg') ? 'jpeg' : 'png';
          return res.json({
            ok: true,
            format,
            targetId: tab.targetId,
            url: tab.url,
            labels: true,
            labelsCount: labeled.labels,
            labelsSkipped: labeled.skipped,
            imagePath: path.resolve(saved.path),
            imageType,
            ...snap2
          });
        }
        return res.json({
          ok: true,
          format,
          targetId: tab.targetId,
          url: tab.url,
          ...snap2
        });
      }
      const snap = profileCtx.profile.driver === 'extension' || !tab.wsUrl ? (() => {
        return requirePwAi(res, 'aria snapshot').then(async (pw) => {
          if (!pw) {
            return null;
          }
          return await pw.snapshotAriaViaPlaywright({
            cdpUrl: profileCtx.profile.cdpUrl,
            targetId: tab.targetId,
            limit
          });
        });
      })() : snapshotAria({ wsUrl: tab.wsUrl ?? '', limit });
      const resolved = await Promise.resolve(snap);
      if (!resolved) {
        return;
      }
      return res.json({
        ok: true,
        format,
        targetId: tab.targetId,
        url: tab.url,
        ...resolved
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
}
export {
  registerBrowserAgentSnapshotRoutes
};
