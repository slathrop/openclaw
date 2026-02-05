/** @module memory/sqlite - SQLite database access layer for memory indexing. */
// SECURITY: Database access layer using node:sqlite. All SQL queries use parameterized
// SECURITY: statements to prevent SQL injection. Database files are scoped to agent
// SECURITY: workspace directories. File system access is restricted to configured paths.
import { createRequire } from 'node:module';
import { installProcessWarningFilter } from '../infra/warnings.js';
const require2 = createRequire(import.meta.url);
function requireNodeSqlite() {
  installProcessWarningFilter();
  return require2('node:sqlite');
}
export {
  requireNodeSqlite
};
