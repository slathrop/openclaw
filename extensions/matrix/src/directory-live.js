import { resolveMatrixAuth } from './matrix/client.js';
async function fetchMatrixJson(params) {
  const res = await fetch(`${params.homeserver}${params.path}`, {
    method: params.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: params.body ? JSON.stringify(params.body) : void 0
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Matrix API ${params.path} failed (${res.status}): ${text || 'unknown error'}`);
  }
  return await res.json();
}
function normalizeQuery(value) {
  return value?.trim().toLowerCase() ?? '';
}
async function listMatrixDirectoryPeersLive(params) {
  const query = normalizeQuery(params.query);
  if (!query) {
    return [];
  }
  const auth = await resolveMatrixAuth({ cfg: params.cfg });
  const res = await fetchMatrixJson({
    homeserver: auth.homeserver,
    accessToken: auth.accessToken,
    path: '/_matrix/client/v3/user_directory/search',
    method: 'POST',
    body: {
      search_term: query,
      limit: typeof params.limit === 'number' && params.limit > 0 ? params.limit : 20
    }
  });
  const results = res.results ?? [];
  return results.map((entry) => {
    const userId = entry.user_id?.trim();
    if (!userId) {
      return null;
    }
    return {
      kind: 'user',
      id: userId,
      name: entry.display_name?.trim() || void 0,
      handle: entry.display_name ? `@${entry.display_name.trim()}` : void 0,
      raw: entry
    };
  }).filter(Boolean);
}
async function resolveMatrixRoomAlias(homeserver, accessToken, alias) {
  try {
    const res = await fetchMatrixJson({
      homeserver,
      accessToken,
      path: `/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`
    });
    return res.room_id?.trim() || null;
  } catch {
    return null;
  }
}
async function fetchMatrixRoomName(homeserver, accessToken, roomId) {
  try {
    const res = await fetchMatrixJson({
      homeserver,
      accessToken,
      path: `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`
    });
    return res.name?.trim() || null;
  } catch {
    return null;
  }
}
async function listMatrixDirectoryGroupsLive(params) {
  const query = normalizeQuery(params.query);
  if (!query) {
    return [];
  }
  const auth = await resolveMatrixAuth({ cfg: params.cfg });
  const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : 20;
  if (query.startsWith('#')) {
    const roomId = await resolveMatrixRoomAlias(auth.homeserver, auth.accessToken, query);
    if (!roomId) {
      return [];
    }
    return [
      {
        kind: 'group',
        id: roomId,
        name: query,
        handle: query
      }
    ];
  }
  if (query.startsWith('!')) {
    return [
      {
        kind: 'group',
        id: query,
        name: query
      }
    ];
  }
  const joined = await fetchMatrixJson({
    homeserver: auth.homeserver,
    accessToken: auth.accessToken,
    path: '/_matrix/client/v3/joined_rooms'
  });
  const rooms = joined.joined_rooms ?? [];
  const results = [];
  for (const roomId of rooms) {
    const name = await fetchMatrixRoomName(auth.homeserver, auth.accessToken, roomId);
    if (!name) {
      continue;
    }
    if (!name.toLowerCase().includes(query)) {
      continue;
    }
    results.push({
      kind: 'group',
      id: roomId,
      name,
      handle: `#${name}`
    });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}
export {
  listMatrixDirectoryGroupsLive,
  listMatrixDirectoryPeersLive
};
