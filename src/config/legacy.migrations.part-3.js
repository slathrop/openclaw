/**
 * Legacy config migrations -- Part 3: auth, tools, and agent defaults.
 *
 * Handles late-stage migrations:
 * - auth.profiles anthropic:claude-cli mode token -> oauth
 * - tools.bash -> tools.exec
 * - messages.tts.enabled -> messages.tts.auto
 * - agent.* -> agents.defaults + tools.* (agent config restructuring)
 * - identity -> agents.list[].identity
 *
 * These migrations run after Part 1 and Part 2 have already restructured
 * channels and routing, so they can safely reference the new locations.
 */
import {
  ensureAgentEntry,
  ensureRecord,
  getAgentsList,
  getRecord,
  isRecord,
  mergeMissing,
  resolveDefaultAgentIdFromRaw
} from './legacy.shared.js';

// NOTE: tools.alsoAllow was introduced after legacy migrations; no legacy migration needed.

// tools.alsoAllow legacy migration intentionally omitted (field not shipped in prod).

/** @type {import('./legacy.shared.js').LegacyConfigMigration[]} */
export const LEGACY_CONFIG_MIGRATIONS_PART_3 = [
  {
    id: 'auth.anthropic-claude-cli-mode-oauth',
    describe: 'Switch anthropic:claude-cli auth profile mode to oauth',
    apply: (raw, changes) => {
      const auth = getRecord(raw.auth);
      const profiles = getRecord(auth?.profiles);
      if (!profiles) {
        return;
      }
      const claudeCli = getRecord(profiles['anthropic:claude-cli']);
      if (!claudeCli) {
        return;
      }
      if (claudeCli.mode !== 'token') {
        return;
      }
      claudeCli.mode = 'oauth';
      changes.push('Updated auth.profiles["anthropic:claude-cli"].mode \u2192 "oauth".');
    }
  },
  // tools.alsoAllow migration removed (field not shipped in prod; enforce via schema instead).
  {
    id: 'tools.bash->tools.exec',
    describe: 'Move tools.bash to tools.exec',
    apply: (raw, changes) => {
      const tools = ensureRecord(raw, 'tools');
      const bash = getRecord(tools.bash);
      if (!bash) {
        return;
      }
      if (tools.exec === undefined) {
        tools.exec = bash;
        changes.push('Moved tools.bash \u2192 tools.exec.');
      } else {
        changes.push('Removed tools.bash (tools.exec already set).');
      }
      delete tools.bash;
    }
  },
  {
    id: 'messages.tts.enabled->auto',
    describe: 'Move messages.tts.enabled to messages.tts.auto',
    apply: (raw, changes) => {
      const messages = getRecord(raw.messages);
      const tts = getRecord(messages?.tts);
      if (!tts) {
        return;
      }
      if (tts.auto !== undefined) {
        if ('enabled' in tts) {
          delete tts.enabled;
          changes.push('Removed messages.tts.enabled (messages.tts.auto already set).');
        }
        return;
      }
      if (typeof tts.enabled !== 'boolean') {
        return;
      }
      tts.auto = tts.enabled ? 'always' : 'off';
      delete tts.enabled;
      changes.push(`Moved messages.tts.enabled \u2192 messages.tts.auto (${String(tts.auto)}).`);
    }
  },
  {
    id: 'agent.defaults-v2',
    describe: 'Move agent config to agents.defaults and tools',
    apply: (raw, changes) => {
      const agent = getRecord(raw.agent);
      if (!agent) {
        return;
      }

      const agents = ensureRecord(raw, 'agents');
      const defaults = getRecord(agents.defaults) ?? {};
      const tools = ensureRecord(raw, 'tools');

      const agentTools = getRecord(agent.tools);
      if (agentTools) {
        if (tools.allow === undefined && agentTools.allow !== undefined) {
          tools.allow = agentTools.allow;
          changes.push('Moved agent.tools.allow \u2192 tools.allow.');
        }
        if (tools.deny === undefined && agentTools.deny !== undefined) {
          tools.deny = agentTools.deny;
          changes.push('Moved agent.tools.deny \u2192 tools.deny.');
        }
      }

      const elevated = getRecord(agent.elevated);
      if (elevated) {
        if (tools.elevated === undefined) {
          tools.elevated = elevated;
          changes.push('Moved agent.elevated \u2192 tools.elevated.');
        } else {
          changes.push('Removed agent.elevated (tools.elevated already set).');
        }
      }

      const bash = getRecord(agent.bash);
      if (bash) {
        if (tools.exec === undefined) {
          tools.exec = bash;
          changes.push('Moved agent.bash \u2192 tools.exec.');
        } else {
          changes.push('Removed agent.bash (tools.exec already set).');
        }
      }

      const sandbox = getRecord(agent.sandbox);
      if (sandbox) {
        const sandboxTools = getRecord(sandbox.tools);
        if (sandboxTools) {
          const toolsSandbox = ensureRecord(tools, 'sandbox');
          const toolPolicy = ensureRecord(toolsSandbox, 'tools');
          mergeMissing(toolPolicy, sandboxTools);
          delete sandbox.tools;
          changes.push('Moved agent.sandbox.tools \u2192 tools.sandbox.tools.');
        }
      }

      const subagents = getRecord(agent.subagents);
      if (subagents) {
        const subagentTools = getRecord(subagents.tools);
        if (subagentTools) {
          const toolsSubagents = ensureRecord(tools, 'subagents');
          const toolPolicy = ensureRecord(toolsSubagents, 'tools');
          mergeMissing(toolPolicy, subagentTools);
          delete subagents.tools;
          changes.push('Moved agent.subagents.tools \u2192 tools.subagents.tools.');
        }
      }

      const agentCopy = structuredClone(agent);
      delete agentCopy.tools;
      delete agentCopy.elevated;
      delete agentCopy.bash;
      if (isRecord(agentCopy.sandbox)) {
        delete agentCopy.sandbox.tools;
      }
      if (isRecord(agentCopy.subagents)) {
        delete agentCopy.subagents.tools;
      }

      mergeMissing(defaults, agentCopy);
      agents.defaults = defaults;
      raw.agents = agents;
      delete raw.agent;
      changes.push('Moved agent \u2192 agents.defaults.');
    }
  },
  {
    id: 'identity->agents.list',
    describe: 'Move identity to agents.list[].identity',
    apply: (raw, changes) => {
      const identity = getRecord(raw.identity);
      if (!identity) {
        return;
      }

      const agents = ensureRecord(raw, 'agents');
      const list = getAgentsList(agents);
      const defaultId = resolveDefaultAgentIdFromRaw(raw);
      const entry = ensureAgentEntry(list, defaultId);
      if (entry.identity === undefined) {
        entry.identity = identity;
        changes.push(`Moved identity \u2192 agents.list (id "${defaultId}").identity.`);
      } else {
        changes.push('Removed identity (agents.list identity already set).');
      }
      agents.list = list;
      raw.agents = agents;
      delete raw.identity;
    }
  }
];
