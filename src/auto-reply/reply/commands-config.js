import { resolveChannelConfigWrites } from '../../channels/plugins/config-writes.js';
import { normalizeChannelId } from '../../channels/registry.js';
import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  getConfigValueAtPath,
  parseConfigPath,
  setConfigValueAtPath,
  unsetConfigValueAtPath
} from '../../config/config-paths.js';
import {
  readConfigFileSnapshot,
  validateConfigObjectWithPlugins,
  writeConfigFile
} from '../../config/config.js';
import {
  getConfigOverrides,
  resetConfigOverrides,
  setConfigOverride,
  unsetConfigOverride
} from '../../config/runtime-overrides.js';
import { logVerbose } from '../../globals.js';
import { parseConfigCommand } from './config-commands.js';
import { parseDebugCommand } from './debug-commands.js';
const handleConfigCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const configCommand = parseConfigCommand(params.command.commandBodyNormalized);
  if (!configCommand) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /config from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  if (params.cfg.commands?.config !== true) {
    return {
      shouldContinue: false,
      reply: {
        text: '\u26A0\uFE0F /config is disabled. Set commands.config=true to enable.'
      }
    };
  }
  if (configCommand.action === 'error') {
    return {
      shouldContinue: false,
      reply: { text: `\u26A0\uFE0F ${configCommand.message}` }
    };
  }
  if (configCommand.action === 'set' || configCommand.action === 'unset') {
    const channelId = params.command.channelId ?? normalizeChannelId(params.command.channel);
    const allowWrites = resolveChannelConfigWrites({
      cfg: params.cfg,
      channelId,
      accountId: params.ctx.AccountId
    });
    if (!allowWrites) {
      const channelLabel = channelId ?? 'this channel';
      const hint = channelId ? `channels.${channelId}.configWrites=true` : 'channels.<channel>.configWrites=true';
      return {
        shouldContinue: false,
        reply: {
          text: `\u26A0\uFE0F Config writes are disabled for ${channelLabel}. Set ${hint} to enable.`
        }
      };
    }
  }
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid || !snapshot.parsed || typeof snapshot.parsed !== 'object') {
    return {
      shouldContinue: false,
      reply: {
        text: '\u26A0\uFE0F Config file is invalid; fix it before using /config.'
      }
    };
  }
  const parsedBase = structuredClone(snapshot.parsed);
  if (configCommand.action === 'show') {
    const pathRaw = configCommand.path?.trim();
    if (pathRaw) {
      const parsedPath = parseConfigPath(pathRaw);
      if (!parsedPath.ok || !parsedPath.path) {
        return {
          shouldContinue: false,
          reply: { text: `\u26A0\uFE0F ${parsedPath.error ?? 'Invalid path.'}` }
        };
      }
      const value = getConfigValueAtPath(parsedBase, parsedPath.path);
      const rendered = JSON.stringify(value ?? null, null, 2);
      return {
        shouldContinue: false,
        reply: {
          text: `\u2699\uFE0F Config ${pathRaw}:
\`\`\`json
${rendered}
\`\`\``
        }
      };
    }
    const json = JSON.stringify(parsedBase, null, 2);
    return {
      shouldContinue: false,
      reply: { text: `\u2699\uFE0F Config (raw):
\`\`\`json
${json}
\`\`\`` }
    };
  }
  if (configCommand.action === 'unset') {
    const parsedPath = parseConfigPath(configCommand.path);
    if (!parsedPath.ok || !parsedPath.path) {
      return {
        shouldContinue: false,
        reply: { text: `\u26A0\uFE0F ${parsedPath.error ?? 'Invalid path.'}` }
      };
    }
    const removed = unsetConfigValueAtPath(parsedBase, parsedPath.path);
    if (!removed) {
      return {
        shouldContinue: false,
        reply: { text: `\u2699\uFE0F No config value found for ${configCommand.path}.` }
      };
    }
    const validated = validateConfigObjectWithPlugins(parsedBase);
    if (!validated.ok) {
      const issue = validated.issues[0];
      return {
        shouldContinue: false,
        reply: {
          text: `\u26A0\uFE0F Config invalid after unset (${issue.path}: ${issue.message}).`
        }
      };
    }
    await writeConfigFile(validated.config);
    return {
      shouldContinue: false,
      reply: { text: `\u2699\uFE0F Config updated: ${configCommand.path} removed.` }
    };
  }
  if (configCommand.action === 'set') {
    const parsedPath = parseConfigPath(configCommand.path);
    if (!parsedPath.ok || !parsedPath.path) {
      return {
        shouldContinue: false,
        reply: { text: `\u26A0\uFE0F ${parsedPath.error ?? 'Invalid path.'}` }
      };
    }
    setConfigValueAtPath(parsedBase, parsedPath.path, configCommand.value);
    const validated = validateConfigObjectWithPlugins(parsedBase);
    if (!validated.ok) {
      const issue = validated.issues[0];
      return {
        shouldContinue: false,
        reply: {
          text: `\u26A0\uFE0F Config invalid after set (${issue.path}: ${issue.message}).`
        }
      };
    }
    await writeConfigFile(validated.config);
    const valueLabel = typeof configCommand.value === 'string' ? `"${configCommand.value}"` : JSON.stringify(configCommand.value);
    return {
      shouldContinue: false,
      reply: {
        text: `\u2699\uFE0F Config updated: ${configCommand.path}=${valueLabel ?? 'null'}`
      }
    };
  }
  return null;
};
const handleDebugCommand = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const debugCommand = parseDebugCommand(params.command.commandBodyNormalized);
  if (!debugCommand) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /debug from unauthorized sender: ${params.command.senderId || '<unknown>'}`
    );
    return { shouldContinue: false };
  }
  if (params.cfg.commands?.debug !== true) {
    return {
      shouldContinue: false,
      reply: {
        text: '\u26A0\uFE0F /debug is disabled. Set commands.debug=true to enable.'
      }
    };
  }
  if (debugCommand.action === 'error') {
    return {
      shouldContinue: false,
      reply: { text: `\u26A0\uFE0F ${debugCommand.message}` }
    };
  }
  if (debugCommand.action === 'show') {
    const overrides = getConfigOverrides();
    const hasOverrides = Object.keys(overrides).length > 0;
    if (!hasOverrides) {
      return {
        shouldContinue: false,
        reply: { text: '\u2699\uFE0F Debug overrides: (none)' }
      };
    }
    const json = JSON.stringify(overrides, null, 2);
    return {
      shouldContinue: false,
      reply: {
        text: `\u2699\uFE0F Debug overrides (memory-only):
