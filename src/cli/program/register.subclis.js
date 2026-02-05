const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { isTruthyEnvValue } from '../../infra/env.js';
import { buildParseArgv, getPrimaryCommand, hasHelpOrVersion } from '../argv.js';
import { resolveActionArgs } from './helpers.js';
const shouldRegisterPrimaryOnly = /* @__PURE__ */ __name((argv) => {
  if (isTruthyEnvValue(process.env.OPENCLAW_DISABLE_LAZY_SUBCOMMANDS)) {
    return false;
  }
  if (hasHelpOrVersion(argv)) {
    return false;
  }
  return true;
}, 'shouldRegisterPrimaryOnly');
// eslint-disable-next-line no-unused-vars
const shouldEagerRegisterSubcommands = /* @__PURE__ */ __name((_argv) => {
  return isTruthyEnvValue(process.env.OPENCLAW_DISABLE_LAZY_SUBCOMMANDS);
}, 'shouldEagerRegisterSubcommands');
const loadConfig = /* @__PURE__ */ __name(async () => {
  const mod = await import('../../config/config.js');
  return mod.loadConfig();
}, 'loadConfig');
const entries = [
  {
    name: 'acp',
    description: 'Agent Control Protocol tools',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../acp-cli.js');
      mod.registerAcpCli(program);
    }, 'register')
  },
  {
    name: 'gateway',
    description: 'Gateway control',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../gateway-cli.js');
      mod.registerGatewayCli(program);
    }, 'register')
  },
  {
    name: 'daemon',
    description: 'Gateway service (legacy alias)',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../daemon-cli.js');
      mod.registerDaemonCli(program);
    }, 'register')
  },
  {
    name: 'logs',
    description: 'Gateway logs',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../logs-cli.js');
      mod.registerLogsCli(program);
    }, 'register')
  },
  {
    name: 'system',
    description: 'System events, heartbeat, and presence',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../system-cli.js');
      mod.registerSystemCli(program);
    }, 'register')
  },
  {
    name: 'models',
    description: 'Model configuration',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../models-cli.js');
      mod.registerModelsCli(program);
    }, 'register')
  },
  {
    name: 'approvals',
    description: 'Exec approvals',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../exec-approvals-cli.js');
      mod.registerExecApprovalsCli(program);
    }, 'register')
  },
  {
    name: 'nodes',
    description: 'Node commands',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../nodes-cli.js');
      mod.registerNodesCli(program);
    }, 'register')
  },
  {
    name: 'devices',
    description: 'Device pairing + token management',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../devices-cli.js');
      mod.registerDevicesCli(program);
    }, 'register')
  },
  {
    name: 'node',
    description: 'Node control',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../node-cli.js');
      mod.registerNodeCli(program);
    }, 'register')
  },
  {
    name: 'sandbox',
    description: 'Sandbox tools',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../sandbox-cli.js');
      mod.registerSandboxCli(program);
    }, 'register')
  },
  {
    name: 'tui',
    description: 'Terminal UI',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../tui-cli.js');
      mod.registerTuiCli(program);
    }, 'register')
  },
  {
    name: 'cron',
    description: 'Cron scheduler',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../cron-cli.js');
      mod.registerCronCli(program);
    }, 'register')
  },
  {
    name: 'dns',
    description: 'DNS helpers',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../dns-cli.js');
      mod.registerDnsCli(program);
    }, 'register')
  },
  {
    name: 'docs',
    description: 'Docs helpers',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../docs-cli.js');
      mod.registerDocsCli(program);
    }, 'register')
  },
  {
    name: 'hooks',
    description: 'Hooks tooling',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../hooks-cli.js');
      mod.registerHooksCli(program);
    }, 'register')
  },
  {
    name: 'webhooks',
    description: 'Webhook helpers',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../webhooks-cli.js');
      mod.registerWebhooksCli(program);
    }, 'register')
  },
  {
    name: 'pairing',
    description: 'Pairing helpers',
    register: /* @__PURE__ */ __name(async (program) => {
      const { registerPluginCliCommands } = await import('../../plugins/cli.js');
      registerPluginCliCommands(program, await loadConfig());
      const mod = await import('../pairing-cli.js');
      mod.registerPairingCli(program);
    }, 'register')
  },
  {
    name: 'plugins',
    description: 'Plugin management',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../plugins-cli.js');
      mod.registerPluginsCli(program);
      const { registerPluginCliCommands } = await import('../../plugins/cli.js');
      registerPluginCliCommands(program, await loadConfig());
    }, 'register')
  },
  {
    name: 'channels',
    description: 'Channel management',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../channels-cli.js');
      mod.registerChannelsCli(program);
    }, 'register')
  },
  {
    name: 'directory',
    description: 'Directory commands',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../directory-cli.js');
      mod.registerDirectoryCli(program);
    }, 'register')
  },
  {
    name: 'security',
    description: 'Security helpers',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../security-cli.js');
      mod.registerSecurityCli(program);
    }, 'register')
  },
  {
    name: 'skills',
    description: 'Skills management',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../skills-cli.js');
      mod.registerSkillsCli(program);
    }, 'register')
  },
  {
    name: 'update',
    description: 'CLI update helpers',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../update-cli.js');
      mod.registerUpdateCli(program);
    }, 'register')
  },
  {
    name: 'completion',
    description: 'Generate shell completion script',
    register: /* @__PURE__ */ __name(async (program) => {
      const mod = await import('../completion-cli.js');
      mod.registerCompletionCli(program);
    }, 'register')
  }
];
function getSubCliEntries() {
  return entries;
}
__name(getSubCliEntries, 'getSubCliEntries');
function removeCommand(program, command) {
  const commands = program.commands;
  const index = commands.indexOf(command);
  if (index >= 0) {
    commands.splice(index, 1);
  }
}
__name(removeCommand, 'removeCommand');
async function registerSubCliByName(program, name) {
  const entry = entries.find((candidate) => candidate.name === name);
  if (!entry) {
    return false;
  }
  const existing = program.commands.find((cmd) => cmd.name() === entry.name);
  if (existing) {
    removeCommand(program, existing);
  }
  await entry.register(program);
  return true;
}
__name(registerSubCliByName, 'registerSubCliByName');
function registerLazyCommand(program, entry) {
  const placeholder = program.command(entry.name).description(entry.description);
  placeholder.allowUnknownOption(true);
  placeholder.allowExcessArguments(true);
  placeholder.action(async (...actionArgs) => {
    removeCommand(program, placeholder);
    await entry.register(program);
    const actionCommand = actionArgs.at(-1);
    const root = actionCommand?.parent ?? program;
    const rawArgs = root.rawArgs;
    const actionArgsList = resolveActionArgs(actionCommand);
    const fallbackArgv = actionCommand?.name() ? [actionCommand.name(), ...actionArgsList] : actionArgsList;
    const parseArgv = buildParseArgv({
      programName: program.name(),
      rawArgs,
      fallbackArgv
    });
    await program.parseAsync(parseArgv);
  });
}
__name(registerLazyCommand, 'registerLazyCommand');
function registerSubCliCommands(program, argv = process.argv) {
  if (shouldEagerRegisterSubcommands(argv)) {
    for (const entry of entries) {
      void entry.register(program);
    }
    return;
  }
  const primary = getPrimaryCommand(argv);
  if (primary && shouldRegisterPrimaryOnly(argv)) {
    const entry = entries.find((candidate) => candidate.name === primary);
    if (entry) {
      registerLazyCommand(program, entry);
      return;
    }
  }
  for (const candidate of entries) {
    registerLazyCommand(program, candidate);
  }
}
__name(registerSubCliCommands, 'registerSubCliCommands');
export {
  getSubCliEntries,
  registerSubCliByName,
  registerSubCliCommands
};
