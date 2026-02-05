import path from 'node:path';
import { resolveGatewayProfileSuffix } from './constants.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const windowsAbsolutePath = /^[a-zA-Z]:[\\/]/;
const windowsUncPath = /^\\\\/;
function resolveHomeDir(env) {
  const home = env.HOME?.trim() || env.USERPROFILE?.trim();
  if (!home) {
    throw new Error('Missing HOME');
  }
  return home;
}
function resolveUserPathWithHome(input, home) {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('~')) {
    if (!home) {
      throw new Error('Missing HOME');
    }
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, home);
    return path.resolve(expanded);
  }
  if (windowsAbsolutePath.test(trimmed) || windowsUncPath.test(trimmed)) {
    return trimmed;
  }
  return path.resolve(trimmed);
}
function resolveGatewayStateDir(env) {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    const home2 = override.startsWith('~') ? resolveHomeDir(env) : void 0;
    return resolveUserPathWithHome(override, home2);
  }
  const home = resolveHomeDir(env);
  const suffix = resolveGatewayProfileSuffix(env.OPENCLAW_PROFILE);
  return path.join(home, `.openclaw${suffix}`);
}
export {
  resolveGatewayStateDir,
  resolveHomeDir,
  resolveUserPathWithHome
};
