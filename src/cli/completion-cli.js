const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { Option } from 'commander';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveStateDir } from '../config/paths.js';
import { getSubCliEntries, registerSubCliByName } from './program/register.subclis.js';
const COMPLETION_SHELLS = ['zsh', 'bash', 'powershell', 'fish'];
function isCompletionShell(value) {
  return COMPLETION_SHELLS.includes(value);
}
__name(isCompletionShell, 'isCompletionShell');
function resolveShellFromEnv(env = process.env) {
  const shellPath = env.SHELL?.trim() ?? '';
  const shellName = shellPath ? path.basename(shellPath).toLowerCase() : '';
  if (shellName === 'zsh') {
    return 'zsh';
  }
  if (shellName === 'bash') {
    return 'bash';
  }
  if (shellName === 'fish') {
    return 'fish';
  }
  if (shellName === 'pwsh' || shellName === 'powershell') {
    return 'powershell';
  }
  return 'zsh';
}
__name(resolveShellFromEnv, 'resolveShellFromEnv');
function sanitizeCompletionBasename(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'openclaw';
  }
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '-');
}
__name(sanitizeCompletionBasename, 'sanitizeCompletionBasename');
function resolveCompletionCacheDir(env = process.env) {
  const stateDir = resolveStateDir(env, os.homedir);
  return path.join(stateDir, 'completions');
}
__name(resolveCompletionCacheDir, 'resolveCompletionCacheDir');
function resolveCompletionCachePath(shell, binName) {
  const basename = sanitizeCompletionBasename(binName);
  const extension = shell === 'powershell' ? 'ps1' : shell === 'fish' ? 'fish' : shell === 'bash' ? 'bash' : 'zsh';
  return path.join(resolveCompletionCacheDir(), `${basename}.${extension}`);
}
__name(resolveCompletionCachePath, 'resolveCompletionCachePath');
async function completionCacheExists(shell, binName = 'openclaw') {
  const cachePath = resolveCompletionCachePath(shell, binName);
  return pathExists(cachePath);
}
__name(completionCacheExists, 'completionCacheExists');
function getCompletionScript(shell, program) {
  if (shell === 'zsh') {
    return generateZshCompletion(program);
  }
  if (shell === 'bash') {
    return generateBashCompletion(program);
  }
  if (shell === 'powershell') {
    return generatePowerShellCompletion(program);
  }
  return generateFishCompletion(program);
}
__name(getCompletionScript, 'getCompletionScript');
async function writeCompletionCache(params) {
  const cacheDir = resolveCompletionCacheDir();
  await fs.mkdir(cacheDir, { recursive: true });
  for (const shell of params.shells) {
    const script = getCompletionScript(shell, params.program);
    const targetPath = resolveCompletionCachePath(shell, params.binName);
    await fs.writeFile(targetPath, script, 'utf-8');
  }
}
__name(writeCompletionCache, 'writeCompletionCache');
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
__name(pathExists, 'pathExists');
function formatCompletionSourceLine(shell, binName, cachePath) {
  if (shell === 'fish') {
    return `source "${cachePath}"`;
  }
  return `source "${cachePath}"`;
}
__name(formatCompletionSourceLine, 'formatCompletionSourceLine');
function isCompletionProfileHeader(line) {
  return line.trim() === '# OpenClaw Completion';
}
__name(isCompletionProfileHeader, 'isCompletionProfileHeader');
function isCompletionProfileLine(line, binName, cachePath) {
  if (line.includes(`${binName} completion`)) {
    return true;
  }
  if (cachePath && line.includes(cachePath)) {
    return true;
  }
  return false;
}
__name(isCompletionProfileLine, 'isCompletionProfileLine');
function isSlowDynamicCompletionLine(line, binName) {
  return line.includes(`<(${binName} completion`) || line.includes(`${binName} completion`) && line.includes('| source');
}
__name(isSlowDynamicCompletionLine, 'isSlowDynamicCompletionLine');
function updateCompletionProfile(content, binName, cachePath, sourceLine) {
  const lines = content.split('\n');
  const filtered = [];
  let hadExisting = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (isCompletionProfileHeader(line)) {
      hadExisting = true;
      i += 1;
      continue;
    }
    if (isCompletionProfileLine(line, binName, cachePath)) {
      hadExisting = true;
      continue;
    }
    filtered.push(line);
  }
  const trimmed = filtered.join('\n').trimEnd();
  const block = `# OpenClaw Completion
${sourceLine}`;
  const next = trimmed ? `${trimmed}

${block}
` : `${block}
`;
  return { next, changed: next !== content, hadExisting };
}
__name(updateCompletionProfile, 'updateCompletionProfile');
function getShellProfilePath(shell) {
  const home = process.env.HOME || os.homedir();
  if (shell === 'zsh') {
    return path.join(home, '.zshrc');
  }
  if (shell === 'bash') {
    return path.join(home, '.bashrc');
  }
  if (shell === 'fish') {
    return path.join(home, '.config', 'fish', 'config.fish');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.USERPROFILE || home,
      'Documents',
      'PowerShell',
      'Microsoft.PowerShell_profile.ps1'
    );
  }
  return path.join(home, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
}
__name(getShellProfilePath, 'getShellProfilePath');
async function isCompletionInstalled(shell, binName = 'openclaw') {
  const profilePath = getShellProfilePath(shell);
  if (!await pathExists(profilePath)) {
    return false;
  }
  const cachePathCandidate = resolveCompletionCachePath(shell, binName);
  const cachedPath = await pathExists(cachePathCandidate) ? cachePathCandidate : null;
  const content = await fs.readFile(profilePath, 'utf-8');
  const lines = content.split('\n');
  return lines.some(
    (line) => isCompletionProfileHeader(line) || isCompletionProfileLine(line, binName, cachedPath)
  );
}
__name(isCompletionInstalled, 'isCompletionInstalled');
async function usesSlowDynamicCompletion(shell, binName = 'openclaw') {
  const profilePath = getShellProfilePath(shell);
  if (!await pathExists(profilePath)) {
    return false;
  }
  const cachePath = resolveCompletionCachePath(shell, binName);
  const content = await fs.readFile(profilePath, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (isSlowDynamicCompletionLine(line, binName) && !line.includes(cachePath)) {
      return true;
    }
  }
  return false;
}
__name(usesSlowDynamicCompletion, 'usesSlowDynamicCompletion');
function registerCompletionCli(program) {
  program.command('completion').description('Generate shell completion script').addOption(
    new Option('-s, --shell <shell>', 'Shell to generate completion for (default: zsh)').choices(
      COMPLETION_SHELLS
    )
  ).option('-i, --install', 'Install completion script to shell profile').option(
    '--write-state',
    'Write completion scripts to $OPENCLAW_STATE_DIR/completions (no stdout)'
  ).option('-y, --yes', 'Skip confirmation (non-interactive)', false).action(async (options) => {
    const shell = options.shell ?? 'zsh';
    const entries = getSubCliEntries();
    for (const entry of entries) {
      if (entry.name === 'completion') {
        continue;
      }
      await registerSubCliByName(program, entry.name);
    }
    if (options.writeState) {
      const writeShells = options.shell ? [shell] : [...COMPLETION_SHELLS];
      await writeCompletionCache({
        program,
        shells: writeShells,
        binName: program.name()
      });
    }
    if (options.install) {
      const targetShell = options.shell ?? resolveShellFromEnv();
      await installCompletion(targetShell, Boolean(options.yes), program.name());
      return;
    }
    if (options.writeState) {
      return;
    }
    if (!isCompletionShell(shell)) {
      throw new Error(`Unsupported shell: ${shell}`);
    }
    const script = getCompletionScript(shell, program);
    console.log(script);
  });
}
__name(registerCompletionCli, 'registerCompletionCli');
async function installCompletion(shell, yes, binName = 'openclaw') {
  const home = process.env.HOME || os.homedir();
  let profilePath = '';
  let sourceLine = '';
  const isShellSupported = isCompletionShell(shell);
  if (!isShellSupported) {
    console.error(`Automated installation not supported for ${shell} yet.`);
    return;
  }
  const cachePath = resolveCompletionCachePath(shell, binName);
  const cacheExists = await pathExists(cachePath);
  if (!cacheExists) {
    console.error(
      `Completion cache not found at ${cachePath}. Run \`${binName} completion --write-state\` first.`
    );
    return;
  }
  if (shell === 'zsh') {
    profilePath = path.join(home, '.zshrc');
    sourceLine = formatCompletionSourceLine('zsh', binName, cachePath);
  } else if (shell === 'bash') {
    profilePath = path.join(home, '.bashrc');
    try {
      await fs.access(profilePath);
    } catch {
      profilePath = path.join(home, '.bash_profile');
    }
    sourceLine = formatCompletionSourceLine('bash', binName, cachePath);
  } else if (shell === 'fish') {
    profilePath = path.join(home, '.config', 'fish', 'config.fish');
    sourceLine = formatCompletionSourceLine('fish', binName, cachePath);
  } else {
    console.error(`Automated installation not supported for ${shell} yet.`);
    return;
  }
  try {
    try {
      await fs.access(profilePath);
    } catch {
      if (!yes) {
        console.warn(`Profile not found at ${profilePath}. Created a new one.`);
      }
      await fs.mkdir(path.dirname(profilePath), { recursive: true });
      await fs.writeFile(profilePath, '', 'utf-8');
    }
    const content = await fs.readFile(profilePath, 'utf-8');
    const update = updateCompletionProfile(content, binName, cachePath, sourceLine);
    if (!update.changed) {
      if (!yes) {
        console.log(`Completion already installed in ${profilePath}`);
      }
      return;
    }
    if (!yes) {
      const action = update.hadExisting ? 'Updating' : 'Installing';
      console.log(`${action} completion in ${profilePath}...`);
    }
    await fs.writeFile(profilePath, update.next, 'utf-8');
    if (!yes) {
      console.log(`Completion installed. Restart your shell or run: source ${profilePath}`);
    }
  } catch (err) {
    console.error(`Failed to install completion: ${err}`);
  }
}
__name(installCompletion, 'installCompletion');
function generateZshCompletion(program) {
  const rootCmd = program.name();
  const script = `
#compdef ${rootCmd}

_${rootCmd}_root_completion() {
  local -a commands
  local -a options
  
  _arguments -C \\
    ${generateZshArgs(program)} \\
    ${generateZshSubcmdList(program)} \\
    "*::arg:->args"

  case $state in
    (args)
      case $line[1] in
        ${program.commands.map((cmd) => `(${cmd.name()}) _${rootCmd}_${cmd.name().replace(/-/g, '_')} ;;`).join('\n        ')}
      esac
      ;;
  esac
}

${generateZshSubcommands(program, rootCmd)}

compdef _${rootCmd}_root_completion ${rootCmd}
`;
  return script;
}
__name(generateZshCompletion, 'generateZshCompletion');
function generateZshArgs(cmd) {
  return (cmd.options || []).map((opt) => {
    const flags = opt.flags.split(/[ ,|]+/);
    const name = flags.find((f) => f.startsWith('--')) || flags[0];
    const short = flags.find((f) => f.startsWith('-') && !f.startsWith('--'));
    const desc = opt.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "'\\''").replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    if (short) {
      return `"(${name} ${short})"{${name},${short}}"[${desc}]"`;
    }
    return `"${name}[${desc}]"`;
  }).join(' \\\n    ');
}
__name(generateZshArgs, 'generateZshArgs');
function generateZshSubcmdList(cmd) {
  const list = cmd.commands.map((c) => {
    const desc = c.description().replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    return `'${c.name()}[${desc}]'`;
  }).join(' ');
  return `"1: :_values 'command' ${list}"`;
}
__name(generateZshSubcmdList, 'generateZshSubcmdList');
function generateZshSubcommands(program, prefix) {
  let script = '';
  for (const cmd of program.commands) {
    const cmdName = cmd.name();
    const funcName = `_${prefix}_${cmdName.replace(/-/g, '_')}`;
    script += generateZshSubcommands(cmd, `${prefix}_${cmdName.replace(/-/g, '_')}`);
    const subCommands = cmd.commands;
    if (subCommands.length > 0) {
      script += `
${funcName}() {
  local -a commands
  local -a options
  
  _arguments -C \\
    ${generateZshArgs(cmd)} \\
    ${generateZshSubcmdList(cmd)} \\
    "*::arg:->args"

  case $state in
    (args)
      case $line[1] in
        ${subCommands.map((sub) => `(${sub.name()}) ${funcName}_${sub.name().replace(/-/g, '_')} ;;`).join('\n        ')}
      esac
      ;;
  esac
}
`;
    } else {
      script += `
${funcName}() {
  _arguments -C \\
    ${generateZshArgs(cmd)}
}
`;
    }
  }
  return script;
}
__name(generateZshSubcommands, 'generateZshSubcommands');
function generateBashCompletion(program) {
  const rootCmd = program.name();
  return `
_${rootCmd}_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    # Simple top-level completion for now
    opts="${program.commands.map((c) => c.name()).join(' ')} ${program.options.map((o) => o.flags.split(' ')[0]).join(' ')}"
    
    case "\${prev}" in
      ${program.commands.map((cmd) => generateBashSubcommand(cmd)).join('\n      ')}
    esac

    if [[ \${cur} == -* ]] ; then
        COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
        return 0
    fi
    
    COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
}

complete -F _${rootCmd}_completion ${rootCmd}
`;
}
__name(generateBashCompletion, 'generateBashCompletion');
function generateBashSubcommand(cmd) {
  return `${cmd.name()})
        opts="${cmd.commands.map((c) => c.name()).join(' ')} ${cmd.options.map((o) => o.flags.split(' ')[0]).join(' ')}"
        COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
        return 0
        ;;`;
}
__name(generateBashSubcommand, 'generateBashSubcommand');
function generatePowerShellCompletion(program) {
  const rootCmd = program.name();
  const visit = /* @__PURE__ */ __name((cmd, parents) => {
    const cmdName = cmd.name();
    const fullPath = [...parents, cmdName].join(' ');
    let script = '';
    const subCommands = cmd.commands.map((c) => c.name());
    const options = cmd.options.map((o) => o.flags.split(/[ ,|]+/)[0]);
    const allCompletions = [...subCommands, ...options].map((s) => `'${s}'`).join(',');
    if (allCompletions.length > 0) {
      script += `
            if ($commandPath -eq '${fullPath}') {
                $completions = @(${allCompletions})
                $completions | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
                }
            }
`;
    }
    for (const sub of cmd.commands) {
      script += visit(sub, [...parents, cmdName]);
    }
    return script;
  }, 'visit');
  const rootBody = visit(program, []);
  return `
Register-ArgumentCompleter -Native -CommandName ${rootCmd} -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    
    $commandElements = $commandAst.CommandElements
    $commandPath = ""
    
    # Reconstruct command path (simple approximation)
    # Skip the executable name
    for ($i = 1; $i -lt $commandElements.Count; $i++) {
        $element = $commandElements[$i].Extent.Text
        if ($element -like "-*") { break }
        if ($i -eq $commandElements.Count - 1 -and $wordToComplete -ne "") { break } # Don't include current word being typed
        $commandPath += "$element "
    }
    $commandPath = $commandPath.Trim()
    
    # Root command
    if ($commandPath -eq "") {
         $completions = @(${program.commands.map((c) => `'${c.name()}'`).join(',')}, ${program.options.map((o) => `'${o.flags.split(' ')[0]}'`).join(',')}) 
         $completions | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
         }
    }
    
    ${rootBody}
}
`;
}
__name(generatePowerShellCompletion, 'generatePowerShellCompletion');
function generateFishCompletion(program) {
  const rootCmd = program.name();
  let script = '';
  const visit = /* @__PURE__ */ __name((cmd, parents) => {
    const cmdName = cmd.name();
    const fullPath = [...parents];
    if (parents.length > 0) {
      fullPath.push(cmdName);
    }
    if (parents.length === 0) {
      for (const sub of cmd.commands) {
        const desc = sub.description().replace(/'/g, "'\\''");
        script += `complete -c ${rootCmd} -n "__fish_use_subcommand" -a "${sub.name()}" -d '${desc}'
`;
      }
      for (const opt of cmd.options) {
        const flags = opt.flags.split(/[ ,|]+/);
        const long = flags.find((f) => f.startsWith('--'))?.replace(/^--/, '');
        const short = flags.find((f) => f.startsWith('-') && !f.startsWith('--'))?.replace(/^-/, '');
        const desc = opt.description.replace(/'/g, "'\\''");
        let line = `complete -c ${rootCmd} -n "__fish_use_subcommand"`;
        if (short) {
          line += ` -s ${short}`;
        }
        if (long) {
          line += ` -l ${long}`;
        }
        line += ` -d '${desc}'
`;
        script += line;
      }
    } else {
      for (const sub of cmd.commands) {
        const desc = sub.description().replace(/'/g, "'\\''");
        script += `complete -c ${rootCmd} -n "__fish_seen_subcommand_from ${cmdName}" -a "${sub.name()}" -d '${desc}'
`;
      }
      for (const opt of cmd.options) {
        const flags = opt.flags.split(/[ ,|]+/);
        const long = flags.find((f) => f.startsWith('--'))?.replace(/^--/, '');
        const short = flags.find((f) => f.startsWith('-') && !f.startsWith('--'))?.replace(/^-/, '');
        const desc = opt.description.replace(/'/g, "'\\''");
        let line = `complete -c ${rootCmd} -n "__fish_seen_subcommand_from ${cmdName}"`;
        if (short) {
          line += ` -s ${short}`;
        }
        if (long) {
          line += ` -l ${long}`;
        }
        line += ` -d '${desc}'
`;
        script += line;
      }
    }
    for (const sub of cmd.commands) {
      visit(sub, [...parents, cmdName]);
    }
  }, 'visit');
  visit(program, []);
  return script;
}
__name(generateFishCompletion, 'generateFishCompletion');
export {
  completionCacheExists,
  installCompletion,
  isCompletionInstalled,
  registerCompletionCli,
  resolveCompletionCachePath,
  resolveShellFromEnv,
  usesSlowDynamicCompletion
};
