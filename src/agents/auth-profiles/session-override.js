/**
 * Session-level auth profile override resolution and rotation.
 * @module agents/auth-profiles/session-override
 */
import { updateSessionStore } from '../../config/sessions.js';
import {
  ensureAuthProfileStore,
  isProfileInCooldown,
  resolveAuthProfileOrder
} from '../auth-profiles.js';
import { normalizeProviderId } from '../model-selection.js';
function isProfileForProvider(params) {
  const entry = params.store.profiles[params.profileId];
  if (!entry?.provider) {
    return false;
  }
  return normalizeProviderId(entry.provider) === normalizeProviderId(params.provider);
}
async function clearSessionAuthProfileOverride(params) {
  const { sessionEntry, sessionStore, sessionKey, storePath } = params;
  delete sessionEntry.authProfileOverride;
  delete sessionEntry.authProfileOverrideSource;
  delete sessionEntry.authProfileOverrideCompactionCount;
  sessionEntry.updatedAt = Date.now();
  sessionStore[sessionKey] = sessionEntry;
  if (storePath) {
    await updateSessionStore(storePath, (store) => {
      store[sessionKey] = sessionEntry;
    });
  }
}
async function resolveSessionAuthProfileOverride(params) {
  const {
    cfg,
    provider,
    agentDir,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    isNewSession
  } = params;
  if (!sessionEntry || !sessionStore || !sessionKey) {
    return sessionEntry?.authProfileOverride;
  }
  const store = ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false });
  const order = resolveAuthProfileOrder({ cfg, store, provider });
  let current = sessionEntry.authProfileOverride?.trim();
  if (current && !store.profiles[current]) {
    await clearSessionAuthProfileOverride({ sessionEntry, sessionStore, sessionKey, storePath });
    current = void 0;
  }
  if (current && !isProfileForProvider({ provider, profileId: current, store })) {
    await clearSessionAuthProfileOverride({ sessionEntry, sessionStore, sessionKey, storePath });
    current = void 0;
  }
  if (current && order.length > 0 && !order.includes(current)) {
    await clearSessionAuthProfileOverride({ sessionEntry, sessionStore, sessionKey, storePath });
    current = void 0;
  }
  if (order.length === 0) {
    return void 0;
  }
  const pickFirstAvailable = () => order.find((profileId) => !isProfileInCooldown(store, profileId)) ?? order[0];
  const pickNextAvailable = (active) => {
    const startIndex = order.indexOf(active);
    if (startIndex < 0) {
      return pickFirstAvailable();
    }
    for (let offset = 1; offset <= order.length; offset += 1) {
      const candidate = order[(startIndex + offset) % order.length];
      if (!isProfileInCooldown(store, candidate)) {
        return candidate;
      }
    }
    return order[startIndex] ?? order[0];
  };
  const compactionCount = sessionEntry.compactionCount ?? 0;
  const storedCompaction = typeof sessionEntry.authProfileOverrideCompactionCount === 'number' ? sessionEntry.authProfileOverrideCompactionCount : compactionCount;
  const source = sessionEntry.authProfileOverrideSource ?? (typeof sessionEntry.authProfileOverrideCompactionCount === 'number' ? 'auto' : current ? 'user' : void 0);
  if (source === 'user' && current && !isNewSession) {
    return current;
  }
  let next = current;
  if (isNewSession) {
    next = current ? pickNextAvailable(current) : pickFirstAvailable();
  } else if (current && compactionCount > storedCompaction) {
    next = pickNextAvailable(current);
  } else if (!current || isProfileInCooldown(store, current)) {
    next = pickFirstAvailable();
  }
  if (!next) {
    return current;
  }
  const shouldPersist = next !== sessionEntry.authProfileOverride || sessionEntry.authProfileOverrideSource !== 'auto' || sessionEntry.authProfileOverrideCompactionCount !== compactionCount;
  if (shouldPersist) {
    sessionEntry.authProfileOverride = next;
    sessionEntry.authProfileOverrideSource = 'auto';
    sessionEntry.authProfileOverrideCompactionCount = compactionCount;
    sessionEntry.updatedAt = Date.now();
    sessionStore[sessionKey] = sessionEntry;
    if (storePath) {
      await updateSessionStore(storePath, (store2) => {
        store2[sessionKey] = sessionEntry;
      });
    }
  }
  return next;
}
export {
  clearSessionAuthProfileOverride,
  resolveSessionAuthProfileOverride
};
