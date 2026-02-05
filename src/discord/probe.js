import { resolveFetch } from '../infra/fetch.js';
import { normalizeDiscordToken } from './token.js';
const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_APP_FLAG_GATEWAY_PRESENCE = 1 << 12;
const DISCORD_APP_FLAG_GATEWAY_PRESENCE_LIMITED = 1 << 13;
const DISCORD_APP_FLAG_GATEWAY_GUILD_MEMBERS = 1 << 14;
const DISCORD_APP_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED = 1 << 15;
const DISCORD_APP_FLAG_GATEWAY_MESSAGE_CONTENT = 1 << 18;
const DISCORD_APP_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED = 1 << 19;
function resolveDiscordPrivilegedIntentsFromFlags(flags) {
  const resolve = (enabledBit, limitedBit) => {
    if ((flags & enabledBit) !== 0) {
      return 'enabled';
    }
    if ((flags & limitedBit) !== 0) {
      return 'limited';
    }
    return 'disabled';
  };
  return {
    presence: resolve(DISCORD_APP_FLAG_GATEWAY_PRESENCE, DISCORD_APP_FLAG_GATEWAY_PRESENCE_LIMITED),
    guildMembers: resolve(
      DISCORD_APP_FLAG_GATEWAY_GUILD_MEMBERS,
      DISCORD_APP_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED
    ),
    messageContent: resolve(
      DISCORD_APP_FLAG_GATEWAY_MESSAGE_CONTENT,
      DISCORD_APP_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED
    )
  };
}
async function fetchDiscordApplicationSummary(token, timeoutMs, fetcher = fetch) {
  const normalized = normalizeDiscordToken(token);
  if (!normalized) {
    return void 0;
  }
  try {
    const res = await fetchWithTimeout(
      `${DISCORD_API_BASE}/oauth2/applications/@me`,
      timeoutMs,
      fetcher,
      {
        Authorization: `Bot ${normalized}`
      }
    );
    if (!res.ok) {
      return void 0;
    }
    const json = await res.json();
    const flags = typeof json.flags === 'number' && Number.isFinite(json.flags) ? json.flags : void 0;
    return {
      id: json.id ?? null,
      flags: flags ?? null,
      intents: typeof flags === 'number' ? resolveDiscordPrivilegedIntentsFromFlags(flags) : void 0
    };
  } catch {
    return void 0;
  }
}
async function fetchWithTimeout(url, timeoutMs, fetcher, headers) {
  const fetchImpl = resolveFetch(fetcher);
  if (!fetchImpl) {
    throw new Error('fetch is not available');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}
async function probeDiscord(token, timeoutMs, opts) {
  const started = Date.now();
  const fetcher = opts?.fetcher ?? fetch;
  const includeApplication = opts?.includeApplication === true;
  const normalized = normalizeDiscordToken(token);
  const result = {
    ok: false,
    status: null,
    error: null,
    elapsedMs: 0
  };
  if (!normalized) {
    return {
      ...result,
      error: 'missing token',
      elapsedMs: Date.now() - started
    };
  }
  try {
    const res = await fetchWithTimeout(`${DISCORD_API_BASE}/users/@me`, timeoutMs, fetcher, {
      Authorization: `Bot ${normalized}`
    });
    if (!res.ok) {
      result.status = res.status;
      result.error = `getMe failed (${res.status})`;
      return { ...result, elapsedMs: Date.now() - started };
    }
    const json = await res.json();
    result.ok = true;
    result.bot = {
      id: json.id ?? null,
      username: json.username ?? null
    };
    if (includeApplication) {
      result.application = await fetchDiscordApplicationSummary(normalized, timeoutMs, fetcher) ?? void 0;
    }
    return { ...result, elapsedMs: Date.now() - started };
  } catch (err) {
    return {
      ...result,
      status: err instanceof Response ? err.status : result.status,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started
    };
  }
}
async function fetchDiscordApplicationId(token, timeoutMs, fetcher = fetch) {
  const normalized = normalizeDiscordToken(token);
  if (!normalized) {
    return void 0;
  }
  try {
    const res = await fetchWithTimeout(
      `${DISCORD_API_BASE}/oauth2/applications/@me`,
      timeoutMs,
      fetcher,
      {
        Authorization: `Bot ${normalized}`
      }
    );
    if (!res.ok) {
      return void 0;
    }
    const json = await res.json();
    return json.id ?? void 0;
  } catch {
    return void 0;
  }
}
export {
  fetchDiscordApplicationId,
  fetchDiscordApplicationSummary,
  probeDiscord,
  resolveDiscordPrivilegedIntentsFromFlags
};
