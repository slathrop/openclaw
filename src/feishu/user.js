/**
 * Feishu user lookup support.
 * @module feishu/user
 */
import { formatErrorMessage } from '../infra/errors.js';
import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'feishu-user' });

// Simple in-memory cache for user info (expires after 1 hour)
const userCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get user information from Feishu.
 * Uses the contact API: GET /open-apis/contact/v3/users/:user_id
 * Requires permission: contact:user.base:readonly or contact:contact:readonly_as_app
 * @param {object} client
 * @param {string} openId
 * @returns {Promise<{openId: string, name?: string, enName?: string, avatar?: string}|null>}
 */
export async function getFeishuUserInfo(client, openId) {
  // Check cache first
  const cached = userCache.get(openId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.info;
  }

  try {
    const res = await client.contact.user.get({
      path: { user_id: openId },
      params: { user_id_type: 'open_id' }
    });

    if (res.code !== 0) {
      logger.debug(`Failed to get user info for ${openId}: ${res.code} - ${res.msg}`);
      return null;
    }

    const user = res.data?.user;
    if (!user) {
      return null;
    }

    const info = {
      openId,
      name: user.name,
      enName: user.en_name,
      avatar: user.avatar?.avatar_240
    };

    // Cache the result
    userCache.set(openId, {
      info,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return info;
  } catch (err) {
    // Gracefully handle permission errors - just log and return null
    logger.debug(`Error getting user info for ${openId}: ${formatErrorMessage(err)}`);
    return null;
  }
}

/**
 * Get display name for a user. Falls back to openId if name is not available.
 * @param {object} client
 * @param {string} openId
 * @param {string} [fallback]
 * @returns {Promise<string>}
 */
export async function getFeishuUserDisplayName(client, openId, fallback) {
  const info = await getFeishuUserInfo(client, openId);
  return info?.name || info?.enName || fallback || openId;
}

/**
 * Clear expired entries from the cache.
 */
export function cleanupUserCache() {
  const now = Date.now();
  for (const [key, value] of userCache) {
    if (value.expiresAt < now) {
      userCache.delete(key);
    }
  }
}
