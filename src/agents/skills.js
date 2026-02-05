/**
 * @module skills
 * Skill configuration resolution and registry management.
 */
import {
  hasBinary,
  isBundledSkillAllowed,
  isConfigPathTruthy,
  resolveBundledAllowlist,
  resolveConfigPath,
  resolveRuntimePlatform,
  resolveSkillConfig
} from './skills/config.js';
import {
  applySkillEnvOverrides,
  applySkillEnvOverridesFromSnapshot
} from './skills/env-overrides.js';
import {
  buildWorkspaceSkillSnapshot,
  buildWorkspaceSkillsPrompt,
  buildWorkspaceSkillCommandSpecs,
  filterWorkspaceSkillEntries,
  loadWorkspaceSkillEntries,
  resolveSkillsPromptForRun,
  syncSkillsToWorkspace
} from './skills/workspace.js';
function resolveSkillsInstallPreferences(config) {
  const raw = config?.skills?.install;
  const preferBrew = raw?.preferBrew ?? true;
  const managerRaw = typeof raw?.nodeManager === 'string' ? raw.nodeManager.trim() : '';
  const manager = managerRaw.toLowerCase();
  const nodeManager = manager === 'pnpm' || manager === 'yarn' || manager === 'bun' || manager === 'npm' ? manager : 'npm';
  return { preferBrew, nodeManager };
}
export {
  applySkillEnvOverrides,
  applySkillEnvOverridesFromSnapshot,
  buildWorkspaceSkillCommandSpecs,
  buildWorkspaceSkillSnapshot,
  buildWorkspaceSkillsPrompt,
  filterWorkspaceSkillEntries,
  hasBinary,
  isBundledSkillAllowed,
  isConfigPathTruthy,
  loadWorkspaceSkillEntries,
  resolveBundledAllowlist,
  resolveConfigPath,
  resolveRuntimePlatform,
  resolveSkillConfig,
  resolveSkillsInstallPreferences,
  resolveSkillsPromptForRun,
  syncSkillsToWorkspace
};
