import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ensurePageState,
  getPageForTargetId,
  refLocator,
  restoreRoleRefsForTarget
} from './pw-session.js';
import {
  bumpDialogArmId,
  bumpDownloadArmId,
  bumpUploadArmId,
  normalizeTimeoutMs,
  requireRef,
  toAIFriendlyError
} from './pw-tools-core.shared.js';
function buildTempDownloadPath(fileName) {
  const id = crypto.randomUUID();
  const safeName = fileName.trim() ? fileName.trim() : 'download.bin';
  return path.join('/tmp/openclaw/downloads', `${id}-${safeName}`);
}
function createPageDownloadWaiter(page, timeoutMs) {
  let done = false;
  let timer;
  let handler;
  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = void 0;
    if (handler) {
      page.off('download', handler);
      handler = void 0;
    }
  };
  const promise = new Promise((resolve, reject) => {
    handler = (download) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve(download);
    };
    page.on('download', handler);
    timer = setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(new Error('Timeout waiting for download'));
    }, timeoutMs);
  });
  return {
    promise,
    cancel: () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
    }
  };
}
async function armFileUploadViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  const timeout = Math.max(500, Math.min(12e4, opts.timeoutMs ?? 12e4));
  state.armIdUpload = bumpUploadArmId();
  const armId = state.armIdUpload;
  void page.waitForEvent('filechooser', { timeout }).then(async (fileChooser) => {
    if (state.armIdUpload !== armId) {
      return;
    }
    if (!opts.paths?.length) {
      try {
        await page.keyboard.press('Escape');
      } catch {
        // Intentionally ignored
      }
      return;
    }
    await fileChooser.setFiles(opts.paths);
    try {
      const input = typeof fileChooser.element === 'function' ? await Promise.resolve(fileChooser.element()) : null;
      if (input) {
        await input.evaluate((el) => {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    } catch {
      // Intentionally ignored
    }
  }).catch(() => {
  });
}
async function armDialogViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  const timeout = normalizeTimeoutMs(opts.timeoutMs, 12e4);
  state.armIdDialog = bumpDialogArmId();
  const armId = state.armIdDialog;
  void page.waitForEvent('dialog', { timeout }).then(async (dialog) => {
    if (state.armIdDialog !== armId) {
      return;
    }
    if (opts.accept) {
      await dialog.accept(opts.promptText);
    } else {
      await dialog.dismiss();
    }
  }).catch(() => {
  });
}
async function waitForDownloadViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  const timeout = normalizeTimeoutMs(opts.timeoutMs, 12e4);
  state.armIdDownload = bumpDownloadArmId();
  const armId = state.armIdDownload;
  const waiter = createPageDownloadWaiter(page, timeout);
  try {
    const download = await waiter.promise;
    if (state.armIdDownload !== armId) {
      throw new Error('Download was superseded by another waiter');
    }
    const suggested = download.suggestedFilename?.() || 'download.bin';
    const outPath = opts.path?.trim() || buildTempDownloadPath(suggested);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await download.saveAs?.(outPath);
    return {
      url: download.url?.() || '',
      suggestedFilename: suggested,
      path: path.resolve(outPath)
    };
  } catch (err) {
    waiter.cancel();
    throw err;
  }
}
async function downloadViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const timeout = normalizeTimeoutMs(opts.timeoutMs, 12e4);
  const ref = requireRef(opts.ref);
  const outPath = String(opts.path ?? '').trim();
  if (!outPath) {
    throw new Error('path is required');
  }
  state.armIdDownload = bumpDownloadArmId();
  const armId = state.armIdDownload;
  const waiter = createPageDownloadWaiter(page, timeout);
  try {
    const locator = refLocator(page, ref);
    try {
      await locator.click({ timeout });
    } catch (err) {
      throw toAIFriendlyError(err, ref);
    }
    const download = await waiter.promise;
    if (state.armIdDownload !== armId) {
      throw new Error('Download was superseded by another waiter');
    }
    const suggested = download.suggestedFilename?.() || 'download.bin';
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await download.saveAs?.(outPath);
    return {
      url: download.url?.() || '',
      suggestedFilename: suggested,
      path: path.resolve(outPath)
    };
  } catch (err) {
    waiter.cancel();
    throw err;
  }
}
export {
  armDialogViaPlaywright,
  armFileUploadViaPlaywright,
  downloadViaPlaywright,
  waitForDownloadViaPlaywright
};
