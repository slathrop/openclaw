const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function applyNonInteractiveSkillsConfig(params) {
  const { nextConfig, opts, runtime } = params;
  if (opts.skipSkills) {
    return nextConfig;
  }
  const nodeManager = opts.nodeManager ?? 'npm';
  if (!['npm', 'pnpm', 'bun'].includes(nodeManager)) {
    runtime.error('Invalid --node-manager (use npm, pnpm, or bun)');
    runtime.exit(1);
    return nextConfig;
  }
  return {
    ...nextConfig,
    skills: {
      ...nextConfig.skills,
      install: {
        ...nextConfig.skills?.install,
        nodeManager
      }
    }
  };
}
__name(applyNonInteractiveSkillsConfig, 'applyNonInteractiveSkillsConfig');
export {
  applyNonInteractiveSkillsConfig
};
