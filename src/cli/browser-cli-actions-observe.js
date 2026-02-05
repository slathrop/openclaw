const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { danger } from '../globals.js';
import { defaultRuntime } from '../runtime.js';
import { shortenHomePath } from '../utils.js';
import { callBrowserRequest } from './browser-cli-shared.js';
import { runCommandWithRuntime } from './cli-utils.js';
function runBrowserObserve(action) {
  return runCommandWithRuntime(defaultRuntime, action, (err) => {
    defaultRuntime.error(danger(String(err)));
    defaultRuntime.exit(1);
  });
}
__name(runBrowserObserve, 'runBrowserObserve');
function registerBrowserActionObserveCommands(browser, parentOpts) {
  browser.command('console').description('Get recent console messages').option('--level <level>', 'Filter by level (error, warn, info)').option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserObserve(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/console',
          query: {
            level: opts.level?.trim() || void 0,
            targetId: opts.targetId?.trim() || void 0,
            profile
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(JSON.stringify(result.messages, null, 2));
    });
  });
  browser.command('pdf').description('Save page as PDF').option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserObserve(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/pdf',
          query: profile ? { profile } : void 0,
          body: { targetId: opts.targetId?.trim() || void 0 }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(`PDF: ${shortenHomePath(result.path)}`);
    });
  });
  browser.command('responsebody').description('Wait for a network response and return its body').argument('<url>', 'URL (exact, substring, or glob like **/api)').option('--target-id <id>', 'CDP target id (or unique prefix)').option(
    '--timeout-ms <ms>',
    'How long to wait for the response (default: 20000)',
    (v) => Number(v)
  ).option(
    '--max-chars <n>',
    'Max body chars to return (default: 200000)',
    (v) => Number(v)
  ).action(async (url, opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserObserve(async () => {
      const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : void 0;
      const maxChars = Number.isFinite(opts.maxChars) ? opts.maxChars : void 0;
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/response/body',
          query: profile ? { profile } : void 0,
          body: {
            url,
            targetId: opts.targetId?.trim() || void 0,
            timeoutMs,
            maxChars
          }
        },
        { timeoutMs: timeoutMs ?? 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(result.response.body);
    });
  });
}
__name(registerBrowserActionObserveCommands, 'registerBrowserActionObserveCommands');
export {
  registerBrowserActionObserveCommands
};
