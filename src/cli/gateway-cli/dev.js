const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveWorkspaceTemplateDir } from '../../agents/workspace-templates.js';
import { resolveDefaultAgentWorkspaceDir } from '../../agents/workspace.js';
import { handleReset } from '../../commands/onboard-helpers.js';
import { createConfigIO, writeConfigFile } from '../../config/config.js';
import { defaultRuntime } from '../../runtime.js';
import { resolveUserPath, shortenHomePath } from '../../utils.js';
const DEV_IDENTITY_NAME = 'C3-PO';
const DEV_IDENTITY_THEME = 'protocol droid';
const DEV_IDENTITY_EMOJI = '\u{1F916}';
const DEV_AGENT_WORKSPACE_SUFFIX = 'dev';
async function loadDevTemplate(name, fallback) {
  try {
    const templateDir = await resolveWorkspaceTemplateDir();
    const raw = await fs.promises.readFile(path.join(templateDir, name), 'utf-8');
    if (!raw.startsWith('---')) {
      return raw;
    }
    const endIndex = raw.indexOf('\n---', 3);
    if (endIndex === -1) {
      return raw;
    }
    return raw.slice(endIndex + '\n---'.length).replace(/^\s+/, '');
  } catch {
    return fallback;
  }
}
__name(loadDevTemplate, 'loadDevTemplate');
const resolveDevWorkspaceDir = /* @__PURE__ */ __name((env = process.env) => {
  const baseDir = resolveDefaultAgentWorkspaceDir(env, os.homedir);
  const profile = env.OPENCLAW_PROFILE?.trim().toLowerCase();
  if (profile === 'dev') {
    return baseDir;
  }
  return `${baseDir}-${DEV_AGENT_WORKSPACE_SUFFIX}`;
}, 'resolveDevWorkspaceDir');
async function writeFileIfMissing(filePath, content) {
  try {
    await fs.promises.writeFile(filePath, content, {
      encoding: 'utf-8',
      flag: 'wx'
    });
  } catch (err) {
    const anyErr = err;
    if (anyErr.code !== 'EEXIST') {
      throw err;
    }
  }
}
__name(writeFileIfMissing, 'writeFileIfMissing');
async function ensureDevWorkspace(dir) {
  const resolvedDir = resolveUserPath(dir);
  await fs.promises.mkdir(resolvedDir, { recursive: true });
  const [agents, soul, tools, identity, user] = await Promise.all([
    loadDevTemplate(
      'AGENTS.dev.md',
      `# AGENTS.md - OpenClaw Dev Workspace

Default dev workspace for openclaw gateway --dev.
`
    ),
    loadDevTemplate(
      'SOUL.dev.md',
      `# SOUL.md - Dev Persona

Protocol droid for debugging and operations.
`
    ),
    loadDevTemplate(
      'TOOLS.dev.md',
      `# TOOLS.md - User Tool Notes (editable)

Add your local tool notes here.
`
    ),
    loadDevTemplate(
      'IDENTITY.dev.md',
      `# IDENTITY.md - Agent Identity

- Name: ${DEV_IDENTITY_NAME}
- Creature: protocol droid
- Vibe: ${DEV_IDENTITY_THEME}
- Emoji: ${DEV_IDENTITY_EMOJI}
`
    ),
    loadDevTemplate(
      'USER.dev.md',
      `# USER.md - User Profile

- Name:
- Preferred address:
- Notes:
`
    )
  ]);
  await writeFileIfMissing(path.join(resolvedDir, 'AGENTS.md'), agents);
  await writeFileIfMissing(path.join(resolvedDir, 'SOUL.md'), soul);
  await writeFileIfMissing(path.join(resolvedDir, 'TOOLS.md'), tools);
  await writeFileIfMissing(path.join(resolvedDir, 'IDENTITY.md'), identity);
  await writeFileIfMissing(path.join(resolvedDir, 'USER.md'), user);
}
__name(ensureDevWorkspace, 'ensureDevWorkspace');
async function ensureDevGatewayConfig(opts) {
  const workspace = resolveDevWorkspaceDir();
  if (opts.reset) {
    await handleReset('full', workspace, defaultRuntime);
  }
  const io = createConfigIO();
  const configPath = io.configPath;
  const configExists = fs.existsSync(configPath);
  if (!opts.reset && configExists) {
    return;
  }
  await writeConfigFile({
    gateway: {
      mode: 'local',
      bind: 'loopback'
    },
    agents: {
      defaults: {
        workspace,
        skipBootstrap: true
      },
      list: [
        {
          id: 'dev',
          default: true,
          workspace,
          identity: {
            name: DEV_IDENTITY_NAME,
            theme: DEV_IDENTITY_THEME,
            emoji: DEV_IDENTITY_EMOJI
          }
        }
      ]
    }
  });
  await ensureDevWorkspace(workspace);
  defaultRuntime.log(`Dev config ready: ${shortenHomePath(configPath)}`);
  defaultRuntime.log(`Dev workspace ready: ${shortenHomePath(resolveUserPath(workspace))}`);
}
__name(ensureDevGatewayConfig, 'ensureDevGatewayConfig');
export {
  ensureDevGatewayConfig
};
