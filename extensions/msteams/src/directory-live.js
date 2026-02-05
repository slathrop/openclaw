import { GRAPH_ROOT } from './attachments/shared.js';
import { loadMSTeamsSdkWithAuth } from './sdk.js';
import { resolveMSTeamsCredentials } from './token.js';
function readAccessToken(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const token = value.accessToken ?? value.token;
    return typeof token === 'string' ? token : null;
  }
  return null;
}
function normalizeQuery(value) {
  return value?.trim() ?? '';
}
function escapeOData(value) {
  return value.replace(/'/g, "''");
}
async function fetchGraphJson(params) {
  const res = await fetch(`${GRAPH_ROOT}${params.path}`, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      ...params.headers
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Graph ${params.path} failed (${res.status}): ${text || 'unknown error'}`);
  }
  return await res.json();
}
async function resolveGraphToken(cfg) {
  const creds = resolveMSTeamsCredentials(
    cfg?.channels?.msteams
  );
  if (!creds) {
    throw new Error('MS Teams credentials missing');
  }
  const { sdk, authConfig } = await loadMSTeamsSdkWithAuth(creds);
  const tokenProvider = new sdk.MsalTokenProvider(authConfig);
  const token = await tokenProvider.getAccessToken('https://graph.microsoft.com');
  const accessToken = readAccessToken(token);
  if (!accessToken) {
    throw new Error('MS Teams graph token unavailable');
  }
  return accessToken;
}
async function listTeamsByName(token, query) {
  const escaped = escapeOData(query);
  const filter = `resourceProvisioningOptions/Any(x:x eq 'Team') and startsWith(displayName,'${escaped}')`;
  const path = `/groups?$filter=${encodeURIComponent(filter)}&$select=id,displayName`;
  const res = await fetchGraphJson({ token, path });
  return res.value ?? [];
}
async function listChannelsForTeam(token, teamId) {
  const path = `/teams/${encodeURIComponent(teamId)}/channels?$select=id,displayName`;
  const res = await fetchGraphJson({ token, path });
  return res.value ?? [];
}
async function listMSTeamsDirectoryPeersLive(params) {
  const query = normalizeQuery(params.query);
  if (!query) {
    return [];
  }
  const token = await resolveGraphToken(params.cfg);
  const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : 20;
  let users = [];
  if (query.includes('@')) {
    const escaped = escapeOData(query);
    const filter = `(mail eq '${escaped}' or userPrincipalName eq '${escaped}')`;
    const path = `/users?$filter=${encodeURIComponent(filter)}&$select=id,displayName,mail,userPrincipalName`;
    const res = await fetchGraphJson({ token, path });
    users = res.value ?? [];
  } else {
    const path = `/users?$search=${encodeURIComponent(`"displayName:${query}"`)}&$select=id,displayName,mail,userPrincipalName&$top=${limit}`;
    const res = await fetchGraphJson({
      token,
      path,
      headers: { ConsistencyLevel: 'eventual' }
    });
    users = res.value ?? [];
  }
  return users.map((user) => {
    const id = user.id?.trim();
    if (!id) {
      return null;
    }
    const name = user.displayName?.trim();
    const handle = user.userPrincipalName?.trim() || user.mail?.trim();
    return {
      kind: 'user',
      id: `user:${id}`,
      name: name || void 0,
      handle: handle ? `@${handle}` : void 0,
      raw: user
    };
  }).filter(Boolean);
}
async function listMSTeamsDirectoryGroupsLive(params) {
  const rawQuery = normalizeQuery(params.query);
  if (!rawQuery) {
    return [];
  }
  const token = await resolveGraphToken(params.cfg);
  const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : 20;
  const [teamQuery, channelQuery] = rawQuery.includes('/') ? rawQuery.split('/', 2).map((part) => part.trim()).filter(Boolean) : [rawQuery, null];
  const teams = await listTeamsByName(token, teamQuery);
  const results = [];
  for (const team of teams) {
    const teamId = team.id?.trim();
    if (!teamId) {
      continue;
    }
    const teamName = team.displayName?.trim() || teamQuery;
    if (!channelQuery) {
      results.push({
        kind: 'group',
        id: `team:${teamId}`,
        name: teamName,
        handle: teamName ? `#${teamName}` : void 0,
        raw: team
      });
      if (results.length >= limit) {
        return results;
      }
      continue;
    }
    const channels = await listChannelsForTeam(token, teamId);
    for (const channel of channels) {
      const name = channel.displayName?.trim();
      if (!name) {
        continue;
      }
      if (!name.toLowerCase().includes(channelQuery.toLowerCase())) {
        continue;
      }
      results.push({
        kind: 'group',
        id: `conversation:${channel.id}`,
        name: `${teamName}/${name}`,
        handle: `#${name}`,
        raw: channel
      });
      if (results.length >= limit) {
        return results;
      }
    }
  }
  return results;
}
export {
  listMSTeamsDirectoryGroupsLive,
  listMSTeamsDirectoryPeersLive
};
