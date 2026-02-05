const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { danger } from '../globals.js';
import { defaultRuntime } from '../runtime.js';
import { shortenHomePath } from '../utils.js';
import { callBrowserRequest } from './browser-cli-shared.js';
import { runCommandWithRuntime } from './cli-utils.js';
function runBrowserDebug(action) {
  return runCommandWithRuntime(defaultRuntime, action, (err) => {
    defaultRuntime.error(danger(String(err)));
    defaultRuntime.exit(1);
  });
}
__name(runBrowserDebug, 'runBrowserDebug');
function registerBrowserDebugCommands(browser, parentOpts) {
  browser.command('highlight').description('Highlight an element by ref').argument('<ref>', 'Ref id from snapshot').option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (ref, opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserDebug(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/highlight',
          query: profile ? { profile } : void 0,
          body: {
            ref: ref.trim(),
            targetId: opts.targetId?.trim() || void 0
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(`highlighted ${ref.trim()}`);
    });
  });
  browser.command('errors').description('Get recent page errors').option('--clear', 'Clear stored errors after reading', false).option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserDebug(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/errors',
          query: {
            targetId: opts.targetId?.trim() || void 0,
            clear: Boolean(opts.clear),
            profile
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      if (!result.errors.length) {
        defaultRuntime.log('No page errors.');
        return;
      }
      defaultRuntime.log(
        result.errors.map((e) => `${e.timestamp} ${e.name ? `${e.name}: ` : ''}${e.message}`).join('\n')
      );
    });
  });
  browser.command('requests').description('Get recent network requests (best-effort)').option('--filter <text>', 'Only show URLs that contain this substring').option('--clear', 'Clear stored requests after reading', false).option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserDebug(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/requests',
          query: {
            targetId: opts.targetId?.trim() || void 0,
            filter: opts.filter?.trim() || void 0,
            clear: Boolean(opts.clear),
            profile
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      if (!result.requests.length) {
        defaultRuntime.log('No requests recorded.');
        return;
      }
      defaultRuntime.log(
        result.requests.map((r) => {
          const status = typeof r.status === 'number' ? ` ${r.status}` : '';
          const ok = r.ok === true ? ' ok' : r.ok === false ? ' fail' : '';
          const fail = r.failureText ? ` (${r.failureText})` : '';
          return `${r.timestamp} ${r.method}${status}${ok} ${r.url}${fail}`;
        }).join('\n')
      );
    });
  });
  const trace = browser.command('trace').description('Record a Playwright trace');
  trace.command('start').description('Start trace recording').option('--target-id <id>', 'CDP target id (or unique prefix)').option('--no-screenshots', 'Disable screenshots').option('--no-snapshots', 'Disable snapshots').option('--sources', 'Include sources (bigger traces)', false).action(async (opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserDebug(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/trace/start',
          query: profile ? { profile } : void 0,
          body: {
            targetId: opts.targetId?.trim() || void 0,
            screenshots: Boolean(opts.screenshots),
            snapshots: Boolean(opts.snapshots),
            sources: Boolean(opts.sources)
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log('trace started');
    });
  });
  trace.command('stop').description('Stop trace recording and write a .zip').option('--out <path>', 'Output path for the trace zip').option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserDebug(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/trace/stop',
          query: profile ? { profile } : void 0,
          body: {
            targetId: opts.targetId?.trim() || void 0,
            path: opts.out?.trim() || void 0
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(`TRACE:${shortenHomePath(result.path)}`);
    });
  });
}
__name(registerBrowserDebugCommands, 'registerBrowserDebugCommands');
export {
  registerBrowserDebugCommands
};
