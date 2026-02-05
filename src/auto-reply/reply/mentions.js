import { resolveAgentConfig } from '../../agents/agent-scope.js';
import { getChannelDock } from '../../channels/dock.js';
import { normalizeChannelId } from '../../channels/plugins/index.js';
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function deriveMentionPatterns(identity) {
  const patterns = [];
  const name = identity?.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean).map(escapeRegExp);
    const re = parts.length ? parts.join(String.raw`\s+`) : escapeRegExp(name);
    patterns.push(String.raw`\b@?${re}\b`);
  }
  const emoji = identity?.emoji?.trim();
  if (emoji) {
    patterns.push(escapeRegExp(emoji));
  }
  return patterns;
}
const BACKSPACE_CHAR = '\b';
const CURRENT_MESSAGE_MARKER = '[Current message - respond to this]';
function normalizeMentionPattern(pattern) {
  if (!pattern.includes(BACKSPACE_CHAR)) {
    return pattern;
  }
  return pattern.split(BACKSPACE_CHAR).join('\\b');
}
function normalizeMentionPatterns(patterns) {
  return patterns.map(normalizeMentionPattern);
}
function resolveMentionPatterns(cfg, agentId) {
  if (!cfg) {
    return [];
  }
  const agentConfig = agentId ? resolveAgentConfig(cfg, agentId) : void 0;
  const agentGroupChat = agentConfig?.groupChat;
  if (agentGroupChat && Object.hasOwn(agentGroupChat, 'mentionPatterns')) {
    return agentGroupChat.mentionPatterns ?? [];
  }
  const globalGroupChat = cfg.messages?.groupChat;
  if (globalGroupChat && Object.hasOwn(globalGroupChat, 'mentionPatterns')) {
    return globalGroupChat.mentionPatterns ?? [];
  }
  const derived = deriveMentionPatterns(agentConfig?.identity);
  return derived.length > 0 ? derived : [];
}
function buildMentionRegexes(cfg, agentId) {
  const patterns = normalizeMentionPatterns(resolveMentionPatterns(cfg, agentId));
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, 'i');
    } catch {
      return null;
    }
  }).filter((value) => Boolean(value));
}
function normalizeMentionText(text) {
  return (text ?? '').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').toLowerCase();
}
function matchesMentionPatterns(text, mentionRegexes) {
  if (mentionRegexes.length === 0) {
    return false;
  }
  const cleaned = normalizeMentionText(text ?? '');
  if (!cleaned) {
    return false;
  }
  return mentionRegexes.some((re) => re.test(cleaned));
}
function matchesMentionWithExplicit(params) {
  const cleaned = normalizeMentionText(params.text ?? '');
  const explicit = params.explicit?.isExplicitlyMentioned === true;
  const explicitAvailable = params.explicit?.canResolveExplicit === true;
  const hasAnyMention = params.explicit?.hasAnyMention === true;
  if (hasAnyMention && explicitAvailable) {
    return explicit || params.mentionRegexes.some((re) => re.test(cleaned));
  }
  if (!cleaned) {
    return explicit;
  }
  return explicit || params.mentionRegexes.some((re) => re.test(cleaned));
}
function stripStructuralPrefixes(text) {
  const afterMarker = text.includes(CURRENT_MESSAGE_MARKER) ? text.slice(text.indexOf(CURRENT_MESSAGE_MARKER) + CURRENT_MESSAGE_MARKER.length).trimStart() : text;
  return afterMarker.replace(/\[[^\]]+\]\s*/g, '').replace(/^[ \t]*[A-Za-z0-9+()\-_. ]+:\s*/gm, '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}
function stripMentions(text, ctx, cfg, agentId) {
  let result = text;
  const providerId = ctx.Provider ? normalizeChannelId(ctx.Provider) : null;
  const providerMentions = providerId ? getChannelDock(providerId)?.mentions : void 0;
  const patterns = normalizeMentionPatterns([
    ...resolveMentionPatterns(cfg, agentId),
    ...providerMentions?.stripPatterns?.({ ctx, cfg, agentId }) ?? []
  ]);
  for (const p of patterns) {
    try {
      const re = new RegExp(p, 'gi');
      result = result.replace(re, ' ');
    } catch {
      // Intentionally ignored
    }
  }
  if (providerMentions?.stripMentions) {
    result = providerMentions.stripMentions({
      text: result,
      ctx,
      cfg,
      agentId
    });
  }
  result = result.replace(/@[0-9+]{5,}/g, ' ');
  return result.replace(/\s+/g, ' ').trim();
}
export {
  CURRENT_MESSAGE_MARKER,
  buildMentionRegexes,
  matchesMentionPatterns,
  matchesMentionWithExplicit,
  normalizeMentionText,
  stripMentions,
  stripStructuralPrefixes
};
