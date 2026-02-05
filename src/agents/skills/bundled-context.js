/**
 * Bundled context loading for agent skills.
 * @module agents/skills/bundled-context
 */
import { loadSkillsFromDir } from '@mariozechner/pi-coding-agent';
import { createSubsystemLogger } from '../../logging/subsystem.js';
import { resolveBundledSkillsDir } from './bundled-dir.js';
const skillsLogger = createSubsystemLogger('skills');
let hasWarnedMissingBundledDir = false;
function resolveBundledSkillsContext(opts = {}) {
  const dir = resolveBundledSkillsDir(opts);
  const names = /* @__PURE__ */ new Set();
  if (!dir) {
    if (!hasWarnedMissingBundledDir) {
      hasWarnedMissingBundledDir = true;
      skillsLogger.warn(
        'Bundled skills directory could not be resolved; built-in skills may be missing.'
      );
    }
    return { dir, names };
  }
  const result = loadSkillsFromDir({ dir, source: 'openclaw-bundled' });
  for (const skill of result.skills) {
    if (skill.name.trim()) {
      names.add(skill.name);
    }
  }
  return { dir, names };
}
export {
  resolveBundledSkillsContext
};
