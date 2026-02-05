/**
 * Telegram sticker cache for vision-described stickers
 * @typedef {object} CachedSticker
 * @property {string} fileId
 * @property {string} fileUniqueId
 * @property {string} [emoji]
 * @property {string} [setName]
 * @property {string} description
 * @property {string} cachedAt
 * @property {string} [receivedFrom]
 * @typedef {object} StickerCache
 * @property {number} version
 * @property {Record<string, CachedSticker>} stickers
 * @typedef {object} DescribeStickerParams
 * @property {string} imagePath
 * @property {import("../config/config.js").OpenClawConfig} cfg
 * @property {string} [agentDir]
 * @property {string} [agentId]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveApiKeyForProvider } from '../agents/model-auth.js';
import {
  findModelInCatalog,
  loadModelCatalog,
  modelSupportsVision
} from '../agents/model-catalog.js';
import { resolveDefaultModelForAgent } from '../agents/model-selection.js';
import { STATE_DIR } from '../config/paths.js';
import { logVerbose } from '../globals.js';
import { loadJsonFile, saveJsonFile } from '../infra/json-file.js';
import { resolveAutoImageModel } from '../media-understanding/runner.js';
const CACHE_FILE = path.join(STATE_DIR, 'telegram', 'sticker-cache.json');
const CACHE_VERSION = 1;
function loadCache() {
  const data = loadJsonFile(CACHE_FILE);
  if (!data || typeof data !== 'object') {
    return { version: CACHE_VERSION, stickers: {} };
  }
  const cache = data;
  if (cache.version !== CACHE_VERSION) {
    return { version: CACHE_VERSION, stickers: {} };
  }
  return cache;
}
function saveCache(cache) {
  saveJsonFile(CACHE_FILE, cache);
}
function getCachedSticker(fileUniqueId) {
  const cache = loadCache();
  return cache.stickers[fileUniqueId] ?? null;
}
function cacheSticker(sticker) {
  const cache = loadCache();
  cache.stickers[sticker.fileUniqueId] = sticker;
  saveCache(cache);
}
function searchStickers(query, limit = 10) {
  const cache = loadCache();
  const queryLower = query.toLowerCase();
  const results = [];
  for (const sticker of Object.values(cache.stickers)) {
    let score = 0;
    const descLower = sticker.description.toLowerCase();
    if (descLower.includes(queryLower)) {
      score += 10;
    }
    const queryWords = queryLower.split(/\s+/).filter(Boolean);
    const descWords = descLower.split(/\s+/);
    for (const qWord of queryWords) {
      if (descWords.some((dWord) => dWord.includes(qWord))) {
        score += 5;
      }
    }
    if (sticker.emoji && query.includes(sticker.emoji)) {
      score += 8;
    }
    if (sticker.setName?.toLowerCase().includes(queryLower)) {
      score += 3;
    }
    if (score > 0) {
      results.push({ sticker, score });
    }
  }
  return results.toSorted((a, b) => b.score - a.score).slice(0, limit).map((r) => r.sticker);
}
function getAllCachedStickers() {
  const cache = loadCache();
  return Object.values(cache.stickers);
}
function getCacheStats() {
  const cache = loadCache();
  const stickers = Object.values(cache.stickers);
  if (stickers.length === 0) {
    return { count: 0 };
  }
  const sorted = [...stickers].toSorted(
    (a, b) => new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
  );
  return {
    count: stickers.length,
    oldestAt: sorted[0]?.cachedAt,
    newestAt: sorted[sorted.length - 1]?.cachedAt
  };
}
const STICKER_DESCRIPTION_PROMPT = 'Describe this sticker image in 1-2 sentences. Focus on what the sticker depicts (character, object, action, emotion). Be concise and objective.';
const VISION_PROVIDERS = ['openai', 'anthropic', 'google', 'minimax'];
async function describeStickerImage(params) {
  const { imagePath, cfg, agentDir, agentId } = params;
  const defaultModel = resolveDefaultModelForAgent({ cfg, agentId });
  let activeModel = void 0;
  let catalog = [];
  try {
    catalog = await loadModelCatalog({ config: cfg });
    const entry = findModelInCatalog(catalog, defaultModel.provider, defaultModel.model);
    const supportsVision = modelSupportsVision(entry);
    if (supportsVision) {
      activeModel = { provider: defaultModel.provider, model: defaultModel.model };
    }
  } catch {
    // Intentionally ignored
  }
  const hasProviderKey = async (provider2) => {
    try {
      await resolveApiKeyForProvider({ provider: provider2, cfg, agentDir });
      return true;
    } catch {
      return false;
    }
  };
  const selectCatalogModel = (provider2) => {
    const entries = catalog.filter(
      (entry) => entry.provider.toLowerCase() === provider2.toLowerCase() && modelSupportsVision(entry)
    );
    if (entries.length === 0) {
      return void 0;
    }
    const defaultId = provider2 === 'openai' ? 'gpt-5-mini' : provider2 === 'anthropic' ? 'claude-opus-4-5' : provider2 === 'google' ? 'gemini-3-flash-preview' : 'MiniMax-VL-01';
    const preferred = entries.find((entry) => entry.id === defaultId);
    return preferred ?? entries[0];
  };
  let resolved = null;
  if (activeModel && VISION_PROVIDERS.includes(activeModel.provider) && await hasProviderKey(activeModel.provider)) {
    resolved = activeModel;
  }
  if (!resolved) {
    for (const provider2 of VISION_PROVIDERS) {
      if (!await hasProviderKey(provider2)) {
        continue;
      }
      const entry = selectCatalogModel(provider2);
      if (entry) {
        resolved = { provider: provider2, model: entry.id };
        break;
      }
    }
  }
  if (!resolved) {
    resolved = await resolveAutoImageModel({
      cfg,
      agentDir,
      activeModel
    });
  }
  if (!resolved?.model) {
    logVerbose('telegram: no vision provider available for sticker description');
    return null;
  }
  const { provider, model } = resolved;
  logVerbose(`telegram: describing sticker with ${provider}/${model}`);
  try {
    const buffer = await fs.readFile(imagePath);
    const { describeImageWithModel } = await import('../media-understanding/providers/image.js');
    const result = await describeImageWithModel({
      buffer,
      fileName: 'sticker.webp',
      mime: 'image/webp',
      prompt: STICKER_DESCRIPTION_PROMPT,
      cfg,
      agentDir: agentDir ?? '',
      provider,
      model,
      maxTokens: 150,
      timeoutMs: 3e4
    });
    return result.text;
  } catch (err) {
    logVerbose(`telegram: failed to describe sticker: ${String(err)}`);
    return null;
  }
}
export {
  cacheSticker,
  describeStickerImage,
  getAllCachedStickers,
  getCacheStats,
  getCachedSticker,
  searchStickers
};
