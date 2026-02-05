import { formatAriaSnapshot } from './cdp.js';
import {
  buildRoleSnapshotFromAiSnapshot,
  buildRoleSnapshotFromAriaSnapshot,
  getRoleSnapshotStats
} from './pw-role-snapshot.js';
import {
  ensurePageState,
  getPageForTargetId,
  storeRoleRefsForTarget
} from './pw-session.js';
async function snapshotAriaViaPlaywright(opts) {
  const limit = Math.max(1, Math.min(2e3, Math.floor(opts.limit ?? 500)));
  const page = await getPageForTargetId({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId
  });
  ensurePageState(page);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Accessibility.enable').catch(() => {
    });
    const res = await session.send('Accessibility.getFullAXTree');
    const nodes = Array.isArray(res?.nodes) ? res.nodes : [];
    return { nodes: formatAriaSnapshot(nodes, limit) };
  } finally {
    await session.detach().catch(() => {
    });
  }
}
async function snapshotAiViaPlaywright(opts) {
  const page = await getPageForTargetId({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId
  });
  ensurePageState(page);
  const maybe = page;
  if (!maybe._snapshotForAI) {
    throw new Error('Playwright _snapshotForAI is not available. Upgrade playwright-core.');
  }
  const result = await maybe._snapshotForAI({
    timeout: Math.max(500, Math.min(6e4, Math.floor(opts.timeoutMs ?? 5e3))),
    track: 'response'
  });
  let snapshot = String(result?.full ?? '');
  const maxChars = opts.maxChars;
  const limit = typeof maxChars === 'number' && Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : void 0;
  let truncated = false;
  if (limit && snapshot.length > limit) {
    snapshot = `${snapshot.slice(0, limit)}

[...TRUNCATED - page too large]`;
    truncated = true;
  }
  const built = buildRoleSnapshotFromAiSnapshot(snapshot);
  storeRoleRefsForTarget({
    page,
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
    refs: built.refs,
    mode: 'aria'
  });
  return truncated ? { snapshot, truncated, refs: built.refs } : { snapshot, refs: built.refs };
}
async function snapshotRoleViaPlaywright(opts) {
  const page = await getPageForTargetId({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId
  });
  ensurePageState(page);
  if (opts.refsMode === 'aria') {
    if (opts.selector?.trim() || opts.frameSelector?.trim()) {
      throw new Error('refs=aria does not support selector/frame snapshots yet.');
    }
    const maybe = page;
    if (!maybe._snapshotForAI) {
      throw new Error('refs=aria requires Playwright _snapshotForAI support.');
    }
    const result = await maybe._snapshotForAI({
      timeout: 5e3,
      track: 'response'
    });
    const built2 = buildRoleSnapshotFromAiSnapshot(String(result?.full ?? ''), opts.options);
    storeRoleRefsForTarget({
      page,
      cdpUrl: opts.cdpUrl,
      targetId: opts.targetId,
      refs: built2.refs,
      mode: 'aria'
    });
    return {
      snapshot: built2.snapshot,
      refs: built2.refs,
      stats: getRoleSnapshotStats(built2.snapshot, built2.refs)
    };
  }
  const frameSelector = opts.frameSelector?.trim() || '';
  const selector = opts.selector?.trim() || '';
  const locator = frameSelector ? selector ? page.frameLocator(frameSelector).locator(selector) : page.frameLocator(frameSelector).locator(':root') : selector ? page.locator(selector) : page.locator(':root');
  const ariaSnapshot = await locator.ariaSnapshot();
  const built = buildRoleSnapshotFromAriaSnapshot(String(ariaSnapshot ?? ''), opts.options);
  storeRoleRefsForTarget({
    page,
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
    refs: built.refs,
    frameSelector: frameSelector || void 0,
    mode: 'role'
  });
  return {
    snapshot: built.snapshot,
    refs: built.refs,
    stats: getRoleSnapshotStats(built.snapshot, built.refs)
  };
}
async function navigateViaPlaywright(opts) {
  const url = String(opts.url ?? '').trim();
  if (!url) {
    throw new Error('url is required');
  }
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.goto(url, {
    timeout: Math.max(1e3, Math.min(12e4, opts.timeoutMs ?? 2e4))
  });
  return { url: page.url() };
}
async function resizeViewportViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.setViewportSize({
    width: Math.max(1, Math.floor(opts.width)),
    height: Math.max(1, Math.floor(opts.height))
  });
}
async function closePageViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.close();
}
async function pdfViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const buffer = await page.pdf({ printBackground: true });
  return { buffer };
}
export {
  closePageViaPlaywright,
  navigateViaPlaywright,
  pdfViaPlaywright,
  resizeViewportViaPlaywright,
  snapshotAiViaPlaywright,
  snapshotAriaViaPlaywright,
  snapshotRoleViaPlaywright
};
