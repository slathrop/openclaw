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
function stripProviderPrefix(raw) {
  return raw.replace(/^(msteams|teams):/i, '');
}
function normalizeMSTeamsMessagingTarget(raw) {
  let trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  trimmed = stripProviderPrefix(trimmed).trim();
  if (/^conversation:/i.test(trimmed)) {
    const id = trimmed.slice('conversation:'.length).trim();
    return id ? `conversation:${id}` : void 0;
  }
  if (/^user:/i.test(trimmed)) {
    const id = trimmed.slice('user:'.length).trim();
    return id ? `user:${id}` : void 0;
  }
  return trimmed || void 0;
}
function normalizeMSTeamsUserInput(raw) {
  return stripProviderPrefix(raw).replace(/^(user|conversation):/i, '').trim();
}
function parseMSTeamsConversationId(raw) {
  const trimmed = stripProviderPrefix(raw).trim();
  if (!/^conversation:/i.test(trimmed)) {
    return null;
  }
  const id = trimmed.slice('conversation:'.length).trim();
  return id;
}
function normalizeMSTeamsTeamKey(raw) {
  const trimmed = stripProviderPrefix(raw).replace(/^team:/i, '').trim();
  return trimmed || void 0;
}
function normalizeMSTeamsChannelKey(raw) {
  const trimmed = raw?.trim().replace(/^#/, '').trim() ?? '';
  return trimmed || void 0;
}
function parseMSTeamsTeamChannelInput(raw) {
  const trimmed = stripProviderPrefix(raw).trim();
  if (!trimmed) {
    return {};
  }
  const parts = trimmed.split('/');
  const team = normalizeMSTeamsTeamKey(parts[0] ?? '');
  const channel = parts.length > 1 ? normalizeMSTeamsChannelKey(parts.slice(1).join('/')) : void 0;
  return {
    ...team ? { team } : {},
    ...channel ? { channel } : {}
  };
}
function parseMSTeamsTeamEntry(raw) {
  const { team, channel } = parseMSTeamsTeamChannelInput(raw);
  if (!team) {
    return null;
  }
  return {
    teamKey: team,
    ...channel ? { channelKey: channel } : {}
  };
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
async function resolveMSTeamsChannelAllowlist(params) {
  const token = await resolveGraphToken(params.cfg);
  const results = [];
  for (const input of params.entries) {
    const { team, channel } = parseMSTeamsTeamChannelInput(input);
    if (!team) {
      results.push({ input, resolved: false });
      continue;
    }
    const teams = /^[0-9a-fA-F-]{16,}$/.test(team) ? [{ id: team, displayName: team }] : await listTeamsByName(token, team);
    if (teams.length === 0) {
      results.push({ input, resolved: false, note: 'team not found' });
      continue;
    }
    const teamMatch = teams[0];
    const teamId = teamMatch.id?.trim();
    const teamName = teamMatch.displayName?.trim() || team;
    if (!teamId) {
      results.push({ input, resolved: false, note: 'team id missing' });
      continue;
    }
    if (!channel) {
      results.push({
        input,
        resolved: true,
        teamId,
        teamName,
        note: teams.length > 1 ? 'multiple teams; chose first' : void 0
      });
      continue;
    }
    const channels = await listChannelsForTeam(token, teamId);
    const channelMatch = channels.find((item) => item.id === channel) ?? channels.find((item) => item.displayName?.toLowerCase() === channel.toLowerCase()) ?? channels.find(
      (item) => item.displayName?.toLowerCase().includes(channel.toLowerCase() ?? '')
    );
    if (!channelMatch?.id) {
      results.push({ input, resolved: false, note: 'channel not found' });
      continue;
    }
    results.push({
      input,
      resolved: true,
      teamId,
      teamName,
      channelId: channelMatch.id,
      channelName: channelMatch.displayName ?? channel,
      note: channels.length > 1 ? 'multiple channels; chose first' : void 0
    });
  }
  return results;
}
async function resolveMSTeamsUserAllowlist(params) {
  const token = await resolveGraphToken(params.cfg);
  const results = [];
  for (const input of params.entries) {
    const query = normalizeQuery(normalizeMSTeamsUserInput(input));
    if (!query) {
      results.push({ input, resolved: false });
      continue;
    }
    if (/^[0-9a-fA-F-]{16,}$/.test(query)) {
      results.push({ input, resolved: true, id: query });
      continue;
    }
    let users = [];
    if (query.includes('@')) {
      const escaped = escapeOData(query);
      const filter = `(mail eq '${escaped}' or userPrincipalName eq '${escaped}')`;
      const path = `/users?$filter=${encodeURIComponent(filter)}&$select=id,displayName,mail,userPrincipalName`;
      const res = await fetchGraphJson({ token, path });
      users = res.value ?? [];
    } else {
      const path = `/users?$search=${encodeURIComponent(`"displayName:${query}"`)}&$select=id,displayName,mail,userPrincipalName&$top=10`;
      const res = await fetchGraphJson({
        token,
        path,
        headers: { ConsistencyLevel: 'eventual' }
      });
      users = res.value ?? [];
    }
    const match = users[0];
    if (!match?.id) {
      results.push({ input, resolved: false });
      continue;
    }
    results.push({
      input,
      resolved: true,
      id: match.id,
      name: match.displayName ?? void 0,
      note: users.length > 1 ? 'multiple matches; chose first' : void 0
    });
  }
  return results;
}
export {
  normalizeMSTeamsMessagingTarget,
  normalizeMSTeamsUserInput,
  parseMSTeamsConversationId,
  parseMSTeamsTeamChannelInput,
  parseMSTeamsTeamEntry,
  resolveMSTeamsChannelAllowlist,
  resolveMSTeamsUserAllowlist
};
