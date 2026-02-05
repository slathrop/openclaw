import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSkillsPromptForRun } from './skills.js';
// eslint-disable-next-line no-unused-vars
async function _writeSkill(params) {
  const { dir, name, description, metadata, body } = params;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'SKILL.md'),
    `---
name: ${name}
description: ${description}${metadata ? `
metadata: ${metadata}` : ''}
---

${body ?? `# ${name}
`}
`,
    'utf-8'
  );
}
describe('resolveSkillsPromptForRun', () => {
  it('prefers snapshot prompt when available', () => {
    const prompt = resolveSkillsPromptForRun({
      skillsSnapshot: { prompt: 'SNAPSHOT', skills: [] },
      workspaceDir: '/tmp/openclaw'
    });
    expect(prompt).toBe('SNAPSHOT');
  });
  it('builds prompt from entries when snapshot is missing', () => {
    const entry = {
      skill: {
        name: 'demo-skill',
        description: 'Demo',
        filePath: '/app/skills/demo-skill/SKILL.md',
        baseDir: '/app/skills/demo-skill',
        source: 'openclaw-bundled'
      },
      frontmatter: {}
    };
    const prompt = resolveSkillsPromptForRun({
      entries: [entry],
      workspaceDir: '/tmp/openclaw'
    });
    expect(prompt).toContain('<available_skills>');
    expect(prompt).toContain('/app/skills/demo-skill/SKILL.md');
  });
});
