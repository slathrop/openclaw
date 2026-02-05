const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { formatCliCommand } from '../cli/command-format.js';
import { isTruthyEnvValue } from '../infra/env.js';
import { runGatewayUpdate } from '../infra/update-runner.js';
import { runCommandWithTimeout } from '../process/exec.js';
import { note } from '../terminal/note.js';
async function detectOpenClawGitCheckout(root) {
  const res = await runCommandWithTimeout(['git', '-C', root, 'rev-parse', '--show-toplevel'], {
    timeoutMs: 5e3
  }).catch(() => null);
  if (!res) {
    return 'unknown';
  }
  if (res.code !== 0) {
    if (res.stderr.toLowerCase().includes('not a git repository')) {
      return 'not-git';
    }
    return 'unknown';
  }
  return res.stdout.trim() === root ? 'git' : 'not-git';
}
__name(detectOpenClawGitCheckout, 'detectOpenClawGitCheckout');
async function maybeOfferUpdateBeforeDoctor(params) {
  const updateInProgress = isTruthyEnvValue(process.env.OPENCLAW_UPDATE_IN_PROGRESS);
  const canOfferUpdate = !updateInProgress && params.options.nonInteractive !== true && params.options.yes !== true && params.options.repair !== true && Boolean(process.stdin.isTTY);
  if (!canOfferUpdate || !params.root) {
    return { updated: false };
  }
  const git = await detectOpenClawGitCheckout(params.root);
  if (git === 'git') {
    const shouldUpdate = await params.confirm({
      message: 'Update OpenClaw from git before running doctor?',
      initialValue: true
    });
    if (!shouldUpdate) {
      return { updated: false };
    }
    note('Running update (fetch/rebase/build/ui:build/doctor)\u2026', 'Update');
    const result = await runGatewayUpdate({
      cwd: params.root,
      argv1: process.argv[1]
    });
    note(
      [
        `Status: ${result.status}`,
        `Mode: ${result.mode}`,
        result.root ? `Root: ${result.root}` : null,
        result.reason ? `Reason: ${result.reason}` : null
      ].filter(Boolean).join('\n'),
      'Update result'
    );
    if (result.status === 'ok') {
      params.outro('Update completed (doctor already ran as part of the update).');
      return { updated: true, handled: true };
    }
    return { updated: true, handled: false };
  }
  if (git === 'not-git') {
    note(
      [
        'This install is not a git checkout.',
        `Run \`${formatCliCommand('openclaw update')}\` to update via your package manager (npm/pnpm), then rerun doctor.`
      ].join('\n'),
      'Update'
    );
  }
  return { updated: false };
}
__name(maybeOfferUpdateBeforeDoctor, 'maybeOfferUpdateBeforeDoctor');
export {
  maybeOfferUpdateBeforeDoctor
};