\`\`\`json
${json}
\`\`\``
      }
    };
  }
  if (debugCommand.action === 'reset') {
    resetConfigOverrides();
    return {
      shouldContinue: false,
      reply: { text: '\u2699\uFE0F Debug overrides cleared; using config on disk.' }
    };
  }
  if (debugCommand.action === 'unset') {
    const result = unsetConfigOverride(debugCommand.path);
    if (!result.ok) {
      return {
        shouldContinue: false,
        reply: { text: `\u26A0\uFE0F ${result.error ?? 'Invalid path.'}` }
      };
    }
    if (!result.removed) {
      return {
        shouldContinue: false,
        reply: {
          text: `\u2699\uFE0F No debug override found for ${debugCommand.path}.`
        }
      };
    }
    return {
      shouldContinue: false,
      reply: { text: `\u2699\uFE0F Debug override removed for ${debugCommand.path}.` }
    };
  }
  if (debugCommand.action === 'set') {
    const result = setConfigOverride(debugCommand.path, debugCommand.value);
    if (!result.ok) {
      return {
        shouldContinue: false,
        reply: { text: `\u26A0\uFE0F ${result.error ?? 'Invalid override.'}` }
      };
    }
    const valueLabel = typeof debugCommand.value === 'string' ? `"${debugCommand.value}"` : JSON.stringify(debugCommand.value);
    return {
      shouldContinue: false,
      reply: {
        text: `\u2699\uFE0F Debug override set: ${debugCommand.path}=${valueLabel ?? 'null'}`
      }
    };
  }
  return null;
};
export {
  handleConfigCommand,
  handleDebugCommand
};
