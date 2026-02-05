/**
 * @param params
 * @module memory/sqlite-vec - SQLite vector extension loader.
 */
async function loadSqliteVecExtension(params) {
  try {
    const sqliteVec = await import('sqlite-vec');
    const resolvedPath = params.extensionPath?.trim() ? params.extensionPath.trim() : void 0;
    const extensionPath = resolvedPath ?? sqliteVec.getLoadablePath();
    params.db.enableLoadExtension(true);
    if (resolvedPath) {
      params.db.loadExtension(extensionPath);
    } else {
      sqliteVec.load(params.db);
    }
    return { ok: true, extensionPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
export {
  loadSqliteVecExtension
};
