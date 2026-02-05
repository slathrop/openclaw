const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { loadConfig } from '../config/config.js';
import { defaultRuntime } from '../runtime.js';
import { runSecurityAudit } from '../security/audit.js';
import { fixSecurityFootguns } from '../security/fix.js';
import { formatDocsLink } from '../terminal/links.js';
import { isRich, theme } from '../terminal/theme.js';
import { shortenHomeInString, shortenHomePath } from '../utils.js';
import { formatCliCommand } from './command-format.js';
function formatSummary(summary) {
  const rich = isRich();
  const c = summary.critical;
  const w = summary.warn;
  const i = summary.info;
  const parts = [];
  parts.push(rich ? theme.error(`${c} critical`) : `${c} critical`);
  parts.push(rich ? theme.warn(`${w} warn`) : `${w} warn`);
  parts.push(rich ? theme.muted(`${i} info`) : `${i} info`);
  return parts.join(' \xB7 ');
}
__name(formatSummary, 'formatSummary');
function registerSecurityCli(program) {
  const security = program.command('security').description('Security tools (audit)').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/security', 'docs.openclaw.ai/cli/security')}
`
  );
  security.command('audit').description('Audit config + local state for common security foot-guns').option('--deep', 'Attempt live Gateway probe (best-effort)', false).option('--fix', 'Apply safe fixes (tighten defaults + chmod state/config)', false).option('--json', 'Print JSON', false).action(async (opts) => {
    // eslint-disable-next-line no-unused-vars
    const fixResult = opts.fix ? await fixSecurityFootguns().catch((_err) => null) : null;
    const cfg = loadConfig();
    const report = await runSecurityAudit({
      config: cfg,
      deep: Boolean(opts.deep),
      includeFilesystem: true,
      includeChannelSecurity: true
    });
    if (opts.json) {
      defaultRuntime.log(
        JSON.stringify(fixResult ? { fix: fixResult, report } : report, null, 2)
      );
      return;
    }
    const rich = isRich();
    const heading = /* @__PURE__ */ __name((text) => rich ? theme.heading(text) : text, 'heading');
    const muted = /* @__PURE__ */ __name((text) => rich ? theme.muted(text) : text, 'muted');
    const lines = [];
    lines.push(heading('OpenClaw security audit'));
    lines.push(muted(`Summary: ${formatSummary(report.summary)}`));
    lines.push(muted(`Run deeper: ${formatCliCommand('openclaw security audit --deep')}`));
    if (opts.fix) {
      lines.push(muted(`Fix: ${formatCliCommand('openclaw security audit --fix')}`));
      if (!fixResult) {
        lines.push(muted('Fixes: failed to apply (unexpected error)'));
      } else if (fixResult.errors.length === 0 && fixResult.changes.length === 0 && fixResult.actions.every((a) => !a.ok)) {
        lines.push(muted('Fixes: no changes applied'));
      } else {
        lines.push('');
        lines.push(heading('FIX'));
        for (const change of fixResult.changes) {
          lines.push(muted(`  ${shortenHomeInString(change)}`));
        }
        for (const action of fixResult.actions) {
          if (action.kind === 'chmod') {
            const mode = action.mode.toString(8).padStart(3, '0');
            if (action.ok) {
              lines.push(muted(`  chmod ${mode} ${shortenHomePath(action.path)}`));
            } else if (action.skipped) {
              lines.push(
                muted(`  skip chmod ${mode} ${shortenHomePath(action.path)} (${action.skipped})`)
              );
            } else if (action.error) {
              lines.push(
                muted(`  chmod ${mode} ${shortenHomePath(action.path)} failed: ${action.error}`)
              );
            }
            continue;
          }
          const command = shortenHomeInString(action.command);
          if (action.ok) {
            lines.push(muted(`  ${command}`));
          } else if (action.skipped) {
            lines.push(muted(`  skip ${command} (${action.skipped})`));
          } else if (action.error) {
            lines.push(muted(`  ${command} failed: ${action.error}`));
          }
        }
        if (fixResult.errors.length > 0) {
          for (const err of fixResult.errors) {
            lines.push(muted(`  error: ${shortenHomeInString(err)}`));
          }
        }
      }
    }
    const bySeverity = /* @__PURE__ */ __name((sev) => report.findings.filter((f) => f.severity === sev), 'bySeverity');
    const render = /* @__PURE__ */ __name((sev) => {
      const list = bySeverity(sev);
      if (list.length === 0) {
        return;
      }
      const label = sev === 'critical' ? rich ? theme.error('CRITICAL') : 'CRITICAL' : sev === 'warn' ? rich ? theme.warn('WARN') : 'WARN' : rich ? theme.muted('INFO') : 'INFO';
      lines.push('');
      lines.push(heading(label));
      for (const f of list) {
        lines.push(`${theme.muted(f.checkId)} ${f.title}`);
        lines.push(`  ${f.detail}`);
        if (f.remediation?.trim()) {
          lines.push(`  ${muted(`Fix: ${f.remediation.trim()}`)}`);
        }
      }
    }, 'render');
    render('critical');
    render('warn');
    render('info');
    defaultRuntime.log(lines.join('\n'));
  });
}
__name(registerSecurityCli, 'registerSecurityCli');
export {
  registerSecurityCli
};
