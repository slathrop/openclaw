/** @module memory/manager - Core memory index manager with embedding, indexing, and search. */
// SECURITY: This module handles memory data persistence including embedding storage,
// SECURITY: file content indexing, and search query processing. The SQLite database
// SECURITY: stores document content and embeddings. Access control relies on agent
// SECURITY: scoping via agentId and workspace directory isolation.
import chokidar from 'chokidar';
import { randomUUID } from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveAgentDir, resolveAgentWorkspaceDir } from '../agents/agent-scope.js';
import { resolveMemorySearchConfig } from '../agents/memory-search.js';
import { resolveSessionTranscriptsDirForAgent } from '../config/sessions/paths.js';
import { createSubsystemLogger } from '../logging/subsystem.js';
import { onSessionTranscriptUpdate } from '../sessions/transcript-events.js';
import { resolveUserPath } from '../utils.js';
import { runGeminiEmbeddingBatches } from './batch-gemini.js';
import {
  OPENAI_BATCH_ENDPOINT,
  runOpenAiEmbeddingBatches
} from './batch-openai.js';
import { DEFAULT_GEMINI_EMBEDDING_MODEL } from './embeddings-gemini.js';
import { DEFAULT_OPENAI_EMBEDDING_MODEL } from './embeddings-openai.js';
import {
  createEmbeddingProvider
} from './embeddings.js';
import { bm25RankToScore, buildFtsQuery, mergeHybridResults } from './hybrid.js';
import {
  buildFileEntry,
  chunkMarkdown,
  ensureDir,
  hashText,
  isMemoryPath,
  listMemoryFiles,
  normalizeExtraMemoryPaths,
  parseEmbedding
} from './internal.js';
import { searchKeyword, searchVector } from './manager-search.js';
import { ensureMemoryIndexSchema } from './memory-schema.js';
import { loadSqliteVecExtension } from './sqlite-vec.js';
import { requireNodeSqlite } from './sqlite.js';
const META_KEY = 'memory_index_meta_v1';
const SNIPPET_MAX_CHARS = 700;
const VECTOR_TABLE = 'chunks_vec';
const FTS_TABLE = 'chunks_fts';
const EMBEDDING_CACHE_TABLE = 'embedding_cache';
const SESSION_DIRTY_DEBOUNCE_MS = 5e3;
const EMBEDDING_BATCH_MAX_TOKENS = 8e3;
const EMBEDDING_APPROX_CHARS_PER_TOKEN = 1;
const EMBEDDING_INDEX_CONCURRENCY = 4;
const EMBEDDING_RETRY_MAX_ATTEMPTS = 3;
const EMBEDDING_RETRY_BASE_DELAY_MS = 500;
const EMBEDDING_RETRY_MAX_DELAY_MS = 8e3;
const BATCH_FAILURE_LIMIT = 2;
const SESSION_DELTA_READ_CHUNK_BYTES = 64 * 1024;
const VECTOR_LOAD_TIMEOUT_MS = 3e4;
const EMBEDDING_QUERY_TIMEOUT_REMOTE_MS = 6e4;
const EMBEDDING_QUERY_TIMEOUT_LOCAL_MS = 5 * 6e4;
const EMBEDDING_BATCH_TIMEOUT_REMOTE_MS = 2 * 6e4;
const EMBEDDING_BATCH_TIMEOUT_LOCAL_MS = 10 * 6e4;
const log = createSubsystemLogger('memory');
const INDEX_CACHE = /* @__PURE__ */ new Map();
const vectorToBlob = (embedding) => Buffer.from(new Float32Array(embedding).buffer);
/**
 * @implements {MemorySearchManager}
 */
