const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { formatDocsLink } from '../../terminal/links.js';
import { isRich, theme } from '../../terminal/theme.js';
import { formatCliBannerLine, hasEmittedCliBanner } from '../banner.js';
import { replaceCliName, resolveCliName } from '../cli-name.js';
const CLI_NAME = resolveCliName();
const EXAMPLES = [
  [
    'openclaw channels login --verbose',
    'Link personal WhatsApp Web and show QR + connection logs.'
  ],
  [
    'openclaw message send --target +15555550123 --message "Hi" --json',
    'Send via your web session and print JSON result.'
  ],
  ['openclaw gateway --port 18789', 'Run the WebSocket Gateway locally.'],
  ['openclaw --dev gateway', 'Run a dev Gateway (isolated state/config) on ws://127.0.0.1:19001.'],
  ['openclaw gateway --force', 'Kill anything bound to the default gateway port, then start it.'],
  ['openclaw gateway ...', 'Gateway control via WebSocket.'],
  [
    'openclaw agent --to +15555550123 --message "Run summary" --deliver',
    'Talk directly to the agent using the Gateway; optionally send the WhatsApp reply.'
  ],
  [
    'openclaw message send --channel telegram --target @mychat --message "Hi"',
    'Send via your Telegram bot.'
  ]
];
function configureProgramHelp(program, ctx) {
  program.name(CLI_NAME).description('').version(ctx.programVersion).option(
    '--dev',
    'Dev profile: isolate state under ~/.openclaw-dev, default gateway port 19001, and shift derived ports (browser/canvas)'
  ).option(
    '--profile <name>',
    'Use a named profile (isolates OPENCLAW_STATE_DIR/OPENCLAW_CONFIG_PATH under ~/.openclaw-<name>)'
  );
  program.option('--no-color', 'Disable ANSI colors', false);
  program.configureHelp({
    // sort options and subcommands alphabetically
    sortSubcommands: true,
    sortOptions: true,
    optionTerm: /* @__PURE__ */ __name((option) => theme.option(option.flags), 'optionTerm'),
    subcommandTerm: /* @__PURE__ */ __name((cmd) => theme.command(cmd.name()), 'subcommandTerm')
  });
  program.configureOutput({
    writeOut: /* @__PURE__ */ __name((str) => {
      const colored = str.replace(/^Usage:/gm, theme.heading('Usage:')).replace(/^Options:/gm, theme.heading('Options:')).replace(/^Commands:/gm, theme.heading('Commands:'));
      process.stdout.write(colored);
    }, 'writeOut'),
    writeErr: /* @__PURE__ */ __name((str) => process.stderr.write(str), 'writeErr'),
    outputError: /* @__PURE__ */ __name((str, write) => write(theme.error(str)), 'outputError')
  });
  if (process.argv.includes('-V') || process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(ctx.programVersion);
    process.exit(0);
  }
  program.addHelpText('beforeAll', () => {
    if (hasEmittedCliBanner()) {
      return '';
    }
    const rich = isRich();
    const line = formatCliBannerLine(ctx.programVersion, { richTty: rich });
    return `
${line}
`;
  });
  const fmtExamples = EXAMPLES.map(
    ([cmd, desc]) => `  ${theme.command(replaceCliName(cmd, CLI_NAME))}
    ${theme.muted(desc)}`
  ).join('\n');
  program.addHelpText('afterAll', ({ command }) => {
    if (command !== program) {
      return '';
    }
    const docs = formatDocsLink('/cli', 'docs.openclaw.ai/cli');
    return `
${theme.heading('Examples:')}
${fmtExamples}

${theme.muted('Docs:')} ${docs}
`;
  });
}
__name(configureProgramHelp, 'configureProgramHelp');
export {
  configureProgramHelp
};
