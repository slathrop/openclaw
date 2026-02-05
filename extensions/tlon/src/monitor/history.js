import { extractMessageText } from './utils.js';
const messageCache = /* @__PURE__ */ new Map();
const MAX_CACHED_MESSAGES = 100;
function cacheMessage(channelNest, message) {
  if (!messageCache.has(channelNest)) {
    messageCache.set(channelNest, []);
  }
  const cache = messageCache.get(channelNest);
  if (!cache) {
    return;
  }
  cache.unshift(message);
  if (cache.length > MAX_CACHED_MESSAGES) {
    cache.pop();
  }
}
async function fetchChannelHistory(api, channelNest, count = 50, runtime) {
  try {
    const scryPath = `/channels/v4/${channelNest}/posts/newest/${count}/outline.json`;
    runtime?.log?.(`[tlon] Fetching history: ${scryPath}`);
    const data = await api.scry(scryPath);
    if (!data) {
      return [];
    }
    let posts = [];
    if (Array.isArray(data)) {
      posts = data;
    } else if (data.posts && typeof data.posts === 'object') {
      posts = Object.values(data.posts);
    } else if (typeof data === 'object') {
      posts = Object.values(data);
    }
    const messages = posts.map((item) => {
      const essay = item.essay || item['r-post']?.set?.essay;
      const seal = item.seal || item['r-post']?.set?.seal;
      return {
        author: essay?.author || 'unknown',
        content: extractMessageText(essay?.content || []),
        timestamp: essay?.sent || Date.now(),
        id: seal?.id
      };
    }).filter((msg) => msg.content);
    runtime?.log?.(`[tlon] Extracted ${messages.length} messages from history`);
    return messages;
  } catch (error) {
    runtime?.log?.(`[tlon] Error fetching channel history: ${error?.message ?? String(error)}`);
    return [];
  }
}
async function getChannelHistory(api, channelNest, count = 50, runtime) {
  const cache = messageCache.get(channelNest) ?? [];
  if (cache.length >= count) {
    runtime?.log?.(`[tlon] Using cached messages (${cache.length} available)`);
    return cache.slice(0, count);
  }
  runtime?.log?.(`[tlon] Cache has ${cache.length} messages, need ${count}, fetching from scry...`);
  return await fetchChannelHistory(api, channelNest, count, runtime);
}
export {
  cacheMessage,
  fetchChannelHistory,
  getChannelHistory
};
