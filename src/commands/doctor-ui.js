const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveOpenClawPackageRoot } from '../infra/openclaw-root.js';
import { runCommandWithTimeout } from '../process/exec.js';
import { note } from '../terminal/note.js';
async function maybeRepairUiProtocolFreshness(_runtime, prompter) {
  const root = await resolveOpenClawPackageRoot({
    moduleUrl: import.meta.url,
    argv1: process.argv[1],
    cwd: process.cwd()
  });
  if (!root) {
    return;
  }
  const schemaPath = path.join(root, 'src/gateway/protocol/schema.ts');
  const uiIndexPath = path.join(root, 'dist/control-ui/index.html');
  try {
    const [schemaStats, uiStats] = await Promise.all([
      fs.stat(schemaPath).catch(() => null),
      fs.stat(uiIndexPath).catch(() => null)
    ]);
    if (schemaStats && !uiStats) {
      note(['- Control UI assets are missing.', '- Run: pnpm ui:build'].join('\n'), 'UI');
      const uiSourcesPath = path.join(root, 'ui/package.json');
      const uiSourcesExist = await fs.stat(uiSourcesPath).catch(() => null);
      if (!uiSourcesExist) {
        note('Skipping UI build: ui/ sources not present.', 'UI');
        return;
      }
      const shouldRepair = await prompter.confirmRepair({
        message: 'Build Control UI assets now?',
        initialValue: true
      });
      if (shouldRepair) {
        note('Building Control UI assets... (this may take a moment)', 'UI');
        const uiScriptPath = path.join(root, 'scripts/ui.js');
        const buildResult = await runCommandWithTimeout([process.execPath, uiScriptPath, 'build'], {
          cwd: root,
          timeoutMs: 12e4,
          env: { ...process.env, FORCE_COLOR: '1' }
        });
        if (buildResult.code === 0) {
          note('UI build complete.', 'UI');
        } else {
          const details = [
            `UI build failed (exit ${buildResult.code ?? 'unknown'}).`,
            buildResult.stderr.trim() ? buildResult.stderr.trim() : null
          ].filter(Boolean).join('\n');
          note(details, 'UI');
        }
      }
      return;
    }
    if (!schemaStats || !uiStats) {
      return;
    }
    if (schemaStats.mtime > uiStats.mtime) {
      const uiMtimeIso = uiStats.mtime.toISOString();
      const gitLog = await runCommandWithTimeout(
        [
          'git',
          '-C',
          root,
          'log',
          `--since=${uiMtimeIso}`,
          '--format=%h %s',
          'src/gateway/protocol/schema.ts'
        ],
        { timeoutMs: 5e3 }
      ).catch(() => null);
      if (gitLog && gitLog.code === 0 && gitLog.stdout.trim()) {
        note(
          `UI assets are older than the protocol schema.
Functional changes since last build:
${gitLog.stdout.trim().split('\n').map((l) => `- ${l}`).join('\n')}`,
          'UI Freshness'
        );
        const shouldRepair = await prompter.confirmAggressive({
          message: 'Rebuild UI now? (Detected protocol mismatch requiring update)',
          initialValue: true
        });
        if (shouldRepair) {
          const uiSourcesPath = path.join(root, 'ui/package.json');
          const uiSourcesExist = await fs.stat(uiSourcesPath).catch(() => null);
          if (!uiSourcesExist) {
            note('Skipping UI rebuild: ui/ sources not present.', 'UI');
            return;
          }
          note('Rebuilding stale UI assets... (this may take a moment)', 'UI');
          const uiScriptPath = path.join(root, 'scripts/ui.js');
          const buildResult = await runCommandWithTimeout(
            [process.execPath, uiScriptPath, 'build'],
            {
              cwd: root,
              timeoutMs: 12e4,
              env: { ...process.env, FORCE_COLOR: '1' }
            }
          );
          if (buildResult.code === 0) {
            note('UI rebuild complete.', 'UI');
          } else {
            const details = [
              `UI rebuild failed (exit ${buildResult.code ?? 'unknown'}).`,
              buildResult.stderr.trim() ? buildResult.stderr.trim() : null
            ].filter(Boolean).join('\n');
            note(details, 'UI');
          }
        }
      }
    }
  } catch {
    // Intentionally ignored
  }
}
__name(maybeRepairUiProtocolFreshness, 'maybeRepairUiProtocolFreshness');
export {
  maybeRepairUiProtocolFreshness
};
