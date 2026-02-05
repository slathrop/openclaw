/**
 * @module auth-health
 * Authentication profile health checks and status reporting.
 *
 * SECURITY: Reports authentication profile health -- expiration status may reveal credential lifecycle.
 * @typedef {'store'} AuthProfileSource
 * @typedef {'ok'|'expiring'|'expired'|'missing'|'static'} AuthProfileHealthStatus
 * @typedef {'ok'|'expiring'|'expired'|'missing'|'static'} AuthProviderHealthStatus
 * @typedef {object} AuthProfileHealth
 * @typedef {object} AuthProviderHealth
 * @typedef {object} AuthHealthSummary
 * @property
 */

import {
  resolveAuthProfileDisplayLabel
} from './auth-profiles.js';
const DEFAULT_OAUTH_WARN_MS = 24 * 60 * 60 * 1e3;
function resolveAuthProfileSource(/* _profileId */) {
  return 'store';
}
function formatRemainingShort(remainingMs) {
  if (remainingMs === void 0 || Number.isNaN(remainingMs)) {
    return 'unknown';
  }
  if (remainingMs <= 0) {
    return '0m';
  }
  const minutes = Math.max(1, Math.round(remainingMs / 6e4));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  const days = Math.round(hours / 24);
  return `${days}d`;
}
function resolveOAuthStatus(expiresAt, now, warnAfterMs) {
  if (!expiresAt || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    return { status: 'missing' };
  }
  const remainingMs = expiresAt - now;
  if (remainingMs <= 0) {
    return { status: 'expired', remainingMs };
  }
  if (remainingMs <= warnAfterMs) {
    return { status: 'expiring', remainingMs };
  }
  return { status: 'ok', remainingMs };
}
function buildProfileHealth(params) {
  const { profileId, credential, store, cfg, now, warnAfterMs } = params;
  const label = resolveAuthProfileDisplayLabel({ cfg, store, profileId });
  const source = resolveAuthProfileSource(profileId);
  if (credential.type === 'api_key') {
    return {
      profileId,
      provider: credential.provider,
      type: 'api_key',
      status: 'static',
      source,
      label
    };
  }
  if (credential.type === 'token') {
    const expiresAt = typeof credential.expires === 'number' && Number.isFinite(credential.expires) ? credential.expires : void 0;
    if (!expiresAt || expiresAt <= 0) {
      return {
        profileId,
        provider: credential.provider,
        type: 'token',
        status: 'static',
        source,
        label
      };
    }
    const { status: status2, remainingMs: remainingMs2 } = resolveOAuthStatus(expiresAt, now, warnAfterMs);
    return {
      profileId,
      provider: credential.provider,
      type: 'token',
      status: status2,
      expiresAt,
      remainingMs: remainingMs2,
      source,
      label
    };
  }
  const hasRefreshToken = typeof credential.refresh === 'string' && credential.refresh.length > 0;
  const { status: rawStatus, remainingMs } = resolveOAuthStatus(
    credential.expires,
    now,
    warnAfterMs
  );
  const status = hasRefreshToken && (rawStatus === 'expired' || rawStatus === 'expiring') ? 'ok' : rawStatus;
  return {
    profileId,
    provider: credential.provider,
    type: 'oauth',
    status,
    expiresAt: credential.expires,
    remainingMs,
    source,
    label
  };
}
function buildAuthHealthSummary(params) {
  const now = Date.now();
  const warnAfterMs = params.warnAfterMs ?? DEFAULT_OAUTH_WARN_MS;
  const providerFilter = params.providers ? new Set(params.providers.map((p) => p.trim()).filter(Boolean)) : null;
  const profiles = Object.entries(params.store.profiles).filter(([/* _id */, cred]) => providerFilter ? providerFilter.has(cred.provider) : true).map(
    ([profileId, credential]) => buildProfileHealth({
      profileId,
      credential,
      store: params.store,
      cfg: params.cfg,
      now,
      warnAfterMs
    })
  ).toSorted((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.profileId.localeCompare(b.profileId);
  });
  const providersMap = /* @__PURE__ */ new Map();
  for (const profile of profiles) {
    const existing = providersMap.get(profile.provider);
    if (!existing) {
      providersMap.set(profile.provider, {
        provider: profile.provider,
        status: 'missing',
        profiles: [profile]
      });
    } else {
      existing.profiles.push(profile);
    }
  }
  if (providerFilter) {
    for (const provider of providerFilter) {
      if (!providersMap.has(provider)) {
        providersMap.set(provider, {
          provider,
          status: 'missing',
          profiles: []
        });
      }
    }
  }
  for (const provider of providersMap.values()) {
    if (provider.profiles.length === 0) {
      provider.status = 'missing';
      continue;
    }
    const oauthProfiles = provider.profiles.filter((p) => p.type === 'oauth');
    const tokenProfiles = provider.profiles.filter((p) => p.type === 'token');
    const apiKeyProfiles = provider.profiles.filter((p) => p.type === 'api_key');
    const expirable = [...oauthProfiles, ...tokenProfiles];
    if (expirable.length === 0) {
      provider.status = apiKeyProfiles.length > 0 ? 'static' : 'missing';
      continue;
    }
    const expiryCandidates = expirable.map((p) => p.expiresAt).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (expiryCandidates.length > 0) {
      provider.expiresAt = Math.min(...expiryCandidates);
      provider.remainingMs = provider.expiresAt - now;
    }
    const statuses = new Set(expirable.map((p) => p.status));
    if (statuses.has('expired') || statuses.has('missing')) {
      provider.status = 'expired';
    } else if (statuses.has('expiring')) {
      provider.status = 'expiring';
    } else {
      provider.status = 'ok';
    }
  }
  const providers = Array.from(providersMap.values()).toSorted(
    (a, b) => a.provider.localeCompare(b.provider)
  );
  return { now, warnAfterMs, profiles, providers };
}
export {
  DEFAULT_OAUTH_WARN_MS,
  buildAuthHealthSummary,
  formatRemainingShort,
  resolveAuthProfileSource
};
