import { chromium } from 'playwright-core';
import { formatErrorMessage } from '../infra/errors.js';
import { getHeadersWithAuth } from './cdp.helpers.js';
import { getChromeWebSocketUrl } from './chrome.js';
const pageStates = /* @__PURE__ */ new WeakMap();
const contextStates = /* @__PURE__ */ new WeakMap();
const observedContexts = /* @__PURE__ */ new WeakSet();
const observedPages = /* @__PURE__ */ new WeakSet();
const roleRefsByTarget = /* @__PURE__ */ new Map();
const MAX_ROLE_REFS_CACHE = 50;
const MAX_CONSOLE_MESSAGES = 500;
const MAX_PAGE_ERRORS = 200;
const MAX_NETWORK_REQUESTS = 500;
let cached = null;
let connecting = null;
function normalizeCdpUrl(raw) {
  return raw.replace(/\/$/, '');
}
function roleRefsKey(cdpUrl, targetId) {
  return `${normalizeCdpUrl(cdpUrl)}::${targetId}`;
}
function rememberRoleRefsForTarget(opts) {
  const targetId = opts.targetId.trim();
  if (!targetId) {
    return;
  }
  roleRefsByTarget.set(roleRefsKey(opts.cdpUrl, targetId), {
    refs: opts.refs,
    ...opts.frameSelector ? { frameSelector: opts.frameSelector } : {},
    ...opts.mode ? { mode: opts.mode } : {}
  });
  while (roleRefsByTarget.size > MAX_ROLE_REFS_CACHE) {
    const first = roleRefsByTarget.keys().next();
    if (first.done) {
      break;
    }
    roleRefsByTarget.delete(first.value);
  }
}
function storeRoleRefsForTarget(opts) {
  const state = ensurePageState(opts.page);
  state.roleRefs = opts.refs;
  state.roleRefsFrameSelector = opts.frameSelector;
  state.roleRefsMode = opts.mode;
  if (!opts.targetId?.trim()) {
    return;
  }
  rememberRoleRefsForTarget({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
    refs: opts.refs,
    frameSelector: opts.frameSelector,
    mode: opts.mode
  });
}
function restoreRoleRefsForTarget(opts) {
  const targetId = opts.targetId?.trim() || '';
  if (!targetId) {
    return;
  }
  const cached2 = roleRefsByTarget.get(roleRefsKey(opts.cdpUrl, targetId));
  if (!cached2) {
    return;
  }
  const state = ensurePageState(opts.page);
  if (state.roleRefs) {
    return;
  }
  state.roleRefs = cached2.refs;
  state.roleRefsFrameSelector = cached2.frameSelector;
  state.roleRefsMode = cached2.mode;
}
function ensurePageState(page) {
  const existing = pageStates.get(page);
  if (existing) {
    return existing;
  }
  const state = {
    console: [],
    errors: [],
    requests: [],
    requestIds: /* @__PURE__ */ new WeakMap(),
    nextRequestId: 0,
    armIdUpload: 0,
    armIdDialog: 0,
    armIdDownload: 0
  };
  pageStates.set(page, state);
  if (!observedPages.has(page)) {
    observedPages.add(page);
    page.on('console', (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        location: msg.location()
      };
      state.console.push(entry);
      if (state.console.length > MAX_CONSOLE_MESSAGES) {
        state.console.shift();
      }
    });
    page.on('pageerror', (err) => {
      state.errors.push({
        message: err?.message ? String(err.message) : String(err),
        name: err?.name ? String(err.name) : void 0,
        stack: err?.stack ? String(err.stack) : void 0,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (state.errors.length > MAX_PAGE_ERRORS) {
        state.errors.shift();
      }
    });
    page.on('request', (req) => {
      state.nextRequestId += 1;
      const id = `r${state.nextRequestId}`;
      state.requestIds.set(req, id);
      state.requests.push({
        id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType()
      });
      if (state.requests.length > MAX_NETWORK_REQUESTS) {
        state.requests.shift();
      }
    });
    page.on('response', (resp) => {
      const req = resp.request();
      const id = state.requestIds.get(req);
      if (!id) {
        return;
      }
      let rec;
      for (let i = state.requests.length - 1; i >= 0; i -= 1) {
        const candidate = state.requests[i];
        if (candidate && candidate.id === id) {
          rec = candidate;
          break;
        }
      }
      if (!rec) {
        return;
      }
      rec.status = resp.status();
      rec.ok = resp.ok();
    });
    page.on('requestfailed', (req) => {
      const id = state.requestIds.get(req);
      if (!id) {
        return;
      }
      let rec;
      for (let i = state.requests.length - 1; i >= 0; i -= 1) {
        const candidate = state.requests[i];
        if (candidate && candidate.id === id) {
          rec = candidate;
          break;
        }
      }
      if (!rec) {
        return;
      }
      rec.failureText = req.failure()?.errorText;
      rec.ok = false;
    });
    page.on('close', () => {
      pageStates.delete(page);
      observedPages.delete(page);
    });
  }
  return state;
}
function observeContext(context) {
  if (observedContexts.has(context)) {
    return;
  }
  observedContexts.add(context);
  ensureContextState(context);
  for (const page of context.pages()) {
    ensurePageState(page);
  }
  context.on('page', (page) => ensurePageState(page));
}
function ensureContextState(context) {
  const existing = contextStates.get(context);
  if (existing) {
    return existing;
  }
  const state = { traceActive: false };
  contextStates.set(context, state);
  return state;
}
function observeBrowser(browser) {
  for (const context of browser.contexts()) {
    observeContext(context);
  }
}
async function connectBrowser(cdpUrl) {
  const normalized = normalizeCdpUrl(cdpUrl);
  if (cached?.cdpUrl === normalized) {
    return cached;
  }
  if (connecting) {
    return await connecting;
  }
  const connectWithRetry = async () => {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const timeout = 5e3 + attempt * 2e3;
        const wsUrl = await getChromeWebSocketUrl(normalized, timeout).catch(() => null);
        const endpoint = wsUrl ?? normalized;
        const headers = getHeadersWithAuth(endpoint);
        const browser = await chromium.connectOverCDP(endpoint, { timeout, headers });
        const connected = { browser, cdpUrl: normalized };
        cached = connected;
        observeBrowser(browser);
        browser.on('disconnected', () => {
          if (cached?.browser === browser) {
            cached = null;
          }
        });
        return connected;
      } catch (err) {
        lastErr = err;
        const delay = 250 + attempt * 250;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    if (lastErr instanceof Error) {
      throw lastErr;
    }
    const message = lastErr ? formatErrorMessage(lastErr) : 'CDP connect failed';
    throw new Error(message);
  };
  connecting = connectWithRetry().finally(() => {
    connecting = null;
  });
  return await connecting;
}
async function getAllPages(browser) {
  const contexts = browser.contexts();
  const pages = contexts.flatMap((c) => c.pages());
  return pages;
}
async function pageTargetId(page) {
  const session = await page.context().newCDPSession(page);
  try {
    const info = await session.send('Target.getTargetInfo');
    const targetId = String(info?.targetInfo?.targetId ?? '').trim();
    return targetId || null;
  } finally {
    await session.detach().catch(() => {
    });
  }
}
async function findPageByTargetId(browser, targetId, cdpUrl) {
  const pages = await getAllPages(browser);
  for (const page of pages) {
    const tid = await pageTargetId(page).catch(() => null);
    if (tid && tid === targetId) {
      return page;
    }
  }
  if (cdpUrl) {
    try {
      const baseUrl = cdpUrl.replace(/\/+$/, '').replace(/^ws:/, 'http:').replace(/\/cdp$/, '');
      const listUrl = `${baseUrl}/json/list`;
      const response = await fetch(listUrl, { headers: getHeadersWithAuth(listUrl) });
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find((t) => t.id === targetId);
        if (target) {
          const urlMatch = pages.filter((p) => p.url() === target.url);
          if (urlMatch.length === 1) {
            return urlMatch[0];
          }
          if (urlMatch.length > 1) {
            const sameUrlTargets = targets.filter((t) => t.url === target.url);
            if (sameUrlTargets.length === urlMatch.length) {
              const idx = sameUrlTargets.findIndex((t) => t.id === targetId);
              if (idx >= 0 && idx < urlMatch.length) {
                return urlMatch[idx];
              }
            }
          }
        }
      }
    } catch {
      // Intentionally ignored
    }
  }
  return null;
}
async function getPageForTargetId(opts) {
  const { browser } = await connectBrowser(opts.cdpUrl);
  const pages = await getAllPages(browser);
  if (!pages.length) {
    throw new Error('No pages available in the connected browser.');
  }
  const first = pages[0];
  if (!opts.targetId) {
    return first;
  }
  const found = await findPageByTargetId(browser, opts.targetId, opts.cdpUrl);
  if (!found) {
    if (pages.length === 1) {
      return first;
    }
    throw new Error('tab not found');
  }
  return found;
}
function refLocator(page, ref) {
  const normalized = ref.startsWith('@') ? ref.slice(1) : ref.startsWith('ref=') ? ref.slice(4) : ref;
  if (/^e\d+$/.test(normalized)) {
    const state = pageStates.get(page);
    if (state?.roleRefsMode === 'aria') {
      const scope2 = state.roleRefsFrameSelector ? page.frameLocator(state.roleRefsFrameSelector) : page;
      return scope2.locator(`aria-ref=${normalized}`);
    }
    const info = state?.roleRefs?.[normalized];
    if (!info) {
      throw new Error(
        `Unknown ref "${normalized}". Run a new snapshot and use a ref from that snapshot.`
      );
    }
    const scope = state?.roleRefsFrameSelector ? page.frameLocator(state.roleRefsFrameSelector) : page;
    const locAny = scope;
    const locator = info.name ? locAny.getByRole(info.role, { name: info.name, exact: true }) : locAny.getByRole(info.role);
    return info.nth !== void 0 ? locator.nth(info.nth) : locator;
  }
  return page.locator(`aria-ref=${normalized}`);
}
async function closePlaywrightBrowserConnection() {
  const cur = cached;
  cached = null;
  if (!cur) {
    return;
  }
  await cur.browser.close().catch(() => {
  });
}
async function listPagesViaPlaywright(opts) {
  const { browser } = await connectBrowser(opts.cdpUrl);
  const pages = await getAllPages(browser);
  const results = [];
  for (const page of pages) {
    const tid = await pageTargetId(page).catch(() => null);
    if (tid) {
      results.push({
        targetId: tid,
        title: await page.title().catch(() => ''),
        url: page.url(),
        type: 'page'
      });
    }
  }
  return results;
}
async function createPageViaPlaywright(opts) {
  const { browser } = await connectBrowser(opts.cdpUrl);
  const context = browser.contexts()[0] ?? await browser.newContext();
  ensureContextState(context);
  const page = await context.newPage();
  ensurePageState(page);
  const targetUrl = opts.url.trim() || 'about:blank';
  if (targetUrl !== 'about:blank') {
    await page.goto(targetUrl, { timeout: 3e4 }).catch(() => {
    });
  }
  const tid = await pageTargetId(page).catch(() => null);
  if (!tid) {
    throw new Error('Failed to get targetId for new page');
  }
  return {
    targetId: tid,
    title: await page.title().catch(() => ''),
    url: page.url(),
    type: 'page'
  };
}
async function closePageByTargetIdViaPlaywright(opts) {
  const { browser } = await connectBrowser(opts.cdpUrl);
  const page = await findPageByTargetId(browser, opts.targetId, opts.cdpUrl);
  if (!page) {
    throw new Error('tab not found');
  }
  await page.close();
}
async function focusPageByTargetIdViaPlaywright(opts) {
  const { browser } = await connectBrowser(opts.cdpUrl);
  const page = await findPageByTargetId(browser, opts.targetId, opts.cdpUrl);
  if (!page) {
    throw new Error('tab not found');
  }
  try {
    await page.bringToFront();
  } catch (err) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Page.bringToFront');
      return;
    } catch {
      throw err;
    } finally {
      await session.detach().catch(() => {
      });
    }
  }
}
export {
  closePageByTargetIdViaPlaywright,
  closePlaywrightBrowserConnection,
  createPageViaPlaywright,
  ensureContextState,
  ensurePageState,
  focusPageByTargetIdViaPlaywright,
  getPageForTargetId,
  listPagesViaPlaywright,
  refLocator,
  rememberRoleRefsForTarget,
  restoreRoleRefsForTarget,
  storeRoleRefsForTarget
};