class MemoryIndexManager {
  _cacheKey;
  _cfg;
  _agentId;
  _workspaceDir;
  _settings;
  _provider;
  _requestedProvider;
  _fallbackFrom;
  _fallbackReason;
  _openAi;
  _gemini;
  _batch;
  _batchFailureCount = 0;
  _batchFailureLastError;
  _batchFailureLastProvider;
  _batchFailureLock = Promise.resolve();
  _db;
  _sources;
  _providerKey;
  _cache;
  _vector;
  _fts;
  _vectorReady = null;
  _watcher = null;
  _watchTimer = null;
  _sessionWatchTimer = null;
  _sessionUnsubscribe = null;
  _intervalTimer = null;
  _closed = false;
  _dirty = false;
  _sessionsDirty = false;
  _sessionsDirtyFiles = /* @__PURE__ */ new Set();
  _sessionPendingFiles = /* @__PURE__ */ new Set();
  _sessionDeltas = /* @__PURE__ */ new Map();
  _sessionWarm = /* @__PURE__ */ new Set();
  _syncing = null;
  static async get(params) {
    const { cfg, agentId } = params;
    const settings = resolveMemorySearchConfig(cfg, agentId);
    if (!settings) {
      return null;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const key = `${agentId}:${workspaceDir}:${JSON.stringify(settings)}`;
    const existing = INDEX_CACHE.get(key);
    if (existing) {
      return existing;
    }
    const providerResult = await createEmbeddingProvider({
      config: cfg,
      agentDir: resolveAgentDir(cfg, agentId),
      provider: settings.provider,
      remote: settings.remote,
      model: settings.model,
      fallback: settings.fallback,
      local: settings.local
    });
    const manager = new MemoryIndexManager({
      cacheKey: key,
      cfg,
      agentId,
      workspaceDir,
      settings,
      providerResult
    });
    INDEX_CACHE.set(key, manager);
    return manager;
  }
  constructor(params) {
    this._cacheKey = params.cacheKey;
    this._cfg = params.cfg;
    this._agentId = params.agentId;
    this._workspaceDir = params.workspaceDir;
    this._settings = params.settings;
    this._provider = params.providerResult.provider;
    this._requestedProvider = params.providerResult.requestedProvider;
    this._fallbackFrom = params.providerResult.fallbackFrom;
    this._fallbackReason = params.providerResult.fallbackReason;
    this._openAi = params.providerResult.openAi;
    this._gemini = params.providerResult.gemini;
    this._sources = new Set(params.settings.sources);
    this._db = this._openDatabase();
    this._providerKey = this._computeProviderKey();
    this._cache = {
      enabled: params.settings.cache.enabled,
      maxEntries: params.settings.cache.maxEntries
    };
    this._fts = { enabled: params.settings.query.hybrid.enabled, available: false };
    this._ensureSchema();
    this._vector = {
      enabled: params.settings.store.vector.enabled,
      available: null,
      extensionPath: params.settings.store.vector.extensionPath
    };
    const meta = this._readMeta();
    if (meta?.vectorDims) {
      this._vector.dims = meta.vectorDims;
    }
    this._ensureWatcher();
    this._ensureSessionListener();
    this._ensureIntervalSync();
    this._dirty = this._sources.has('memory');
    this._batch = this._resolveBatchConfig();
  }
  async warmSession(sessionKey) {
    if (!this._settings.sync.onSessionStart) {
      return;
    }
    const key = sessionKey?.trim() || '';
    if (key && this._sessionWarm.has(key)) {
      return;
    }
    void this.sync({ reason: 'session-start' }).catch((err) => {
      log.warn(`memory sync failed (session-start): ${String(err)}`);
    });
    if (key) {
      this._sessionWarm.add(key);
    }
  }
  async search(query, opts) {
    void this.warmSession(opts?.sessionKey);
    if (this._settings.sync.onSearch && (this._dirty || this._sessionsDirty)) {
      void this.sync({ reason: 'search' }).catch((err) => {
        log.warn(`memory sync failed (search): ${String(err)}`);
      });
    }
    const cleaned = query.trim();
    if (!cleaned) {
      return [];
    }
    const minScore = opts?.minScore ?? this._settings.query.minScore;
    const maxResults = opts?.maxResults ?? this._settings.query.maxResults;
    const hybrid = this._settings.query.hybrid;
    const candidates = Math.min(
      200,
      Math.max(1, Math.floor(maxResults * hybrid.candidateMultiplier))
    );
    const keywordResults = hybrid.enabled ? await this._searchKeyword(cleaned, candidates).catch(() => []) : [];
    const queryVec = await this._embedQueryWithTimeout(cleaned);
    const hasVector = queryVec.some((v) => v !== 0);
    const vectorResults = hasVector ? await this._searchVector(queryVec, candidates).catch(() => []) : [];
    if (!hybrid.enabled) {
      return vectorResults.filter((entry) => entry.score >= minScore).slice(0, maxResults);
    }
    const merged = this._mergeHybridResults({
      vector: vectorResults,
      keyword: keywordResults,
      vectorWeight: hybrid.vectorWeight,
      textWeight: hybrid.textWeight
    });
    return merged.filter((entry) => entry.score >= minScore).slice(0, maxResults);
  }
  async _searchVector(queryVec, limit) {
    const results = await searchVector({
      db: this._db,
      vectorTable: VECTOR_TABLE,
      providerModel: this._provider.model,
      queryVec,
      limit,
      snippetMaxChars: SNIPPET_MAX_CHARS,
      ensureVectorReady: async (dimensions) => await this._ensureVectorReady(dimensions),
      sourceFilterVec: this._buildSourceFilter('c'),
      sourceFilterChunks: this._buildSourceFilter()
    });
    return results.map((entry) => entry);
  }
  _buildFtsQuery(raw) {
    return buildFtsQuery(raw);
  }
  async _searchKeyword(query, limit) {
    if (!this._fts.enabled || !this._fts.available) {
      return [];
    }
    const sourceFilter = this._buildSourceFilter();
    const results = await searchKeyword({
      db: this._db,
      ftsTable: FTS_TABLE,
      providerModel: this._provider.model,
      query,
      limit,
      snippetMaxChars: SNIPPET_MAX_CHARS,
      sourceFilter,
      buildFtsQuery: (raw) => this._buildFtsQuery(raw),
      bm25RankToScore
    });
    return results.map((entry) => entry);
  }
  _mergeHybridResults(params) {
    const merged = mergeHybridResults({
      vector: params.vector.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        vectorScore: r.score
      })),
      keyword: params.keyword.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        textScore: r.textScore
      })),
      vectorWeight: params.vectorWeight,
      textWeight: params.textWeight
    });
    return merged.map((entry) => entry);
  }
  async sync(params) {
    if (this._syncing) {
      return this._syncing;
    }
    this._syncing = this._runSync(params).finally(() => {
      this._syncing = null;
    });
    return this._syncing;
  }
  async readFile(params) {
    const rawPath = params.relPath.trim();
    if (!rawPath) {
      throw new Error('path required');
    }
    const absPath = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(this._workspaceDir, rawPath);
    const relPath = path.relative(this._workspaceDir, absPath).replace(/\\/g, '/');
    const inWorkspace = relPath.length > 0 && !relPath.startsWith('..') && !path.isAbsolute(relPath);
    const allowedWorkspace = inWorkspace && isMemoryPath(relPath);
    let allowedAdditional = false;
    if (!allowedWorkspace && this._settings.extraPaths.length > 0) {
      const additionalPaths = normalizeExtraMemoryPaths(
        this._workspaceDir,
        this._settings.extraPaths
      );
      for (const additionalPath of additionalPaths) {
        try {
          const stat2 = await fs.lstat(additionalPath);
          if (stat2.isSymbolicLink()) {
            continue;
          }
          if (stat2.isDirectory()) {
            if (absPath === additionalPath || absPath.startsWith(`${additionalPath}${path.sep}`)) {
              allowedAdditional = true;
              break;
            }
            continue;
          }
          if (stat2.isFile()) {
            if (absPath === additionalPath && absPath.endsWith('.md')) {
              allowedAdditional = true;
              break;
            }
          }
        } catch { /* intentionally ignored */ }
      }
    }
    if (!allowedWorkspace && !allowedAdditional) {
      throw new Error('path required');
    }
    if (!absPath.endsWith('.md')) {
      throw new Error('path required');
    }
    const stat = await fs.lstat(absPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error('path required');
    }
    const content = await fs.readFile(absPath, 'utf-8');
    if (!params.from && !params.lines) {
      return { text: content, path: relPath };
    }
    const lines = content.split('\n');
    const start = Math.max(1, params.from ?? 1);
    const count = Math.max(1, params.lines ?? lines.length);
    const slice = lines.slice(start - 1, start - 1 + count);
    return { text: slice.join('\n'), path: relPath };
  }
  status() {
    const sourceFilter = this._buildSourceFilter();
    const files = this._db.prepare(`SELECT COUNT(*) as c FROM files WHERE 1=1${sourceFilter.sql}`).get(...sourceFilter.params);
    const chunks = this._db.prepare(`SELECT COUNT(*) as c FROM chunks WHERE 1=1${sourceFilter.sql}`).get(...sourceFilter.params);
    const sourceCounts = (() => {
      const sources = Array.from(this._sources);
      if (sources.length === 0) {
        return [];
      }
      const bySource = /* @__PURE__ */ new Map();
      for (const source of sources) {
        bySource.set(source, { files: 0, chunks: 0 });
      }
      const fileRows = this._db.prepare(
        `SELECT source, COUNT(*) as c FROM files WHERE 1=1${sourceFilter.sql} GROUP BY source`
      ).all(...sourceFilter.params);
      for (const row of fileRows) {
        const entry = bySource.get(row.source) ?? { files: 0, chunks: 0 };
        entry.files = row.c ?? 0;
        bySource.set(row.source, entry);
      }
      const chunkRows = this._db.prepare(
        `SELECT source, COUNT(*) as c FROM chunks WHERE 1=1${sourceFilter.sql} GROUP BY source`
      ).all(...sourceFilter.params);
      for (const row of chunkRows) {
        const entry = bySource.get(row.source) ?? { files: 0, chunks: 0 };
        entry.chunks = row.c ?? 0;
        bySource.set(row.source, entry);
      }
      return sources.map((source) => Object.assign({ source }, bySource.get(source)));
    })();
    return {
      backend: 'builtin',
      files: files?.c ?? 0,
      chunks: chunks?.c ?? 0,
      dirty: this._dirty || this._sessionsDirty,
      workspaceDir: this._workspaceDir,
      dbPath: this._settings.store.path,
      provider: this._provider.id,
      model: this._provider.model,
      requestedProvider: this._requestedProvider,
      sources: Array.from(this._sources),
      extraPaths: this._settings.extraPaths,
      sourceCounts,
      cache: this._cache.enabled ? {
        enabled: true,
        entries: this._db.prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`).get()?.c ?? 0,
        maxEntries: this._cache.maxEntries
      } : { enabled: false, maxEntries: this._cache.maxEntries },
      fts: {
        enabled: this._fts.enabled,
        available: this._fts.available,
        error: this._fts.loadError
      },
      fallback: this._fallbackReason ? { from: this._fallbackFrom ?? 'local', reason: this._fallbackReason } : void 0,
      vector: {
        enabled: this._vector.enabled,
        available: this._vector.available ?? void 0,
        extensionPath: this._vector.extensionPath,
        loadError: this._vector.loadError,
        dims: this._vector.dims
      },
      batch: {
        enabled: this._batch.enabled,
        failures: this._batchFailureCount,
        limit: BATCH_FAILURE_LIMIT,
        wait: this._batch.wait,
        concurrency: this._batch.concurrency,
        pollIntervalMs: this._batch.pollIntervalMs,
        timeoutMs: this._batch.timeoutMs,
        lastError: this._batchFailureLastError,
        lastProvider: this._batchFailureLastProvider
      }
    };
  }
  async probeVectorAvailability() {
    if (!this._vector.enabled) {
      return false;
    }
    return this._ensureVectorReady();
  }
  async probeEmbeddingAvailability() {
    try {
      await this._embedBatchWithRetry(['ping']);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }
  async close() {
    if (this._closed) {
      return;
    }
    this._closed = true;
    if (this._watchTimer) {
      clearTimeout(this._watchTimer);
      this._watchTimer = null;
    }
    if (this._sessionWatchTimer) {
      clearTimeout(this._sessionWatchTimer);
      this._sessionWatchTimer = null;
    }
    if (this._intervalTimer) {
      clearInterval(this._intervalTimer);
      this._intervalTimer = null;
    }
    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }
    if (this._sessionUnsubscribe) {
      this._sessionUnsubscribe();
      this._sessionUnsubscribe = null;
    }
    this._db.close();
    INDEX_CACHE.delete(this._cacheKey);
  }
  async _ensureVectorReady(dimensions) {
    if (!this._vector.enabled) {
      return false;
    }
    if (!this._vectorReady) {
      this._vectorReady = this._withTimeout(
        this._loadVectorExtension(),
        VECTOR_LOAD_TIMEOUT_MS,
        `sqlite-vec load timed out after ${Math.round(VECTOR_LOAD_TIMEOUT_MS / 1e3)}s`
      );
    }
    let ready = false;
    try {
      ready = await this._vectorReady;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._vector.available = false;
      this._vector.loadError = message;
      this._vectorReady = null;
      log.warn(`sqlite-vec unavailable: ${message}`);
      return false;
    }
    if (ready && typeof dimensions === 'number' && dimensions > 0) {
      this._ensureVectorTable(dimensions);
    }
    return ready;
  }
  async _loadVectorExtension() {
    if (this._vector.available !== null) {
      return this._vector.available;
    }
    if (!this._vector.enabled) {
      this._vector.available = false;
      return false;
    }
    try {
      const resolvedPath = this._vector.extensionPath?.trim() ? resolveUserPath(this._vector.extensionPath) : void 0;
      const loaded = await loadSqliteVecExtension({ db: this._db, extensionPath: resolvedPath });
      if (!loaded.ok) {
        throw new Error(loaded.error ?? 'unknown sqlite-vec load error');
      }
      this._vector.extensionPath = loaded.extensionPath;
      this._vector.available = true;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._vector.available = false;
      this._vector.loadError = message;
      log.warn(`sqlite-vec unavailable: ${message}`);
      return false;
    }
  }
  _ensureVectorTable(dimensions) {
    if (this._vector.dims === dimensions) {
      return;
    }
    if (this._vector.dims && this._vector.dims !== dimensions) {
      this._dropVectorTable();
    }
    this._db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTOR_TABLE} USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[${dimensions}]
)`
    );
    this._vector.dims = dimensions;
  }
  _dropVectorTable() {
    try {
      this._db.exec(`DROP TABLE IF EXISTS ${VECTOR_TABLE}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.debug(`Failed to drop ${VECTOR_TABLE}: ${message}`);
    }
  }
  _buildSourceFilter(alias) {
    const sources = Array.from(this._sources);
    if (sources.length === 0) {
      return { sql: '', params: [] };
    }
    const column = alias ? `${alias}.source` : 'source';
    const placeholders = sources.map(() => '?').join(', ');
    return { sql: ` AND ${column} IN (${placeholders})`, params: sources };
  }
  _openDatabase() {
    const dbPath = resolveUserPath(this._settings.store.path);
    return this._openDatabaseAtPath(dbPath);
  }
  _openDatabaseAtPath(dbPath) {
    const dir = path.dirname(dbPath);
    ensureDir(dir);
    const { DatabaseSync } = requireNodeSqlite();
    return new DatabaseSync(dbPath, { allowExtension: this._settings.store.vector.enabled });
  }
  _seedEmbeddingCache(sourceDb) {
    if (!this._cache.enabled) {
      return;
    }
    try {
      const rows = sourceDb.prepare(
        `SELECT provider, model, provider_key, hash, embedding, dims, updated_at FROM ${EMBEDDING_CACHE_TABLE}`
      ).all();
      if (!rows.length) {
        return;
      }
      const insert = this._db.prepare(
        `INSERT INTO ${EMBEDDING_CACHE_TABLE} (provider, model, provider_key, hash, embedding, dims, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, model, provider_key, hash) DO UPDATE SET
           embedding=excluded.embedding,
           dims=excluded.dims,
           updated_at=excluded.updated_at`
      );
      this._db.exec('BEGIN');
      for (const row of rows) {
        insert.run(
          row.provider,
          row.model,
          row.provider_key,
          row.hash,
          row.embedding,
          row.dims,
          row.updated_at
        );
      }
      this._db.exec('COMMIT');
    } catch (err) {
      try {
        this._db.exec('ROLLBACK');
      } catch { /* intentionally ignored */ }
      throw err;
    }
  }
  async _swapIndexFiles(targetPath, tempPath) {
    const backupPath = `${targetPath}.backup-${randomUUID()}`;
    await this._moveIndexFiles(targetPath, backupPath);
    try {
      await this._moveIndexFiles(tempPath, targetPath);
    } catch (err) {
      await this._moveIndexFiles(backupPath, targetPath);
      throw err;
    }
    await this._removeIndexFiles(backupPath);
  }
  async _moveIndexFiles(sourceBase, targetBase) {
    const suffixes = ['', '-wal', '-shm'];
    for (const suffix of suffixes) {
      const source = `${sourceBase}${suffix}`;
      const target = `${targetBase}${suffix}`;
      try {
        await fs.rename(source, target);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }
  }
  async _removeIndexFiles(basePath) {
    const suffixes = ['', '-wal', '-shm'];
    await Promise.all(suffixes.map((suffix) => fs.rm(`${basePath}${suffix}`, { force: true })));
  }
  _ensureSchema() {
    const result = ensureMemoryIndexSchema({
      db: this._db,
      embeddingCacheTable: EMBEDDING_CACHE_TABLE,
      ftsTable: FTS_TABLE,
      ftsEnabled: this._fts.enabled
    });
    this._fts.available = result.ftsAvailable;
    if (result.ftsError) {
      this._fts.loadError = result.ftsError;
      log.warn(`fts unavailable: ${result.ftsError}`);
    }
  }
  _ensureWatcher() {
    if (!this._sources.has('memory') || !this._settings.sync.watch || this._watcher) {
      return;
    }
    const additionalPaths = normalizeExtraMemoryPaths(this._workspaceDir, this._settings.extraPaths).map((entry) => {
      try {
        const stat = fsSync.lstatSync(entry);
        return stat.isSymbolicLink() ? null : entry;
      } catch {
        return null;
      }
    }).filter((entry) => Boolean(entry));
    const watchPaths = /* @__PURE__ */ new Set([
      path.join(this._workspaceDir, 'MEMORY.md'),
      path.join(this._workspaceDir, 'memory.md'),
      path.join(this._workspaceDir, 'memory'),
      ...additionalPaths
    ]);
    this._watcher = chokidar.watch(Array.from(watchPaths), {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this._settings.sync.watchDebounceMs,
        pollInterval: 100
      }
    });
    const markDirty = () => {
      this._dirty = true;
      this._scheduleWatchSync();
    };
    this._watcher.on('add', markDirty);
    this._watcher.on('change', markDirty);
    this._watcher.on('unlink', markDirty);
  }
  _ensureSessionListener() {
    if (!this._sources.has('sessions') || this._sessionUnsubscribe) {
      return;
    }
    this._sessionUnsubscribe = onSessionTranscriptUpdate((update) => {
      if (this._closed) {
        return;
      }
      const sessionFile = update.sessionFile;
      if (!this._isSessionFileForAgent(sessionFile)) {
        return;
      }
      this._scheduleSessionDirty(sessionFile);
    });
  }
  _scheduleSessionDirty(sessionFile) {
    this._sessionPendingFiles.add(sessionFile);
    if (this._sessionWatchTimer) {
      return;
    }
    this._sessionWatchTimer = setTimeout(() => {
      this._sessionWatchTimer = null;
      void this._processSessionDeltaBatch().catch((err) => {
        log.warn(`memory session delta failed: ${String(err)}`);
      });
    }, SESSION_DIRTY_DEBOUNCE_MS);
  }
  async _processSessionDeltaBatch() {
    if (this._sessionPendingFiles.size === 0) {
      return;
    }
    const pending = Array.from(this._sessionPendingFiles);
    this._sessionPendingFiles.clear();
    let shouldSync = false;
    for (const sessionFile of pending) {
      const delta = await this._updateSessionDelta(sessionFile);
      if (!delta) {
        continue;
      }
      const bytesThreshold = delta.deltaBytes;
      const messagesThreshold = delta.deltaMessages;
      const bytesHit = bytesThreshold <= 0 ? delta.pendingBytes > 0 : delta.pendingBytes >= bytesThreshold;
      const messagesHit = messagesThreshold <= 0 ? delta.pendingMessages > 0 : delta.pendingMessages >= messagesThreshold;
      if (!bytesHit && !messagesHit) {
        continue;
      }
      this._sessionsDirtyFiles.add(sessionFile);
      this._sessionsDirty = true;
      delta.pendingBytes = bytesThreshold > 0 ? Math.max(0, delta.pendingBytes - bytesThreshold) : 0;
      delta.pendingMessages = messagesThreshold > 0 ? Math.max(0, delta.pendingMessages - messagesThreshold) : 0;
      shouldSync = true;
    }
    if (shouldSync) {
      void this.sync({ reason: 'session-delta' }).catch((err) => {
        log.warn(`memory sync failed (session-delta): ${String(err)}`);
      });
    }
  }
  async _updateSessionDelta(sessionFile) {
    const thresholds = this._settings.sync.sessions;
    if (!thresholds) {
      return null;
    }
    let stat;
    try {
      stat = await fs.stat(sessionFile);
    } catch {
      return null;
    }
    const size = stat.size;
    let state = this._sessionDeltas.get(sessionFile);
    if (!state) {
      state = { lastSize: 0, pendingBytes: 0, pendingMessages: 0 };
      this._sessionDeltas.set(sessionFile, state);
    }
    const deltaBytes = Math.max(0, size - state.lastSize);
    if (deltaBytes === 0 && size === state.lastSize) {
      return {
        deltaBytes: thresholds.deltaBytes,
        deltaMessages: thresholds.deltaMessages,
        pendingBytes: state.pendingBytes,
        pendingMessages: state.pendingMessages
      };
    }
    if (size < state.lastSize) {
      state.lastSize = size;
      state.pendingBytes += size;
      const shouldCountMessages = thresholds.deltaMessages > 0 && (thresholds.deltaBytes <= 0 || state.pendingBytes < thresholds.deltaBytes);
      if (shouldCountMessages) {
        state.pendingMessages += await this._countNewlines(sessionFile, 0, size);
      }
    } else {
      state.pendingBytes += deltaBytes;
      const shouldCountMessages = thresholds.deltaMessages > 0 && (thresholds.deltaBytes <= 0 || state.pendingBytes < thresholds.deltaBytes);
      if (shouldCountMessages) {
        state.pendingMessages += await this._countNewlines(sessionFile, state.lastSize, size);
      }
      state.lastSize = size;
    }
    this._sessionDeltas.set(sessionFile, state);
    return {
      deltaBytes: thresholds.deltaBytes,
      deltaMessages: thresholds.deltaMessages,
      pendingBytes: state.pendingBytes,
      pendingMessages: state.pendingMessages
    };
  }
  async _countNewlines(absPath, start, end) {
    if (end <= start) {
      return 0;
    }
    const handle = await fs.open(absPath, 'r');
    try {
      let offset = start;
      let count = 0;
      const buffer = Buffer.alloc(SESSION_DELTA_READ_CHUNK_BYTES);
      while (offset < end) {
        const toRead = Math.min(buffer.length, end - offset);
        const { bytesRead } = await handle.read(buffer, 0, toRead, offset);
        if (bytesRead <= 0) {
          break;
        }
        for (let i = 0; i < bytesRead; i += 1) {
          if (buffer[i] === 10) {
            count += 1;
          }
        }
        offset += bytesRead;
      }
      return count;
    } finally {
      await handle.close();
    }
  }
  _resetSessionDelta(absPath, size) {
    const state = this._sessionDeltas.get(absPath);
    if (!state) {
      return;
    }
    state.lastSize = size;
    state.pendingBytes = 0;
    state.pendingMessages = 0;
  }
  _isSessionFileForAgent(sessionFile) {
    if (!sessionFile) {
      return false;
    }
    const sessionsDir = resolveSessionTranscriptsDirForAgent(this._agentId);
    const resolvedFile = path.resolve(sessionFile);
    const resolvedDir = path.resolve(sessionsDir);
    return resolvedFile.startsWith(`${resolvedDir}${path.sep}`);
  }
  _ensureIntervalSync() {
    const minutes = this._settings.sync.intervalMinutes;
    if (!minutes || minutes <= 0 || this._intervalTimer) {
      return;
    }
    const ms = minutes * 60 * 1e3;
    this._intervalTimer = setInterval(() => {
      void this.sync({ reason: 'interval' }).catch((err) => {
        log.warn(`memory sync failed (interval): ${String(err)}`);
      });
    }, ms);
  }
  _scheduleWatchSync() {
    if (!this._sources.has('memory') || !this._settings.sync.watch) {
      return;
    }
    if (this._watchTimer) {
      clearTimeout(this._watchTimer);
    }
    this._watchTimer = setTimeout(() => {
      this._watchTimer = null;
      void this.sync({ reason: 'watch' }).catch((err) => {
        log.warn(`memory sync failed (watch): ${String(err)}`);
      });
    }, this._settings.sync.watchDebounceMs);
  }
  _shouldSyncSessions(params, needsFullReindex = false) {
    if (!this._sources.has('sessions')) {
      return false;
    }
    if (params?.force) {
      return true;
    }
    const reason = params?.reason;
    if (reason === 'session-start' || reason === 'watch') {
      return false;
    }
    if (needsFullReindex) {
      return true;
    }
    return this._sessionsDirty && this._sessionsDirtyFiles.size > 0;
  }
  async _syncMemoryFiles(params) {
    const files = await listMemoryFiles(this._workspaceDir, this._settings.extraPaths);
    const fileEntries = await Promise.all(
      files.map(async (file) => buildFileEntry(file, this._workspaceDir))
    );
    log.debug('memory sync: indexing memory files', {
      files: fileEntries.length,
      needsFullReindex: params.needsFullReindex,
      batch: this._batch.enabled,
      concurrency: this._getIndexConcurrency()
    });
    const activePaths = new Set(fileEntries.map((entry) => entry.path));
    if (params.progress) {
      params.progress.total += fileEntries.length;
      params.progress.report({
        completed: params.progress.completed,
        total: params.progress.total,
        label: this._batch.enabled ? 'Indexing memory files (batch)...' : 'Indexing memory files\u2026'
      });
    }
    const tasks = fileEntries.map((entry) => async () => {
      const record = this._db.prepare('SELECT hash FROM files WHERE path = ? AND source = ?').get(entry.path, 'memory');
      if (!params.needsFullReindex && record?.hash === entry.hash) {
        if (params.progress) {
          params.progress.completed += 1;
          params.progress.report({
            completed: params.progress.completed,
            total: params.progress.total
          });
        }
        return;
      }
      await this._indexFile(entry, { source: 'memory' });
      if (params.progress) {
        params.progress.completed += 1;
        params.progress.report({
          completed: params.progress.completed,
          total: params.progress.total
        });
      }
    });
    await this._runWithConcurrency(tasks, this._getIndexConcurrency());
    const staleRows = this._db.prepare('SELECT path FROM files WHERE source = ?').all('memory');
    for (const stale of staleRows) {
      if (activePaths.has(stale.path)) {
        continue;
      }
      this._db.prepare('DELETE FROM files WHERE path = ? AND source = ?').run(stale.path, 'memory');
      try {
        this._db.prepare(
          `DELETE FROM ${VECTOR_TABLE} WHERE id IN (SELECT id FROM chunks WHERE path = ? AND source = ?)`
        ).run(stale.path, 'memory');
      } catch { /* intentionally ignored */ }
      this._db.prepare('DELETE FROM chunks WHERE path = ? AND source = ?').run(stale.path, 'memory');
      if (this._fts.enabled && this._fts.available) {
        try {
          this._db.prepare(`DELETE FROM ${FTS_TABLE} WHERE path = ? AND source = ? AND model = ?`).run(stale.path, 'memory', this._provider.model);
        } catch { /* intentionally ignored */ }
      }
    }
  }
  async _syncSessionFiles(params) {
    const files = await this._listSessionFiles();
    const activePaths = new Set(files.map((file) => this._sessionPathForFile(file)));
    const indexAll = params.needsFullReindex || this._sessionsDirtyFiles.size === 0;
    log.debug('memory sync: indexing session files', {
      files: files.length,
      indexAll,
      dirtyFiles: this._sessionsDirtyFiles.size,
      batch: this._batch.enabled,
      concurrency: this._getIndexConcurrency()
    });
    if (params.progress) {
      params.progress.total += files.length;
      params.progress.report({
        completed: params.progress.completed,
        total: params.progress.total,
        label: this._batch.enabled ? 'Indexing session files (batch)...' : 'Indexing session files\u2026'
      });
    }
    const tasks = files.map((absPath) => async () => {
      if (!indexAll && !this._sessionsDirtyFiles.has(absPath)) {
        if (params.progress) {
          params.progress.completed += 1;
          params.progress.report({
            completed: params.progress.completed,
            total: params.progress.total
          });
        }
        return;
      }
      const entry = await this._buildSessionEntry(absPath);
      if (!entry) {
        if (params.progress) {
          params.progress.completed += 1;
          params.progress.report({
            completed: params.progress.completed,
            total: params.progress.total
          });
        }
        return;
      }
      const record = this._db.prepare('SELECT hash FROM files WHERE path = ? AND source = ?').get(entry.path, 'sessions');
      if (!params.needsFullReindex && record?.hash === entry.hash) {
        if (params.progress) {
          params.progress.completed += 1;
          params.progress.report({
            completed: params.progress.completed,
            total: params.progress.total
          });
        }
        this._resetSessionDelta(absPath, entry.size);
        return;
      }
      await this._indexFile(entry, { source: 'sessions', content: entry.content });
      this._resetSessionDelta(absPath, entry.size);
      if (params.progress) {
        params.progress.completed += 1;
        params.progress.report({
          completed: params.progress.completed,
          total: params.progress.total
        });
      }
    });
    await this._runWithConcurrency(tasks, this._getIndexConcurrency());
    const staleRows = this._db.prepare('SELECT path FROM files WHERE source = ?').all('sessions');
    for (const stale of staleRows) {
      if (activePaths.has(stale.path)) {
        continue;
      }
      this._db.prepare('DELETE FROM files WHERE path = ? AND source = ?').run(stale.path, 'sessions');
      try {
        this._db.prepare(
          `DELETE FROM ${VECTOR_TABLE} WHERE id IN (SELECT id FROM chunks WHERE path = ? AND source = ?)`
        ).run(stale.path, 'sessions');
      } catch { /* intentionally ignored */ }
      this._db.prepare('DELETE FROM chunks WHERE path = ? AND source = ?').run(stale.path, 'sessions');
      if (this._fts.enabled && this._fts.available) {
        try {
          this._db.prepare(`DELETE FROM ${FTS_TABLE} WHERE path = ? AND source = ? AND model = ?`).run(stale.path, 'sessions', this._provider.model);
        } catch { /* intentionally ignored */ }
      }
    }
  }
  _createSyncProgress(onProgress) {
    const state = {
      completed: 0,
      total: 0,
      label: void 0,
      report: (update) => {
        if (update.label) {
          state.label = update.label;
        }
        const label = update.total > 0 && state.label ? `${state.label} ${update.completed}/${update.total}` : state.label;
        onProgress({
          completed: update.completed,
          total: update.total,
          label
        });
      }
    };
    return state;
  }
  async _runSync(params) {
    const progress = params?.progress ? this._createSyncProgress(params.progress) : void 0;
    if (progress) {
      progress.report({
        completed: progress.completed,
        total: progress.total,
        label: 'Loading vector extension\u2026'
      });
    }
    const vectorReady = await this._ensureVectorReady();
    const meta = this._readMeta();
    const needsFullReindex = params?.force || !meta || meta.model !== this._provider.model || meta.provider !== this._provider.id || meta.providerKey !== this._providerKey || meta.chunkTokens !== this._settings.chunking.tokens || meta.chunkOverlap !== this._settings.chunking.overlap || vectorReady && !meta?.vectorDims;
    try {
      if (needsFullReindex) {
        await this._runSafeReindex({
          reason: params?.reason,
          force: params?.force,
          progress: progress ?? void 0
        });
        return;
      }
      const shouldSyncMemory = this._sources.has('memory') && (params?.force || needsFullReindex || this._dirty);
      const shouldSyncSessions = this._shouldSyncSessions(params, needsFullReindex);
      if (shouldSyncMemory) {
        await this._syncMemoryFiles({ needsFullReindex, progress: progress ?? void 0 });
        this._dirty = false;
      }
      if (shouldSyncSessions) {
        await this._syncSessionFiles({ needsFullReindex, progress: progress ?? void 0 });
        this._sessionsDirty = false;
        this._sessionsDirtyFiles.clear();
      } else if (this._sessionsDirtyFiles.size > 0) {
        this._sessionsDirty = true;
      } else {
        this._sessionsDirty = false;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const activated = this._shouldFallbackOnError(reason) && await this._activateFallbackProvider(reason);
      if (activated) {
        await this._runSafeReindex({
          reason: params?.reason ?? 'fallback',
          force: true,
          progress: progress ?? void 0
        });
        return;
      }
      throw err;
    }
  }
  _shouldFallbackOnError(message) {
    return /embedding|embeddings|batch/i.test(message);
  }
  _resolveBatchConfig() {
    const batch = this._settings.remote?.batch;
    const enabled = Boolean(
      batch?.enabled && (this._openAi && this._provider.id === 'openai' || this._gemini && this._provider.id === 'gemini')
    );
    return {
      enabled,
      wait: batch?.wait ?? true,
      concurrency: Math.max(1, batch?.concurrency ?? 2),
      pollIntervalMs: batch?.pollIntervalMs ?? 2e3,
      timeoutMs: (batch?.timeoutMinutes ?? 60) * 60 * 1e3
    };
  }
  async _activateFallbackProvider(reason) {
    const fallback = this._settings.fallback;
    if (!fallback || fallback === 'none' || fallback === this._provider.id) {
      return false;
    }
    if (this._fallbackFrom) {
      return false;
    }
    const fallbackFrom = this._provider.id;
    const fallbackModel = fallback === 'gemini' ? DEFAULT_GEMINI_EMBEDDING_MODEL : fallback === 'openai' ? DEFAULT_OPENAI_EMBEDDING_MODEL : this._settings.model;
    const fallbackResult = await createEmbeddingProvider({
      config: this._cfg,
      agentDir: resolveAgentDir(this._cfg, this._agentId),
      provider: fallback,
      remote: this._settings.remote,
      model: fallbackModel,
      fallback: 'none',
      local: this._settings.local
    });
    this._fallbackFrom = fallbackFrom;
    this._fallbackReason = reason;
    this._provider = fallbackResult.provider;
    this._openAi = fallbackResult.openAi;
    this._gemini = fallbackResult.gemini;
    this._providerKey = this._computeProviderKey();
    this._batch = this._resolveBatchConfig();
    log.warn(`memory embeddings: switched to fallback provider (${fallback})`, { reason });
    return true;
  }
  async _runSafeReindex(params) {
    const dbPath = resolveUserPath(this._settings.store.path);
    const tempDbPath = `${dbPath}.tmp-${randomUUID()}`;
    const tempDb = this._openDatabaseAtPath(tempDbPath);
    const originalDb = this._db;
    let originalDbClosed = false;
    const originalState = {
      ftsAvailable: this._fts.available,
      ftsError: this._fts.loadError,
      vectorAvailable: this._vector.available,
      vectorLoadError: this._vector.loadError,
      vectorDims: this._vector.dims,
      vectorReady: this._vectorReady
    };
    const restoreOriginalState = () => {
      if (originalDbClosed) {
        this._db = this._openDatabaseAtPath(dbPath);
      } else {
        this._db = originalDb;
      }
      this._fts.available = originalState.ftsAvailable;
      this._fts.loadError = originalState.ftsError;
      this._vector.available = originalDbClosed ? null : originalState.vectorAvailable;
      this._vector.loadError = originalState.vectorLoadError;
      this._vector.dims = originalState.vectorDims;
      this._vectorReady = originalDbClosed ? null : originalState.vectorReady;
    };
    this._db = tempDb;
    this._vectorReady = null;
    this._vector.available = null;
    this._vector.loadError = void 0;
    this._vector.dims = void 0;
    this._fts.available = false;
    this._fts.loadError = void 0;
    this._ensureSchema();
    let nextMeta = null;
    try {
      this._seedEmbeddingCache(originalDb);
      const shouldSyncMemory = this._sources.has('memory');
      const shouldSyncSessions = this._shouldSyncSessions(
        { reason: params.reason, force: params.force },
        true
      );
      if (shouldSyncMemory) {
        await this._syncMemoryFiles({ needsFullReindex: true, progress: params.progress });
        this._dirty = false;
      }
      if (shouldSyncSessions) {
        await this._syncSessionFiles({ needsFullReindex: true, progress: params.progress });
        this._sessionsDirty = false;
        this._sessionsDirtyFiles.clear();
      } else if (this._sessionsDirtyFiles.size > 0) {
        this._sessionsDirty = true;
      } else {
        this._sessionsDirty = false;
      }
      nextMeta = {
        model: this._provider.model,
        provider: this._provider.id,
        providerKey: this._providerKey,
        chunkTokens: this._settings.chunking.tokens,
        chunkOverlap: this._settings.chunking.overlap
      };
      if (this._vector.available && this._vector.dims) {
        nextMeta.vectorDims = this._vector.dims;
      }
      this._writeMeta(nextMeta);
      this._pruneEmbeddingCacheIfNeeded();
      this._db.close();
      originalDb.close();
      originalDbClosed = true;
      await this._swapIndexFiles(dbPath, tempDbPath);
      this._db = this._openDatabaseAtPath(dbPath);
      this._vectorReady = null;
      this._vector.available = null;
      this._vector.loadError = void 0;
      this._ensureSchema();
      this._vector.dims = nextMeta.vectorDims;
    } catch (err) {
      try {
        this._db.close();
      } catch { /* intentionally ignored */ }
      await this._removeIndexFiles(tempDbPath);
      restoreOriginalState();
      throw err;
    }
  }
  _resetIndex() {
    this._db.exec('DELETE FROM files');
    this._db.exec('DELETE FROM chunks');
    if (this._fts.enabled && this._fts.available) {
      try {
        this._db.exec(`DELETE FROM ${FTS_TABLE}`);
      } catch { /* intentionally ignored */ }
    }
    this._dropVectorTable();
    this._vector.dims = void 0;
    this._sessionsDirtyFiles.clear();
  }
  _readMeta() {
    const row = this._db.prepare('SELECT value FROM meta WHERE key = ?').get(META_KEY);
    if (!row?.value) {
      return null;
    }
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }
  _writeMeta(meta) {
    const value = JSON.stringify(meta);
    this._db.prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
    ).run(META_KEY, value);
  }
  async _listSessionFiles() {
    const dir = resolveSessionTranscriptsDirForAgent(this._agentId);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).filter((name) => name.endsWith('.jsonl')).map((name) => path.join(dir, name));
    } catch {
      return [];
    }
  }
  _sessionPathForFile(absPath) {
    return path.join('sessions', path.basename(absPath)).replace(/\\/g, '/');
  }
  _normalizeSessionText(value) {
    return value.replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }
  _extractSessionText(content) {
    if (typeof content === 'string') {
      const normalized = this._normalizeSessionText(content);
      return normalized ? normalized : null;
    }
    if (!Array.isArray(content)) {
      return null;
    }
    const parts = [];
    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue;
      }
      const record = block;
      if (record.type !== 'text' || typeof record.text !== 'string') {
        continue;
      }
      const normalized = this._normalizeSessionText(record.text);
      if (normalized) {
        parts.push(normalized);
      }
    }
    if (parts.length === 0) {
      return null;
    }
    return parts.join(' ');
  }
  async _buildSessionEntry(absPath) {
    try {
      const stat = await fs.stat(absPath);
      const raw = await fs.readFile(absPath, 'utf-8');
      const lines = raw.split('\n');
      const collected = [];
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }
        if (!record || typeof record !== 'object' || record.type !== 'message') {
          continue;
        }
        const message = record.message;
        if (!message || typeof message.role !== 'string') {
          continue;
        }
        if (message.role !== 'user' && message.role !== 'assistant') {
          continue;
        }
        const text = this._extractSessionText(message.content);
        if (!text) {
          continue;
        }
        const label = message.role === 'user' ? 'User' : 'Assistant';
        collected.push(`${label}: ${text}`);
      }
      const content = collected.join('\n');
      return {
        path: this._sessionPathForFile(absPath),
        absPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        hash: hashText(content),
        content
      };
    } catch (err) {
      log.debug(`Failed reading session file ${absPath}: ${String(err)}`);
      return null;
    }
  }
  _estimateEmbeddingTokens(text) {
    if (!text) {
      return 0;
    }
    return Math.ceil(text.length / EMBEDDING_APPROX_CHARS_PER_TOKEN);
  }
  _buildEmbeddingBatches(chunks) {
    const batches = [];
    let current = [];
    let currentTokens = 0;
    for (const chunk of chunks) {
      const estimate = this._estimateEmbeddingTokens(chunk.text);
      const wouldExceed = current.length > 0 && currentTokens + estimate > EMBEDDING_BATCH_MAX_TOKENS;
      if (wouldExceed) {
        batches.push(current);
        current = [];
        currentTokens = 0;
      }
      if (current.length === 0 && estimate > EMBEDDING_BATCH_MAX_TOKENS) {
        batches.push([chunk]);
        continue;
      }
      current.push(chunk);
      currentTokens += estimate;
    }
    if (current.length > 0) {
      batches.push(current);
    }
    return batches;
  }
  _loadEmbeddingCache(hashes) {
    if (!this._cache.enabled) {
      return /* @__PURE__ */ new Map();
    }
    if (hashes.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const unique = [];
    const seen = /* @__PURE__ */ new Set();
    for (const hash of hashes) {
      if (!hash) {
        continue;
      }
      if (seen.has(hash)) {
        continue;
      }
      seen.add(hash);
      unique.push(hash);
    }
    if (unique.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const out = /* @__PURE__ */ new Map();
    const baseParams = [this._provider.id, this._provider.model, this._providerKey];
    const batchSize = 400;
    for (let start = 0; start < unique.length; start += batchSize) {
      const batch = unique.slice(start, start + batchSize);
      const placeholders = batch.map(() => '?').join(', ');
      const rows = this._db.prepare(
        `SELECT hash, embedding FROM ${EMBEDDING_CACHE_TABLE}
 WHERE provider = ? AND model = ? AND provider_key = ? AND hash IN (${placeholders})`
      ).all(...baseParams, ...batch);
      for (const row of rows) {
        out.set(row.hash, parseEmbedding(row.embedding));
      }
    }
    return out;
  }
  _upsertEmbeddingCache(entries) {
    if (!this._cache.enabled) {
      return;
    }
    if (entries.length === 0) {
      return;
    }
    const now = Date.now();
    const stmt = this._db.prepare(
      `INSERT INTO ${EMBEDDING_CACHE_TABLE} (provider, model, provider_key, hash, embedding, dims, updated_at)
 VALUES (?, ?, ?, ?, ?, ?, ?)
 ON CONFLICT(provider, model, provider_key, hash) DO UPDATE SET
   embedding=excluded.embedding,
   dims=excluded.dims,
   updated_at=excluded.updated_at`
    );
    for (const entry of entries) {
      const embedding = entry.embedding ?? [];
      stmt.run(
        this._provider.id,
        this._provider.model,
        this._providerKey,
        entry.hash,
        JSON.stringify(embedding),
        embedding.length,
        now
      );
    }
  }
  _pruneEmbeddingCacheIfNeeded() {
    if (!this._cache.enabled) {
      return;
    }
    const max = this._cache.maxEntries;
    if (!max || max <= 0) {
      return;
    }
    const row = this._db.prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`).get();
    const count = row?.c ?? 0;
    if (count <= max) {
      return;
    }
    const excess = count - max;
    this._db.prepare(
      `DELETE FROM ${EMBEDDING_CACHE_TABLE}
 WHERE rowid IN (
   SELECT rowid FROM ${EMBEDDING_CACHE_TABLE}
   ORDER BY updated_at ASC
   LIMIT ?
 )`
    ).run(excess);
  }
  async _embedChunksInBatches(chunks) {
    if (chunks.length === 0) {
      return [];
    }
    const cached = this._loadEmbeddingCache(chunks.map((chunk) => chunk.hash));
    const embeddings = Array.from({ length: chunks.length }, () => []);
    const missing = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : void 0;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }
    if (missing.length === 0) {
      return embeddings;
    }
    const missingChunks = missing.map((m) => m.chunk);
    const batches = this._buildEmbeddingBatches(missingChunks);
    const toCache = [];
    let cursor = 0;
    for (const batch of batches) {
      const batchEmbeddings = await this._embedBatchWithRetry(batch.map((chunk) => chunk.text));
      for (let i = 0; i < batch.length; i += 1) {
        const item = missing[cursor + i];
        const embedding = batchEmbeddings[i] ?? [];
        if (item) {
          embeddings[item.index] = embedding;
          toCache.push({ hash: item.chunk.hash, embedding });
        }
      }
      cursor += batch.length;
    }
    this._upsertEmbeddingCache(toCache);
    return embeddings;
  }
  _computeProviderKey() {
    if (this._provider.id === 'openai' && this._openAi) {
      const entries = Object.entries(this._openAi.headers).filter(([key]) => key.toLowerCase() !== 'authorization').toSorted(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, value]);
      return hashText(
        JSON.stringify({
          provider: 'openai',
          baseUrl: this._openAi.baseUrl,
          model: this._openAi.model,
          headers: entries
        })
      );
    }
    if (this._provider.id === 'gemini' && this._gemini) {
      const entries = Object.entries(this._gemini.headers).filter(([key]) => {
        const lower = key.toLowerCase();
        return lower !== 'authorization' && lower !== 'x-goog-api-key';
      }).toSorted(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, value]);
      return hashText(
        JSON.stringify({
          provider: 'gemini',
          baseUrl: this._gemini.baseUrl,
          model: this._gemini.model,
          headers: entries
        })
      );
    }
    return hashText(JSON.stringify({ provider: this._provider.id, model: this._provider.model }));
  }
  async _embedChunksWithBatch(chunks, entry, source) {
    if (this._provider.id === 'openai' && this._openAi) {
      return this._embedChunksWithOpenAiBatch(chunks, entry, source);
    }
    if (this._provider.id === 'gemini' && this._gemini) {
      return this._embedChunksWithGeminiBatch(chunks, entry, source);
    }
    return this._embedChunksInBatches(chunks);
  }
  async _embedChunksWithOpenAiBatch(chunks, entry, source) {
    const openAi = this._openAi;
    if (!openAi) {
      return this._embedChunksInBatches(chunks);
    }
    if (chunks.length === 0) {
      return [];
    }
    const cached = this._loadEmbeddingCache(chunks.map((chunk) => chunk.hash));
    const embeddings = Array.from({ length: chunks.length }, () => []);
    const missing = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : void 0;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }
    if (missing.length === 0) {
      return embeddings;
    }
    const requests = [];
    const mapping = /* @__PURE__ */ new Map();
    for (const item of missing) {
      const chunk = item.chunk;
      const customId = hashText(
        `${source}:${entry.path}:${chunk.startLine}:${chunk.endLine}:${chunk.hash}:${item.index}`
      );
      mapping.set(customId, { index: item.index, hash: chunk.hash });
      requests.push({
        custom_id: customId,
        method: 'POST',
        url: OPENAI_BATCH_ENDPOINT,
        body: {
          model: this._openAi?.model ?? this._provider.model,
          input: chunk.text
        }
      });
    }
    const batchResult = await this._runBatchWithFallback({
      provider: 'openai',
      run: async () => await runOpenAiEmbeddingBatches({
        openAi,
        agentId: this._agentId,
        requests,
        wait: this._batch.wait,
        concurrency: this._batch.concurrency,
        pollIntervalMs: this._batch.pollIntervalMs,
        timeoutMs: this._batch.timeoutMs,
        debug: (message, data) => log.debug(message, { ...data, source, chunks: chunks.length })
      }),
      fallback: async () => await this._embedChunksInBatches(chunks)
    });
    if (Array.isArray(batchResult)) {
      return batchResult;
    }
    const byCustomId = batchResult;
    const toCache = [];
    for (const [customId, embedding] of byCustomId.entries()) {
      const mapped = mapping.get(customId);
      if (!mapped) {
        continue;
      }
      embeddings[mapped.index] = embedding;
      toCache.push({ hash: mapped.hash, embedding });
    }
    this._upsertEmbeddingCache(toCache);
    return embeddings;
  }
  async _embedChunksWithGeminiBatch(chunks, entry, source) {
    const gemini = this._gemini;
    if (!gemini) {
      return this._embedChunksInBatches(chunks);
    }
    if (chunks.length === 0) {
      return [];
    }
    const cached = this._loadEmbeddingCache(chunks.map((chunk) => chunk.hash));
    const embeddings = Array.from({ length: chunks.length }, () => []);
    const missing = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : void 0;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }
    if (missing.length === 0) {
      return embeddings;
    }
    const requests = [];
    const mapping = /* @__PURE__ */ new Map();
    for (const item of missing) {
      const chunk = item.chunk;
      const customId = hashText(
        `${source}:${entry.path}:${chunk.startLine}:${chunk.endLine}:${chunk.hash}:${item.index}`
      );
      mapping.set(customId, { index: item.index, hash: chunk.hash });
      requests.push({
        custom_id: customId,
        content: { parts: [{ text: chunk.text }] },
        taskType: 'RETRIEVAL_DOCUMENT'
      });
    }
    const batchResult = await this._runBatchWithFallback({
      provider: 'gemini',
      run: async () => await runGeminiEmbeddingBatches({
        gemini,
        agentId: this._agentId,
        requests,
        wait: this._batch.wait,
        concurrency: this._batch.concurrency,
        pollIntervalMs: this._batch.pollIntervalMs,
        timeoutMs: this._batch.timeoutMs,
        debug: (message, data) => log.debug(message, { ...data, source, chunks: chunks.length })
      }),
      fallback: async () => await this._embedChunksInBatches(chunks)
    });
    if (Array.isArray(batchResult)) {
      return batchResult;
    }
    const byCustomId = batchResult;
    const toCache = [];
    for (const [customId, embedding] of byCustomId.entries()) {
      const mapped = mapping.get(customId);
      if (!mapped) {
        continue;
      }
      embeddings[mapped.index] = embedding;
      toCache.push({ hash: mapped.hash, embedding });
    }
    this._upsertEmbeddingCache(toCache);
    return embeddings;
  }
  async _embedBatchWithRetry(texts) {
    if (texts.length === 0) {
      return [];
    }
    let attempt = 0;
    let delayMs = EMBEDDING_RETRY_BASE_DELAY_MS;
    while (true) {
      try {
        const timeoutMs = this._resolveEmbeddingTimeout('batch');
        log.debug('memory embeddings: batch start', {
          provider: this._provider.id,
          items: texts.length,
          timeoutMs
        });
        return await this._withTimeout(
          this._provider.embedBatch(texts),
          timeoutMs,
          `memory embeddings batch timed out after ${Math.round(timeoutMs / 1e3)}s`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!this._isRetryableEmbeddingError(message) || attempt >= EMBEDDING_RETRY_MAX_ATTEMPTS) {
          throw err;
        }
        const waitMs = Math.min(
          EMBEDDING_RETRY_MAX_DELAY_MS,
          Math.round(delayMs * (1 + Math.random() * 0.2))
        );
        log.warn(`memory embeddings rate limited; retrying in ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        delayMs *= 2;
        attempt += 1;
      }
    }
  }
  _isRetryableEmbeddingError(message) {
    return /(rate[_ ]limit|too many requests|429|resource has been exhausted|5\d\d|cloudflare)/i.test(
      message
    );
  }
  _resolveEmbeddingTimeout(kind) {
    const isLocal = this._provider.id === 'local';
    if (kind === 'query') {
      return isLocal ? EMBEDDING_QUERY_TIMEOUT_LOCAL_MS : EMBEDDING_QUERY_TIMEOUT_REMOTE_MS;
    }
    return isLocal ? EMBEDDING_BATCH_TIMEOUT_LOCAL_MS : EMBEDDING_BATCH_TIMEOUT_REMOTE_MS;
  }
  async _embedQueryWithTimeout(text) {
    const timeoutMs = this._resolveEmbeddingTimeout('query');
    log.debug('memory embeddings: query start', { provider: this._provider.id, timeoutMs });
    return await this._withTimeout(
      this._provider.embedQuery(text),
      timeoutMs,
      `memory embeddings query timed out after ${Math.round(timeoutMs / 1e3)}s`
    );
  }
  async _withTimeout(promise, timeoutMs, message) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return await promise;
    }
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
  async _runWithConcurrency(tasks, limit) {
    if (tasks.length === 0) {
      return [];
    }
    const resolvedLimit = Math.max(1, Math.min(limit, tasks.length));
    const results = Array.from({ length: tasks.length });
    let next = 0;
    let firstError = null;
    const workers = Array.from({ length: resolvedLimit }, async () => {
      while (true) {
        if (firstError) {
          return;
        }
        const index = next;
        next += 1;
        if (index >= tasks.length) {
          return;
        }
        try {
          results[index] = await tasks[index]();
        } catch (err) {
          firstError = err;
          return;
        }
      }
    });
    await Promise.allSettled(workers);
    if (firstError) {
      throw firstError;
    }
    return results;
  }
  async _withBatchFailureLock(fn) {
    let release;
    const wait = this._batchFailureLock;
    this._batchFailureLock = new Promise((resolve) => {
      release = resolve;
    });
    await wait;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  async _resetBatchFailureCount() {
    await this._withBatchFailureLock(async () => {
      if (this._batchFailureCount > 0) {
        log.debug('memory embeddings: batch recovered; resetting failure count');
      }
      this._batchFailureCount = 0;
      this._batchFailureLastError = void 0;
      this._batchFailureLastProvider = void 0;
    });
  }
  async _recordBatchFailure(params) {
    return await this._withBatchFailureLock(async () => {
      if (!this._batch.enabled) {
        return { disabled: true, count: this._batchFailureCount };
      }
      const increment = params.forceDisable ? BATCH_FAILURE_LIMIT : Math.max(1, params.attempts ?? 1);
      this._batchFailureCount += increment;
      this._batchFailureLastError = params.message;
      this._batchFailureLastProvider = params.provider;
      const disabled = params.forceDisable || this._batchFailureCount >= BATCH_FAILURE_LIMIT;
      if (disabled) {
        this._batch.enabled = false;
      }
      return { disabled, count: this._batchFailureCount };
    });
  }
  _isBatchTimeoutError(message) {
    return /timed out|timeout/i.test(message);
  }
  async _runBatchWithTimeoutRetry(params) {
    try {
      return await params.run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (this._isBatchTimeoutError(message)) {
        log.warn(`memory embeddings: ${params.provider} batch timed out; retrying once`);
        try {
          return await params.run();
        } catch (retryErr) {
          retryErr.batchAttempts = 2;
          throw retryErr;
        }
      }
      throw err;
    }
  }
  async _runBatchWithFallback(params) {
    if (!this._batch.enabled) {
      return await params.fallback();
    }
    try {
      const result = await this._runBatchWithTimeoutRetry({
        provider: params.provider,
        run: params.run
      });
      await this._resetBatchFailureCount();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = err.batchAttempts ?? 1;
      const forceDisable = /asyncBatchEmbedContent not available/i.test(message);
      const failure = await this._recordBatchFailure({
        provider: params.provider,
        message,
        attempts,
        forceDisable
      });
      const suffix = failure.disabled ? 'disabling batch' : 'keeping batch enabled';
      log.warn(
        `memory embeddings: ${params.provider} batch failed (${failure.count}/${BATCH_FAILURE_LIMIT}); ${suffix}; falling back to non-batch embeddings: ${message}`
      );
      return await params.fallback();
    }
  }
  _getIndexConcurrency() {
    return this._batch.enabled ? this._batch.concurrency : EMBEDDING_INDEX_CONCURRENCY;
  }
  async _indexFile(entry, options) {
    const content = options.content ?? await fs.readFile(entry.absPath, 'utf-8');
    const chunks = chunkMarkdown(content, this._settings.chunking).filter(
      (chunk) => chunk.text.trim().length > 0
    );
    const embeddings = this._batch.enabled ? await this._embedChunksWithBatch(chunks, entry, options.source) : await this._embedChunksInBatches(chunks);
    const sample = embeddings.find((embedding) => embedding.length > 0);
    const vectorReady = sample ? await this._ensureVectorReady(sample.length) : false;
    const now = Date.now();
    if (vectorReady) {
      try {
        this._db.prepare(
          `DELETE FROM ${VECTOR_TABLE} WHERE id IN (SELECT id FROM chunks WHERE path = ? AND source = ?)`
        ).run(entry.path, options.source);
      } catch { /* intentionally ignored */ }
    }
    if (this._fts.enabled && this._fts.available) {
      try {
        this._db.prepare(`DELETE FROM ${FTS_TABLE} WHERE path = ? AND source = ? AND model = ?`).run(entry.path, options.source, this._provider.model);
      } catch { /* intentionally ignored */ }
    }
    this._db.prepare('DELETE FROM chunks WHERE path = ? AND source = ?').run(entry.path, options.source);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i] ?? [];
      const id = hashText(
        `${options.source}:${entry.path}:${chunk.startLine}:${chunk.endLine}:${chunk.hash}:${this._provider.model}`
      );
      this._db.prepare(
        `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             hash=excluded.hash,
             model=excluded.model,
             text=excluded.text,
             embedding=excluded.embedding,
             updated_at=excluded.updated_at`
      ).run(
        id,
        entry.path,
        options.source,
        chunk.startLine,
        chunk.endLine,
        chunk.hash,
        this._provider.model,
        chunk.text,
        JSON.stringify(embedding),
        now
      );
      if (vectorReady && embedding.length > 0) {
        try {
          this._db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE id = ?`).run(id);
        } catch { /* intentionally ignored */ }
        this._db.prepare(`INSERT INTO ${VECTOR_TABLE} (id, embedding) VALUES (?, ?)`).run(id, vectorToBlob(embedding));
      }
      if (this._fts.enabled && this._fts.available) {
        this._db.prepare(
          `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line)
 VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          chunk.text,
          id,
          entry.path,
          options.source,
          this._provider.model,
          chunk.startLine,
          chunk.endLine
        );
      }
    }
    this._db.prepare(
      `INSERT INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           source=excluded.source,
           hash=excluded.hash,
           mtime=excluded.mtime,
           size=excluded.size`
    ).run(entry.path, options.source, entry.hash, entry.mtimeMs, entry.size);
  }
}
export {
  MemoryIndexManager
};
