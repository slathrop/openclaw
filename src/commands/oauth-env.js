const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: OAuth environment variable credential resolution
import { isWSLEnv } from '../infra/wsl.js';
function isRemoteEnvironment() {
  if (process.env.SSH_CLIENT || process.env.SSH_TTY || process.env.SSH_CONNECTION) {
    return true;
  }
  if (process.env.REMOTE_CONTAINERS || process.env.CODESPACES) {
    return true;
  }
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && !isWSLEnv()) {
    return true;
  }
  return false;
}
__name(isRemoteEnvironment, 'isRemoteEnvironment');
export {
  isRemoteEnvironment
};
