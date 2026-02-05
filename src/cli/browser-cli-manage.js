const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { danger, info } from '../globals.js';
import { defaultRuntime } from '../runtime.js';
import { shortenHomePath } from '../utils.js';
import { callBrowserRequest } from './browser-cli-shared.js';
import { runCommandWithRuntime } from './cli-utils.js';
function runBrowserCommand(action) {
  return runCommandWithRuntime(defaultRuntime, action, (err) => {
    defaultRuntime.error(danger(String(err)));
    defaultRuntime.exit(1);
  });
}
__name(runBrowserCommand, 'runBrowserCommand');
function registerBrowserManageCommands(browser, parentOpts) {
  browser.command('status').description('Show browser status').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    await runBrowserCommand(async () => {
      const status = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/',
          query: parent?.browserProfile ? { profile: parent.browserProfile } : void 0
        },
        {
          timeoutMs: 1500
        }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(status, null, 2));
        return;
      }
      const detectedPath = status.detectedExecutablePath ?? status.executablePath;
      const detectedDisplay = detectedPath ? shortenHomePath(detectedPath) : 'auto';
      defaultRuntime.log(
        [
          `profile: ${status.profile ?? 'openclaw'}`,
          `enabled: ${status.enabled}`,
          `running: ${status.running}`,
          `cdpPort: ${status.cdpPort}`,
          `cdpUrl: ${status.cdpUrl ?? `http://127.0.0.1:${status.cdpPort}`}`,
          `browser: ${status.chosenBrowser ?? 'unknown'}`,
          `detectedBrowser: ${status.detectedBrowser ?? 'unknown'}`,
          `detectedPath: ${detectedDisplay}`,
          `profileColor: ${status.color}`,
          ...status.detectError ? [`detectError: ${status.detectError}`] : []
        ].join('\n')
      );
    });
  });
  browser.command('start').description('Start the browser (no-op if already running)').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/start',
          query: profile ? { profile } : void 0
        },
        { timeoutMs: 15e3 }
      );
      const status = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/',
          query: profile ? { profile } : void 0
        },
        { timeoutMs: 1500 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(status, null, 2));
        return;
      }
      const name = status.profile ?? 'openclaw';
      defaultRuntime.log(info(`\u{1F99E} browser [${name}] running: ${status.running}`));
    });
  });
  browser.command('stop').description('Stop the browser (best-effort)').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/stop',
          query: profile ? { profile } : void 0
        },
        { timeoutMs: 15e3 }
      );
      const status = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/',
          query: profile ? { profile } : void 0
        },
        { timeoutMs: 1500 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(status, null, 2));
        return;
      }
      const name = status.profile ?? 'openclaw';
      defaultRuntime.log(info(`\u{1F99E} browser [${name}] running: ${status.running}`));
    });
  });
  browser.command('reset-profile').description('Reset browser profile (moves it to Trash)').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/reset-profile',
          query: profile ? { profile } : void 0
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      if (!result.moved) {
        defaultRuntime.log(info('\u{1F99E} browser profile already missing.'));
        return;
      }
      const dest = result.to ?? result.from;
      defaultRuntime.log(info(`\u{1F99E} browser profile moved to Trash (${dest})`));
    });
  });
  browser.command('tabs').description('List open tabs').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/tabs',
          query: profile ? { profile } : void 0
        },
        { timeoutMs: 3e3 }
      );
      const tabs = result.tabs ?? [];
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ tabs }, null, 2));
        return;
      }
      if (tabs.length === 0) {
        defaultRuntime.log('No tabs (browser closed or no targets).');
        return;
      }
      defaultRuntime.log(
        tabs.map(
          (t, i) => `${i + 1}. ${t.title || '(untitled)'}
   ${t.url}
   id: ${t.targetId}`
        ).join('\n')
      );
    });
  });
  const tab = browser.command('tab').description('Tab shortcuts (index-based)').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/tabs/action',
          query: profile ? { profile } : void 0,
          body: {
            action: 'list'
          }
        },
        { timeoutMs: 1e4 }
      );
      const tabs = result.tabs ?? [];
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ tabs }, null, 2));
        return;
      }
      if (tabs.length === 0) {
        defaultRuntime.log('No tabs (browser closed or no targets).');
        return;
      }
      defaultRuntime.log(
        tabs.map(
          (t, i) => `${i + 1}. ${t.title || '(untitled)'}
   ${t.url}
   id: ${t.targetId}`
        ).join('\n')
      );
    });
  });
  tab.command('new').description('Open a new tab (about:blank)').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/tabs/action',
          query: profile ? { profile } : void 0,
          body: { action: 'new' }
        },
        { timeoutMs: 1e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log('opened new tab');
    });
  });
  tab.command('select').description('Focus tab by index (1-based)').argument('<index>', 'Tab index (1-based)', (v) => Number(v)).action(async (index, _opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    if (!Number.isFinite(index) || index < 1) {
      defaultRuntime.error(danger('index must be a positive number'));
      defaultRuntime.exit(1);
      return;
    }
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/tabs/action',
          query: profile ? { profile } : void 0,
          body: { action: 'select', index: Math.floor(index) - 1 }
        },
        { timeoutMs: 1e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log(`selected tab ${Math.floor(index)}`);
    });
  });
  tab.command('close').description('Close tab by index (1-based); default: first tab').argument('[index]', 'Tab index (1-based)', (v) => Number(v)).action(async (index, _opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    const idx = typeof index === 'number' && Number.isFinite(index) ? Math.floor(index) - 1 : void 0;
    if (typeof idx === 'number' && idx < 0) {
      defaultRuntime.error(danger('index must be >= 1'));
      defaultRuntime.exit(1);
      return;
    }
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/tabs/action',
          query: profile ? { profile } : void 0,
          body: { action: 'close', index: idx }
        },
        { timeoutMs: 1e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      defaultRuntime.log('closed tab');
    });
  });
  browser.command('open').description('Open a URL in a new tab').argument('<url>', 'URL to open').action(async (url, _opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      const tab2 = await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/tabs/open',
          query: profile ? { profile } : void 0,
          body: { url }
        },
        { timeoutMs: 15e3 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(tab2, null, 2));
        return;
      }
      defaultRuntime.log(`opened: ${tab2.url}
id: ${tab2.targetId}`);
    });
  });
  browser.command('focus').description('Focus a tab by target id (or unique prefix)').argument('<targetId>', 'Target id or unique prefix').action(async (targetId, _opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      await callBrowserRequest(
        parent,
        {
          method: 'POST',
          path: '/tabs/focus',
          query: profile ? { profile } : void 0,
          body: { targetId }
        },
        { timeoutMs: 5e3 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ ok: true }, null, 2));
        return;
      }
      defaultRuntime.log(`focused tab ${targetId}`);
    });
  });
  browser.command('close').description('Close a tab (target id optional)').argument('[targetId]', 'Target id or unique prefix (optional)').action(async (targetId, _opts, cmd) => {
    const parent = parentOpts(cmd);
    const profile = parent?.browserProfile;
    await runBrowserCommand(async () => {
      if (targetId?.trim()) {
        await callBrowserRequest(
          parent,
          {
            method: 'DELETE',
            path: `/tabs/${encodeURIComponent(targetId.trim())}`,
            query: profile ? { profile } : void 0
          },
          { timeoutMs: 5e3 }
        );
      } else {
        await callBrowserRequest(
          parent,
          {
            method: 'POST',
            path: '/act',
            query: profile ? { profile } : void 0,
            body: { kind: 'close' }
          },
          { timeoutMs: 2e4 }
        );
      }
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ ok: true }, null, 2));
        return;
      }
      defaultRuntime.log('closed tab');
    });
  });
  browser.command('profiles').description('List all browser profiles').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'GET',
          path: '/profiles'
        },
        { timeoutMs: 3e3 }
      );
      const profiles = result.profiles ?? [];
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ profiles }, null, 2));
        return;
      }
      if (profiles.length === 0) {
        defaultRuntime.log('No profiles configured.');
        return;
      }
      defaultRuntime.log(
        profiles.map((p) => {
          const status = p.running ? 'running' : 'stopped';
          const tabs = p.running ? ` (${p.tabCount} tabs)` : '';
          const def = p.isDefault ? ' [default]' : '';
          const loc = p.isRemote ? `cdpUrl: ${p.cdpUrl}` : `port: ${p.cdpPort}`;
          const remote = p.isRemote ? ' [remote]' : '';
          return `${p.name}: ${status}${tabs}${def}${remote}
  ${loc}, color: ${p.color}`;
        }).join('\n')
      );
    });
  });
  browser.command('create-profile').description('Create a new browser profile').requiredOption('--name <name>', 'Profile name (lowercase, numbers, hyphens)').option('--color <hex>', 'Profile color (hex format, e.g. #0066CC)').option('--cdp-url <url>', 'CDP URL for remote Chrome (http/https)').option('--driver <driver>', 'Profile driver (openclaw|extension). Default: openclaw').action(
    async (opts, cmd) => {
      const parent = parentOpts(cmd);
      await runBrowserCommand(async () => {
        const result = await callBrowserRequest(
          parent,
          {
            method: 'POST',
            path: '/profiles/create',
            body: {
              name: opts.name,
              color: opts.color,
              cdpUrl: opts.cdpUrl,
              driver: opts.driver === 'extension' ? 'extension' : void 0
            }
          },
          { timeoutMs: 1e4 }
        );
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        const loc = result.isRemote ? `  cdpUrl: ${result.cdpUrl}` : `  port: ${result.cdpPort}`;
        defaultRuntime.log(
          info(
            `\u{1F99E} Created profile "${result.profile}"
${loc}
  color: ${result.color}${opts.driver === 'extension' ? '\n  driver: extension' : ''}`
          )
        );
      });
    }
  );
  browser.command('delete-profile').description('Delete a browser profile').requiredOption('--name <name>', 'Profile name to delete').action(async (opts, cmd) => {
    const parent = parentOpts(cmd);
    await runBrowserCommand(async () => {
      const result = await callBrowserRequest(
        parent,
        {
          method: 'DELETE',
          path: `/profiles/${encodeURIComponent(opts.name)}`
        },
        { timeoutMs: 2e4 }
      );
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      const msg = result.deleted ? `\u{1F99E} Deleted profile "${result.profile}" (user data removed)` : `\u{1F99E} Deleted profile "${result.profile}" (no user data found)`;
      defaultRuntime.log(info(msg));
    });
  });
}
__name(registerBrowserManageCommands, 'registerBrowserManageCommands');
export {
  registerBrowserManageCommands
};
