const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { danger } from '../../globals.js';
import { defaultRuntime } from '../../runtime.js';
import { callBrowserRequest } from '../browser-cli-shared.js';
import { requireRef, resolveBrowserActionContext } from './shared.js';
function registerBrowserNavigationCommands(browser, parentOpts) {
  browser.command('navigate').description('Navigate the current tab to a URL').argument('<url>', 'URL to navigate to').option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (url, opts, cmd) => {
    const { parent, profile } = resolveBrowserActionContext(cmd, parentOpts);
    try {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/navigate',
          query: profile ? { profile } : void 0,
          body: {
            url,
            targetId: opts.targetId?.trim() || void 0
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(`navigated to ${result.url ?? url}`);
    } catch (err) {
      defaultRuntime.error(danger(String(err)));
      defaultRuntime.exit(1);
    }
  });
  browser.command('resize').description('Resize the viewport').argument('<width>', 'Viewport width', (v) => Number(v)).argument('<height>', 'Viewport height', (v) => Number(v)).option('--target-id <id>', 'CDP target id (or unique prefix)').action(async (width, height, opts, cmd) => {
    const { parent, profile } = resolveBrowserActionContext(cmd, parentOpts);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      defaultRuntime.error(danger('width and height must be numbers'));
      defaultRuntime.exit(1);
      return;
    }
    try {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/act',
          query: profile ? { profile } : void 0,
          body: {
            kind: 'resize',
            width,
            height,
            targetId: opts.targetId?.trim() || void 0
          }
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(`resized to ${width}x${height}`);
    } catch (err) {
      defaultRuntime.error(danger(String(err)));
      defaultRuntime.exit(1);
    }
  });
  void requireRef;
}
__name(registerBrowserNavigationCommands, 'registerBrowserNavigationCommands');
export {
  registerBrowserNavigationCommands
};
