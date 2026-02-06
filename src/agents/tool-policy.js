/**
 * @module tool-policy
 * Tool access policy compilation, matching, and profile resolution.
 */
const TOOL_NAME_ALIASES = {
  bash: 'exec',
  'apply-patch': 'apply_patch'
};
const TOOL_GROUPS = {
  // NOTE: Keep canonical (lowercase) tool names here.
  'group:memory': ['memory_search', 'memory_get'],
  'group:web': ['web_search', 'web_fetch'],
  // Basic workspace/file tools
  'group:fs': ['read', 'write', 'edit', 'apply_patch'],
  // Host/runtime execution tools
  'group:runtime': ['exec', 'process'],
  // Session management tools
  'group:sessions': [
    'sessions_list',
    'sessions_history',
    'sessions_send',
    'sessions_spawn',
    'session_status'
  ],
  // UI helpers
  'group:ui': ['browser', 'canvas'],
  // Automation + infra
  'group:automation': ['cron', 'gateway'],
  // Messaging surface
  'group:messaging': ['message'],
  // Nodes + device tools
  'group:nodes': ['nodes'],
  // All OpenClaw native tools (excludes provider plugins).
  'group:openclaw': [
    'browser',
    'canvas',
    'nodes',
    'cron',
    'message',
    'gateway',
    'agents_list',
    'sessions_list',
    'sessions_history',
    'sessions_send',
    'sessions_spawn',
    'session_status',
    'memory_search',
    'memory_get',
    'web_search',
    'web_fetch',
    'image'
  ]
};
const TOOL_PROFILES = {
  minimal: {
    allow: ['session_status']
  },
  coding: {
    allow: ['group:fs', 'group:runtime', 'group:sessions', 'group:memory', 'image']
  },
  messaging: {
    allow: [
      'group:messaging',
      'sessions_list',
      'sessions_history',
      'sessions_send',
      'session_status'
    ]
  },
  full: {}
};
const OWNER_ONLY_TOOL_NAMES = new Set(['whatsapp_login']);
function normalizeToolName(name) {
  const normalized = name.trim().toLowerCase();
  return TOOL_NAME_ALIASES[normalized] ?? normalized;
}
function isOwnerOnlyToolName(name) {
  return OWNER_ONLY_TOOL_NAMES.has(normalizeToolName(name));
}
function applyOwnerOnlyToolPolicy(tools, senderIsOwner) {
  const withGuard = tools.map((tool) => {
    if (!isOwnerOnlyToolName(tool.name)) {
      return tool;
    }
    if (senderIsOwner || !tool.execute) {
      return tool;
    }
    return {
      ...tool,
      execute: async () => {
        throw new Error('Tool restricted to owner senders.');
      }
    };
  });
  if (senderIsOwner) {
    return withGuard;
  }
  return withGuard.filter((tool) => !isOwnerOnlyToolName(tool.name));
}
function normalizeToolList(list) {
  if (!list) {
    return [];
  }
  return list.map(normalizeToolName).filter(Boolean);
}
function expandToolGroups(list) {
  const normalized = normalizeToolList(list);
  const expanded = [];
  for (const value of normalized) {
    const group = TOOL_GROUPS[value];
    if (group) {
      expanded.push(...group);
      continue;
    }
    expanded.push(value);
  }
  return Array.from(new Set(expanded));
}
function collectExplicitAllowlist(policies) {
  const entries = [];
  for (const policy of policies) {
    if (!policy?.allow) {
      continue;
    }
    for (const value of policy.allow) {
      if (typeof value !== 'string') {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed) {
        entries.push(trimmed);
      }
    }
  }
  return entries;
}
function buildPluginToolGroups(params) {
  const all = [];
  const byPlugin = /* @__PURE__ */ new Map();
  for (const tool of params.tools) {
    const meta = params.toolMeta(tool);
    if (!meta) {
      continue;
    }
    const name = normalizeToolName(tool.name);
    all.push(name);
    const pluginId = meta.pluginId.toLowerCase();
    const list = byPlugin.get(pluginId) ?? [];
    list.push(name);
    byPlugin.set(pluginId, list);
  }
  return { all, byPlugin };
}
function expandPluginGroups(list, groups) {
  if (!list || list.length === 0) {
    return list;
  }
  const expanded = [];
  for (const entry of list) {
    const normalized = normalizeToolName(entry);
    if (normalized === 'group:plugins') {
      if (groups.all.length > 0) {
        expanded.push(...groups.all);
      } else {
        expanded.push(normalized);
      }
      continue;
    }
    const tools = groups.byPlugin.get(normalized);
    if (tools && tools.length > 0) {
      expanded.push(...tools);
      continue;
    }
    expanded.push(normalized);
  }
  return Array.from(new Set(expanded));
}
function expandPolicyWithPluginGroups(policy, groups) {
  if (!policy) {
    return void 0;
  }
  return {
    allow: expandPluginGroups(policy.allow, groups),
    deny: expandPluginGroups(policy.deny, groups)
  };
}
function stripPluginOnlyAllowlist(policy, groups, coreTools) {
  if (!policy?.allow || policy.allow.length === 0) {
    return { policy, unknownAllowlist: [], strippedAllowlist: false };
  }
  const normalized = normalizeToolList(policy.allow);
  if (normalized.length === 0) {
    return { policy, unknownAllowlist: [], strippedAllowlist: false };
  }
  const pluginIds = new Set(groups.byPlugin.keys());
  const pluginTools = new Set(groups.all);
  const unknownAllowlist = [];
  let hasCoreEntry = false;
  for (const entry of normalized) {
    if (entry === '*') {
      hasCoreEntry = true;
      continue;
    }
    const isPluginEntry = entry === 'group:plugins' || pluginIds.has(entry) || pluginTools.has(entry);
    const expanded = expandToolGroups([entry]);
    const isCoreEntry = expanded.some((tool) => coreTools.has(tool));
    if (isCoreEntry) {
      hasCoreEntry = true;
    }
    if (!isCoreEntry && !isPluginEntry) {
      unknownAllowlist.push(entry);
    }
  }
  const strippedAllowlist = !hasCoreEntry;
  if (strippedAllowlist) {
    /* allowlist entries stripped -- no user-defined entries remain */
  }
  return {
    policy: strippedAllowlist ? { ...policy, allow: void 0 } : policy,
    unknownAllowlist: Array.from(new Set(unknownAllowlist)),
    strippedAllowlist
  };
}
function resolveToolProfilePolicy(profile) {
  if (!profile) {
    return void 0;
  }
  const resolved = TOOL_PROFILES[profile];
  if (!resolved) {
    return void 0;
  }
  if (!resolved.allow && !resolved.deny) {
    return void 0;
  }
  return {
    allow: resolved.allow ? [...resolved.allow] : void 0,
    deny: resolved.deny ? [...resolved.deny] : void 0
  };
}
export {
  TOOL_GROUPS,
  applyOwnerOnlyToolPolicy,
  buildPluginToolGroups,
  collectExplicitAllowlist,
  expandPluginGroups,
  expandPolicyWithPluginGroups,
  expandToolGroups,
  isOwnerOnlyToolName,
  normalizeToolList,
  normalizeToolName,
  resolveToolProfilePolicy,
  stripPluginOnlyAllowlist
};
