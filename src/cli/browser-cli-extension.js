const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { movePathToTrash } from '../browser/trash.js';
import { STATE_DIR } from '../config/paths.js';
import { danger, info } from '../globals.js';
import { copyToClipboard } from '../infra/clipboard.js';
import { defaultRuntime } from '../runtime.js';
import { formatDocsLink } from '../terminal/links.js';
import { theme } from '../terminal/theme.js';
import { shortenHomePath } from '../utils.js';
import { formatCliCommand } from './command-format.js';
function bundledExtensionRootDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));

  // `here` is the directory containing this file.
  // - In source runs/tests, it's typically `<packageRoot>/src/cli`.
  // - In transpiled builds, it's typically `<packageRoot>/dist/cli`.
  // - In bundled builds, it may be `<packageRoot>/dist`.
  // The bundled extension lives at `<packageRoot>/assets/chrome-extension`.
  //
  // Prefer the most common layouts first and fall back if needed.
  const candidates = [
    path.resolve(here, '../assets/chrome-extension'),
    path.resolve(here, '../../assets/chrome-extension')
  ];
  for (const candidate of candidates) {
    if (hasManifest(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}
__name(bundledExtensionRootDir, 'bundledExtensionRootDir');
function installedExtensionRootDir() {
  return path.join(STATE_DIR, 'browser', 'chrome-extension');
}
__name(installedExtensionRootDir, 'installedExtensionRootDir');
function hasManifest(dir) {
  return fs.existsSync(path.join(dir, 'manifest.json'));
}
__name(hasManifest, 'hasManifest');
async function installChromeExtension(opts) {
  const src = opts?.sourceDir ?? bundledExtensionRootDir();
  if (!hasManifest(src)) {
    throw new Error('Bundled Chrome extension is missing. Reinstall OpenClaw and try again.');
  }
  const stateDir = opts?.stateDir ?? STATE_DIR;
  const dest = path.join(stateDir, 'browser', 'chrome-extension');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    await movePathToTrash(dest).catch(() => {
      const backup = `${dest}.old-${Date.now()}`;
      fs.renameSync(dest, backup);
    });
  }
  await fs.promises.cp(src, dest, { recursive: true });
  if (!hasManifest(dest)) {
    throw new Error('Chrome extension install failed (manifest.json missing). Try again.');
  }
  return { path: dest };
}
__name(installChromeExtension, 'installChromeExtension');
function registerBrowserExtensionCommands(browser, parentOpts) {
  const ext = browser.command('extension').description('Chrome extension helpers');
  ext.command('install').description('Install the Chrome extension to a stable local path').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    let installed;
    try {
      installed = await installChromeExtension();
    } catch (err) {
      defaultRuntime.error(danger(String(err)));
      defaultRuntime.exit(1);
    }
    if (parent?.json) {
      defaultRuntime.log(JSON.stringify({ ok: true, path: installed.path }, null, 2));
      return;
    }
    const displayPath = shortenHomePath(installed.path);
    defaultRuntime.log(displayPath);
    const copied = await copyToClipboard(installed.path).catch(() => false);
    defaultRuntime.error(
      info(
        [
          copied ? 'Copied to clipboard.' : 'Copy to clipboard unavailable.',
          'Next:',
          '- Chrome \u2192 chrome://extensions \u2192 enable \u201CDeveloper mode\u201D',
          `- \u201CLoad unpacked\u201D \u2192 select: ${displayPath}`,
          '- Pin \u201COpenClaw Browser Relay\u201D, then click it on the tab (badge shows ON)',
          '',
          `${theme.muted('Docs:')} ${formatDocsLink('/tools/chrome-extension', 'docs.openclaw.ai/tools/chrome-extension')}`
        ].join('\n')
      )
    );
  });
  ext.command('path').description('Print the path to the installed Chrome extension (load unpacked)').action(async (_opts, cmd) => {
    const parent = parentOpts(cmd);
    const dir = installedExtensionRootDir();
    if (!hasManifest(dir)) {
      defaultRuntime.error(
        danger(
          [
            `Chrome extension is not installed. Run: "${formatCliCommand('openclaw browser extension install')}"`,
            `Docs: ${formatDocsLink('/tools/chrome-extension', 'docs.openclaw.ai/tools/chrome-extension')}`
          ].join('\n')
        )
      );
      defaultRuntime.exit(1);
    }
    if (parent?.json) {
      defaultRuntime.log(JSON.stringify({ path: dir }, null, 2));
      return;
    }
    const displayPath = shortenHomePath(dir);
    defaultRuntime.log(displayPath);
    const copied = await copyToClipboard(dir).catch(() => false);
    if (copied) {
      defaultRuntime.error(info('Copied to clipboard.'));
    }
  });
}
__name(registerBrowserExtensionCommands, 'registerBrowserExtensionCommands');
export {
  installChromeExtension,
  registerBrowserExtensionCommands
};
