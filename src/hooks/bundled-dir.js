import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
function resolveBundledHooksDir() {
  const override = process.env.OPENCLAW_BUNDLED_HOOKS_DIR?.trim();
  if (override) {
    return override;
  }
  try {
    const execDir = path.dirname(process.execPath);
    const sibling = path.join(execDir, 'hooks', 'bundled');
    if (fs.existsSync(sibling)) {
      return sibling;
    }
  } catch {
    // Intentionally ignored
  }
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const distBundled = path.join(moduleDir, 'bundled');
    if (fs.existsSync(distBundled)) {
      return distBundled;
    }
  } catch {
    // Intentionally ignored
  }
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(moduleDir, '..', '..');
    const srcBundled = path.join(root, 'src', 'hooks', 'bundled');
    if (fs.existsSync(srcBundled)) {
      return srcBundled;
    }
  } catch {
    // Intentionally ignored
  }
  return void 0;
}
export {
  resolveBundledHooksDir
};
