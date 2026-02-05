/**
 * Web fetch tool for HTTP request execution with SSRF protection.
 * @module agents/tools/web-fetch
 */
import { Type } from '@sinclair/typebox';
import { fetchWithSsrFGuard } from '../../infra/net/fetch-guard.js';
import { SsrFBlockedError } from '../../infra/net/ssrf.js';
import { wrapExternalContent, wrapWebContent } from '../../security/external-content.js';
import { stringEnum } from '../schema/typebox.js';
import { jsonResult, readNumberParam, readStringParam } from './common.js';
import {
  extractReadableContent,
  htmlToMarkdown,
  markdownToText,
  truncateText
} from './web-fetch-utils.js';
import {
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  withTimeout,
  writeCache
} from './web-shared.js';
import { extractReadableContent as extractReadableContent2 } from './web-fetch-utils.js';
const EXTRACT_MODES = ['markdown', 'text'];
const DEFAULT_FETCH_MAX_CHARS = 5e4;
const DEFAULT_FETCH_MAX_REDIRECTS = 3;
const DEFAULT_ERROR_MAX_CHARS = 4e3;
const DEFAULT_FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev';
const DEFAULT_FIRECRAWL_MAX_AGE_MS = 1728e5;
const DEFAULT_FETCH_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const FETCH_CACHE = /* @__PURE__ */ new Map();
const WebFetchSchema = Type.Object({
  url: Type.String({ description: 'HTTP or HTTPS URL to fetch.' }),
  extractMode: Type.Optional(
    stringEnum(EXTRACT_MODES, {
      description: 'Extraction mode ("markdown" or "text").',
      default: 'markdown'
    })
  ),
  maxChars: Type.Optional(
    Type.Number({
      description: 'Maximum characters to return (truncates when exceeded).',
      minimum: 100
    })
  )
});
function resolveFetchConfig(cfg) {
  const fetch2 = cfg?.tools?.web?.fetch;
  if (!fetch2 || typeof fetch2 !== 'object') {
    return void 0;
  }
  return fetch2;
}
function resolveFetchEnabled(params) {
  if (typeof params.fetch?.enabled === 'boolean') {
    return params.fetch.enabled;
  }
  return true;
}
function resolveFetchReadabilityEnabled(fetch2) {
  if (typeof fetch2?.readability === 'boolean') {
    return fetch2.readability;
  }
  return true;
}
function resolveFetchMaxCharsCap(fetch2) {
  const raw = fetch2 && 'maxCharsCap' in fetch2 && typeof fetch2.maxCharsCap === 'number' ? fetch2.maxCharsCap : void 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_FETCH_MAX_CHARS;
  }
  return Math.max(100, Math.floor(raw));
}
function resolveFirecrawlConfig(fetch2) {
  if (!fetch2 || typeof fetch2 !== 'object') {
    return void 0;
  }
  const firecrawl = 'firecrawl' in fetch2 ? fetch2.firecrawl : void 0;
  if (!firecrawl || typeof firecrawl !== 'object') {
    return void 0;
  }
  return firecrawl;
}
function resolveFirecrawlApiKey(firecrawl) {
  const fromConfig = firecrawl && 'apiKey' in firecrawl && typeof firecrawl.apiKey === 'string' ? firecrawl.apiKey.trim() : '';
  const fromEnv = (process.env.FIRECRAWL_API_KEY ?? '').trim();
  return fromConfig || fromEnv || void 0;
}
function resolveFirecrawlEnabled(params) {
  if (typeof params.firecrawl?.enabled === 'boolean') {
    return params.firecrawl.enabled;
  }
  return Boolean(params.apiKey);
}
function resolveFirecrawlBaseUrl(firecrawl) {
  const raw = firecrawl && 'baseUrl' in firecrawl && typeof firecrawl.baseUrl === 'string' ? firecrawl.baseUrl.trim() : '';
  return raw || DEFAULT_FIRECRAWL_BASE_URL;
}
function resolveFirecrawlOnlyMainContent(firecrawl) {
  if (typeof firecrawl?.onlyMainContent === 'boolean') {
    return firecrawl.onlyMainContent;
  }
  return true;
}
function resolveFirecrawlMaxAgeMs(firecrawl) {
  const raw = firecrawl && 'maxAgeMs' in firecrawl && typeof firecrawl.maxAgeMs === 'number' ? firecrawl.maxAgeMs : void 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return void 0;
  }
  const parsed = Math.max(0, Math.floor(raw));
  return parsed > 0 ? parsed : void 0;
}
function resolveFirecrawlMaxAgeMsOrDefault(firecrawl) {
  const resolved = resolveFirecrawlMaxAgeMs(firecrawl);
  if (typeof resolved === 'number') {
    return resolved;
  }
  return DEFAULT_FIRECRAWL_MAX_AGE_MS;
}
function resolveMaxChars(value, fallback, cap) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const clamped = Math.max(100, Math.floor(parsed));
  return Math.min(clamped, cap);
}
function resolveMaxRedirects(value, fallback) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.floor(parsed));
}
function looksLikeHtml(value) {
  const trimmed = value.trimStart();
  if (!trimmed) {
    return false;
  }
  const head = trimmed.slice(0, 256).toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}
