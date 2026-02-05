/**
 * @module docs-path
 * Documentation file path resolution for agent help references.
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveOpenClawPackageRoot } from '../infra/openclaw-root.js';
async function resolveOpenClawDocsPath(params) {
  const workspaceDir = params.workspaceDir?.trim();
  if (workspaceDir) {
    const workspaceDocs = path.join(workspaceDir, 'docs');
    if (fs.existsSync(workspaceDocs)) {
      return workspaceDocs;
    }
  }
  const packageRoot = await resolveOpenClawPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl
  });
  if (!packageRoot) {
    return null;
  }
  const packageDocs = path.join(packageRoot, 'docs');
  return fs.existsSync(packageDocs) ? packageDocs : null;
}
export {
  resolveOpenClawDocsPath
};
