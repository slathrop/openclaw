const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { agentsListCommand } from '../../commands/agents.js';
import { healthCommand } from '../../commands/health.js';
import { sessionsCommand } from '../../commands/sessions.js';
import { statusCommand } from '../../commands/status.js';
import { defaultRuntime } from '../../runtime.js';
import { getFlagValue, getPositiveIntFlagValue, getVerboseFlag, hasFlag } from '../argv.js';
import { registerBrowserCli } from '../browser-cli.js';
import { registerConfigCli } from '../config-cli.js';
import { registerMemoryCli, runMemoryStatus } from '../memory-cli.js';
import { registerAgentCommands } from './register.agent.js';
import { registerConfigureCommand } from './register.configure.js';
import { registerMaintenanceCommands } from './register.maintenance.js';
import { registerMessageCommands } from './register.message.js';
import { registerOnboardCommand } from './register.onboard.js';
import { registerSetupCommand } from './register.setup.js';
import { registerStatusHealthSessionsCommands } from './register.status-health-sessions.js';
import { registerSubCliCommands } from './register.subclis.js';
const routeHealth = {
  match: /* @__PURE__ */ __name((path) => path[0] === 'health', 'match'),
  loadPlugins: true,
  run: /* @__PURE__ */ __name(async (argv) => {
    const json = hasFlag(argv, '--json');
    const verbose = getVerboseFlag(argv, { includeDebug: true });
    const timeoutMs = getPositiveIntFlagValue(argv, '--timeout');
    if (timeoutMs === null) {
      return false;
    }
    await healthCommand({ json, timeoutMs, verbose }, defaultRuntime);
    return true;
  }, 'run')
};
const routeStatus = {
  match: /* @__PURE__ */ __name((path) => path[0] === 'status', 'match'),
  loadPlugins: true,
  run: /* @__PURE__ */ __name(async (argv) => {
    const json = hasFlag(argv, '--json');
    const deep = hasFlag(argv, '--deep');
    const all = hasFlag(argv, '--all');
    const usage = hasFlag(argv, '--usage');
    const verbose = getVerboseFlag(argv, { includeDebug: true });
    const timeoutMs = getPositiveIntFlagValue(argv, '--timeout');
    if (timeoutMs === null) {
      return false;
    }
    await statusCommand({ json, deep, all, usage, timeoutMs, verbose }, defaultRuntime);
    return true;
  }, 'run')
};
const routeSessions = {
  match: /* @__PURE__ */ __name((path) => path[0] === 'sessions', 'match'),
  run: /* @__PURE__ */ __name(async (argv) => {
    const json = hasFlag(argv, '--json');
    const store = getFlagValue(argv, '--store');
    if (store === null) {
      return false;
    }
    const active = getFlagValue(argv, '--active');
    if (active === null) {
      return false;
    }
    await sessionsCommand({ json, store, active }, defaultRuntime);
    return true;
  }, 'run')
};
const routeAgentsList = {
  match: /* @__PURE__ */ __name((path) => path[0] === 'agents' && path[1] === 'list', 'match'),
  run: /* @__PURE__ */ __name(async (argv) => {
    const json = hasFlag(argv, '--json');
    const bindings = hasFlag(argv, '--bindings');
    await agentsListCommand({ json, bindings }, defaultRuntime);
    return true;
  }, 'run')
};
const routeMemoryStatus = {
  match: /* @__PURE__ */ __name((path) => path[0] === 'memory' && path[1] === 'status', 'match'),
  run: /* @__PURE__ */ __name(async (argv) => {
    const agent = getFlagValue(argv, '--agent');
    if (agent === null) {
      return false;
    }
    const json = hasFlag(argv, '--json');
    const deep = hasFlag(argv, '--deep');
    const index = hasFlag(argv, '--index');
    const verbose = hasFlag(argv, '--verbose');
    await runMemoryStatus({ agent, json, deep, index, verbose });
    return true;
  }, 'run')
};
const commandRegistry = [
  {
    id: 'setup',
    register: /* @__PURE__ */ __name(({ program }) => registerSetupCommand(program), 'register')
  },
  {
    id: 'onboard',
    register: /* @__PURE__ */ __name(({ program }) => registerOnboardCommand(program), 'register')
  },
  {
    id: 'configure',
    register: /* @__PURE__ */ __name(({ program }) => registerConfigureCommand(program), 'register')
  },
  {
    id: 'config',
    register: /* @__PURE__ */ __name(({ program }) => registerConfigCli(program), 'register')
  },
  {
    id: 'maintenance',
    register: /* @__PURE__ */ __name(({ program }) => registerMaintenanceCommands(program), 'register')
  },
  {
    id: 'message',
    register: /* @__PURE__ */ __name(({ program, ctx }) => registerMessageCommands(program, ctx), 'register')
  },
  {
    id: 'memory',
    register: /* @__PURE__ */ __name(({ program }) => registerMemoryCli(program), 'register'),
    routes: [routeMemoryStatus]
  },
  {
    id: 'agent',
    register: /* @__PURE__ */ __name(({ program, ctx }) => registerAgentCommands(program, { agentChannelOptions: ctx.agentChannelOptions }), 'register'),
    routes: [routeAgentsList]
  },
  {
    id: 'subclis',
    register: /* @__PURE__ */ __name(({ program, argv }) => registerSubCliCommands(program, argv), 'register')
  },
  {
    id: 'status-health-sessions',
    register: /* @__PURE__ */ __name(({ program }) => registerStatusHealthSessionsCommands(program), 'register'),
    routes: [routeHealth, routeStatus, routeSessions]
  },
  {
    id: 'browser',
    register: /* @__PURE__ */ __name(({ program }) => registerBrowserCli(program), 'register')
  }
];
function registerProgramCommands(program, ctx, argv = process.argv) {
  for (const entry of commandRegistry) {
    entry.register({ program, ctx, argv });
  }
}
__name(registerProgramCommands, 'registerProgramCommands');
function findRoutedCommand(path) {
  for (const entry of commandRegistry) {
    if (!entry.routes) {
      continue;
    }
    for (const route of entry.routes) {
      if (route.match(path)) {
        return route;
      }
    }
  }
  return null;
}
__name(findRoutedCommand, 'findRoutedCommand');
export {
  commandRegistry,
  findRoutedCommand,
  registerProgramCommands
};