function formatWebFetchErrorDetail(params) {
  const { detail, contentType, maxChars } = params;
  if (!detail) {
    return '';
  }
  let text = detail;
  const contentTypeLower = contentType?.toLowerCase();
  if (contentTypeLower?.includes('text/html') || looksLikeHtml(detail)) {
    const rendered = htmlToMarkdown(detail);
    const withTitle = rendered.title ? `${rendered.title}
${rendered.text}` : rendered.text;
    text = markdownToText(withTitle);
  }
  const truncated = truncateText(text.trim(), maxChars);
  return truncated.text;
}
const WEB_FETCH_WRAPPER_WITH_WARNING_OVERHEAD = wrapWebContent('', 'web_fetch').length;
const WEB_FETCH_WRAPPER_NO_WARNING_OVERHEAD = wrapExternalContent('', {
  source: 'web_fetch',
  includeWarning: false
}).length;
function wrapWebFetchContent(value, maxChars) {
  if (maxChars <= 0) {
    return { text: '', truncated: true, rawLength: 0, wrappedLength: 0 };
  }
  const includeWarning = maxChars >= WEB_FETCH_WRAPPER_WITH_WARNING_OVERHEAD;
  const wrapperOverhead = includeWarning ? WEB_FETCH_WRAPPER_WITH_WARNING_OVERHEAD : WEB_FETCH_WRAPPER_NO_WARNING_OVERHEAD;
  if (wrapperOverhead > maxChars) {
    const minimal = includeWarning ? wrapWebContent('', 'web_fetch') : wrapExternalContent('', { source: 'web_fetch', includeWarning: false });
    const truncatedWrapper = truncateText(minimal, maxChars);
    return {
      text: truncatedWrapper.text,
      truncated: true,
      rawLength: 0,
      wrappedLength: truncatedWrapper.text.length
    };
  }
  const maxInner = Math.max(0, maxChars - wrapperOverhead);
  let truncated = truncateText(value, maxInner);
  let wrappedText = includeWarning ? wrapWebContent(truncated.text, 'web_fetch') : wrapExternalContent(truncated.text, { source: 'web_fetch', includeWarning: false });
  if (wrappedText.length > maxChars) {
    const excess = wrappedText.length - maxChars;
    const adjustedMaxInner = Math.max(0, maxInner - excess);
    truncated = truncateText(value, adjustedMaxInner);
    wrappedText = includeWarning ? wrapWebContent(truncated.text, 'web_fetch') : wrapExternalContent(truncated.text, { source: 'web_fetch', includeWarning: false });
  }
  return {
    text: wrappedText,
    truncated: truncated.truncated,
    rawLength: truncated.text.length,
    wrappedLength: wrappedText.length
  };
}
function wrapWebFetchField(value) {
  if (!value) {
    return value;
  }
  return wrapExternalContent(value, { source: 'web_fetch', includeWarning: false });
}
function normalizeContentType(value) {
  if (!value) {
    return void 0;
  }
  const [raw] = value.split(';');
  const trimmed = raw?.trim();
  return trimmed || void 0;
}
async function fetchFirecrawlContent(params) {
  const endpoint = resolveFirecrawlEndpoint(params.baseUrl);
  const body = {
    url: params.url,
    formats: ['markdown'],
    onlyMainContent: params.onlyMainContent,
    timeout: params.timeoutSeconds * 1e3,
    maxAge: params.maxAgeMs,
    proxy: params.proxy,
    storeInCache: params.storeInCache
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: withTimeout(void 0, params.timeoutSeconds * 1e3)
  });
  const payload = await res.json();
  if (!res.ok || payload?.success === false) {
    const detail = payload?.error ?? '';
    throw new Error(
      `Firecrawl fetch failed (${res.status}): ${wrapWebContent(detail || res.statusText, 'web_fetch')}`.trim()
    );
  }
  const data = payload?.data ?? {};
  const rawText = typeof data.markdown === 'string' ? data.markdown : typeof data.content === 'string' ? data.content : '';
  const text = params.extractMode === 'text' ? markdownToText(rawText) : rawText;
  return {
    text,
    title: data.metadata?.title,
    finalUrl: data.metadata?.sourceURL,
    status: data.metadata?.statusCode,
    warning: payload?.warning
  };
}
async function runWebFetch(params) {
  const cacheKey = normalizeCacheKey(
    `fetch:${params.url}:${params.extractMode}:${params.maxChars}`
  );
  const cached = readCache(FETCH_CACHE, cacheKey);
  if (cached) {
    return { ...cached.value, cached: true };
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(params.url);
  } catch {
    throw new Error('Invalid URL: must be http or https');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid URL: must be http or https');
  }
  const start = Date.now();
  let res;
  let release = null;
  let finalUrl = params.url;
  try {
    const result = await fetchWithSsrFGuard({
      url: params.url,
      maxRedirects: params.maxRedirects,
      timeoutMs: params.timeoutSeconds * 1e3,
      init: {
        headers: {
          Accept: '*/*',
          'User-Agent': params.userAgent,
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    });
    res = result.response;
    finalUrl = result.finalUrl;
    release = result.release;
  } catch (error) {
    if (error instanceof SsrFBlockedError) {
      throw error;
    }
    if (params.firecrawlEnabled && params.firecrawlApiKey) {
      const firecrawl = await fetchFirecrawlContent({
        url: finalUrl,
        extractMode: params.extractMode,
        apiKey: params.firecrawlApiKey,
        baseUrl: params.firecrawlBaseUrl,
        onlyMainContent: params.firecrawlOnlyMainContent,
        maxAgeMs: params.firecrawlMaxAgeMs,
        proxy: params.firecrawlProxy,
        storeInCache: params.firecrawlStoreInCache,
        timeoutSeconds: params.firecrawlTimeoutSeconds
      });
      const wrapped = wrapWebFetchContent(firecrawl.text, params.maxChars);
      const wrappedTitle = firecrawl.title ? wrapWebFetchField(firecrawl.title) : void 0;
      const payload = {
        url: params.url,
        // Keep raw for tool chaining
        finalUrl: firecrawl.finalUrl || finalUrl,
        // Keep raw
        status: firecrawl.status ?? 200,
        contentType: 'text/markdown',
        // Protocol metadata, don't wrap
        title: wrappedTitle,
        extractMode: params.extractMode,
        extractor: 'firecrawl',
        truncated: wrapped.truncated,
        length: wrapped.wrappedLength,
        rawLength: wrapped.rawLength,
        // Actual content length, not wrapped
        wrappedLength: wrapped.wrappedLength,
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        tookMs: Date.now() - start,
        text: wrapped.text,
        warning: wrapWebFetchField(firecrawl.warning)
      };
      writeCache(FETCH_CACHE, cacheKey, payload, params.cacheTtlMs);
      return payload;
    }
    throw error;
  }
  try {
    if (!res.ok) {
      if (params.firecrawlEnabled && params.firecrawlApiKey) {
        const firecrawl = await fetchFirecrawlContent({
          url: params.url,
          extractMode: params.extractMode,
          apiKey: params.firecrawlApiKey,
          baseUrl: params.firecrawlBaseUrl,
          onlyMainContent: params.firecrawlOnlyMainContent,
          maxAgeMs: params.firecrawlMaxAgeMs,
          proxy: params.firecrawlProxy,
          storeInCache: params.firecrawlStoreInCache,
          timeoutSeconds: params.firecrawlTimeoutSeconds
        });
        const wrapped2 = wrapWebFetchContent(firecrawl.text, params.maxChars);
        const wrappedTitle2 = firecrawl.title ? wrapWebFetchField(firecrawl.title) : void 0;
        const payload2 = {
          url: params.url,
          // Keep raw for tool chaining
          finalUrl: firecrawl.finalUrl || finalUrl,
          // Keep raw
          status: firecrawl.status ?? res.status,
          contentType: 'text/markdown',
          // Protocol metadata, don't wrap
          title: wrappedTitle2,
          extractMode: params.extractMode,
          extractor: 'firecrawl',
          truncated: wrapped2.truncated,
          length: wrapped2.wrappedLength,
          rawLength: wrapped2.rawLength,
          // Actual content length, not wrapped
          wrappedLength: wrapped2.wrappedLength,
          fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
          tookMs: Date.now() - start,
          text: wrapped2.text,
          warning: wrapWebFetchField(firecrawl.warning)
        };
        writeCache(FETCH_CACHE, cacheKey, payload2, params.cacheTtlMs);
        return payload2;
      }
      const rawDetail = await readResponseText(res);
      const detail = formatWebFetchErrorDetail({
        detail: rawDetail,
        contentType: res.headers.get('content-type'),
        maxChars: DEFAULT_ERROR_MAX_CHARS
      });
      const wrappedDetail = wrapWebFetchContent(detail || res.statusText, DEFAULT_ERROR_MAX_CHARS);
      throw new Error(`Web fetch failed (${res.status}): ${wrappedDetail.text}`);
    }
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    const normalizedContentType = normalizeContentType(contentType) ?? 'application/octet-stream';
    const body = await readResponseText(res);
    let title;
    let extractor = 'raw';
    let text = body;
    if (contentType.includes('text/html')) {
      if (params.readabilityEnabled) {
        const readable = await extractReadableContent({
          html: body,
          url: finalUrl,
          extractMode: params.extractMode
        });
        if (readable?.text) {
          text = readable.text;
          title = readable.title;
          extractor = 'readability';
        } else {
          const firecrawl = await tryFirecrawlFallback({ ...params, url: finalUrl });
          if (firecrawl) {
            text = firecrawl.text;
            title = firecrawl.title;
            extractor = 'firecrawl';
          } else {
            throw new Error(
              'Web fetch extraction failed: Readability and Firecrawl returned no content.'
            );
          }
        }
      } else {
        throw new Error(
          'Web fetch extraction failed: Readability disabled and Firecrawl unavailable.'
        );
      }
    } else if (contentType.includes('application/json')) {
      try {
        text = JSON.stringify(JSON.parse(body), null, 2);
        extractor = 'json';
      } catch {
        text = body;
        extractor = 'raw';
      }
    }
    const wrapped = wrapWebFetchContent(text, params.maxChars);
    const wrappedTitle = title ? wrapWebFetchField(title) : void 0;
    const payload = {
      url: params.url,
      // Keep raw for tool chaining
      finalUrl,
      // Keep raw
      status: res.status,
      contentType: normalizedContentType,
      // Protocol metadata, don't wrap
      title: wrappedTitle,
      extractMode: params.extractMode,
      extractor,
      truncated: wrapped.truncated,
      length: wrapped.wrappedLength,
      rawLength: wrapped.rawLength,
      // Actual content length, not wrapped
      wrappedLength: wrapped.wrappedLength,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      tookMs: Date.now() - start,
      text: wrapped.text
    };
    writeCache(FETCH_CACHE, cacheKey, payload, params.cacheTtlMs);
    return payload;
  } finally {
    if (release) {
      await release();
    }
  }
}
async function tryFirecrawlFallback(params) {
  if (!params.firecrawlEnabled || !params.firecrawlApiKey) {
    return null;
  }
  try {
    const firecrawl = await fetchFirecrawlContent({
      url: params.url,
      extractMode: params.extractMode,
      apiKey: params.firecrawlApiKey,
      baseUrl: params.firecrawlBaseUrl,
      onlyMainContent: params.firecrawlOnlyMainContent,
      maxAgeMs: params.firecrawlMaxAgeMs,
      proxy: params.firecrawlProxy,
      storeInCache: params.firecrawlStoreInCache,
      timeoutSeconds: params.firecrawlTimeoutSeconds
    });
    return { text: firecrawl.text, title: firecrawl.title };
  } catch {
    return null;
  }
}
function resolveFirecrawlEndpoint(baseUrl) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return `${DEFAULT_FIRECRAWL_BASE_URL}/v2/scrape`;
  }
  try {
    const url = new URL(trimmed);
    if (url.pathname && url.pathname !== '/') {
      return url.toString();
    }
    url.pathname = '/v2/scrape';
    return url.toString();
  } catch {
    return `${DEFAULT_FIRECRAWL_BASE_URL}/v2/scrape`;
  }
}
function createWebFetchTool(options) {
  const fetch2 = resolveFetchConfig(options?.config);
  if (!resolveFetchEnabled({ fetch: fetch2, sandboxed: options?.sandboxed })) {
    return null;
  }
  const readabilityEnabled = resolveFetchReadabilityEnabled(fetch2);
  const firecrawl = resolveFirecrawlConfig(fetch2);
  const firecrawlApiKey = resolveFirecrawlApiKey(firecrawl);
  const firecrawlEnabled = resolveFirecrawlEnabled({ firecrawl, apiKey: firecrawlApiKey });
  const firecrawlBaseUrl = resolveFirecrawlBaseUrl(firecrawl);
  const firecrawlOnlyMainContent = resolveFirecrawlOnlyMainContent(firecrawl);
  const firecrawlMaxAgeMs = resolveFirecrawlMaxAgeMsOrDefault(firecrawl);
  const firecrawlTimeoutSeconds = resolveTimeoutSeconds(
    firecrawl?.timeoutSeconds ?? fetch2?.timeoutSeconds,
    DEFAULT_TIMEOUT_SECONDS
  );
  const userAgent = fetch2 && 'userAgent' in fetch2 && typeof fetch2.userAgent === 'string' && fetch2.userAgent || DEFAULT_FETCH_USER_AGENT;
  return {
    label: 'Web Fetch',
    name: 'web_fetch',
    description: 'Fetch and extract readable content from a URL (HTML \u2192 markdown/text). Use for lightweight page access without browser automation.',
    parameters: WebFetchSchema,
    execute: async (_toolCallId, args) => {
      const params = args;
      const url = readStringParam(params, 'url', { required: true });
      const extractMode = readStringParam(params, 'extractMode') === 'text' ? 'text' : 'markdown';
      const maxChars = readNumberParam(params, 'maxChars', { integer: true });
      const maxCharsCap = resolveFetchMaxCharsCap(fetch2);
      const result = await runWebFetch({
        url,
        extractMode,
        maxChars: resolveMaxChars(
          maxChars ?? fetch2?.maxChars,
          DEFAULT_FETCH_MAX_CHARS,
          maxCharsCap
        ),
        maxRedirects: resolveMaxRedirects(fetch2?.maxRedirects, DEFAULT_FETCH_MAX_REDIRECTS),
        timeoutSeconds: resolveTimeoutSeconds(fetch2?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS),
        cacheTtlMs: resolveCacheTtlMs(fetch2?.cacheTtlMinutes, DEFAULT_CACHE_TTL_MINUTES),
        userAgent,
        readabilityEnabled,
        firecrawlEnabled,
        firecrawlApiKey,
        firecrawlBaseUrl,
        firecrawlOnlyMainContent,
        firecrawlMaxAgeMs,
        firecrawlProxy: 'auto',
        firecrawlStoreInCache: true,
        firecrawlTimeoutSeconds
      });
      return jsonResult(result);
    }
  };
}
export {
  createWebFetchTool,
  extractReadableContent2 as extractReadableContent,
  fetchFirecrawlContent
};
