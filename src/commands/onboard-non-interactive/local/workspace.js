const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveUserPath } from '../../../utils.js';
function resolveNonInteractiveWorkspaceDir(params) {
  const raw = (params.opts.workspace ?? params.baseConfig.agents?.defaults?.workspace ?? params.defaultWorkspaceDir).trim();
  return resolveUserPath(raw);
}
__name(resolveNonInteractiveWorkspaceDir, 'resolveNonInteractiveWorkspaceDir');
export {
  resolveNonInteractiveWorkspaceDir
};
