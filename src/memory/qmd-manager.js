/** @module memory/qmd-manager - QMD-backed memory manager using external indexer. */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveAgentWorkspaceDir } from '../agents/agent-scope.js';
import { resolveStateDir } from '../config/paths.js';
import { createSubsystemLogger } from '../logging/subsystem.js';
import { parseAgentSessionKey } from '../sessions/session-key-utils.js';
import {
  listSessionFilesForAgent,
  buildSessionEntry
} from './session-files.js';
import { requireNodeSqlite } from './sqlite.js';
const log = createSubsystemLogger('memory');
const SNIPPET_HEADER_RE = /@@\s*-([0-9]+),([0-9]+)/;
/**
 * @implements {MemorySearchManager}
 */
class QmdMemoryManager {
  static async create(params) {
    const resolved = params.resolved.qmd;
    if (!resolved) {
      return null;
    }
    const manager = new QmdMemoryManager({ cfg: params.cfg, agentId: params.agentId, resolved });
    await manager.initialize();
    return manager;
  }
  _cfg;
  _agentId;
  _qmd;
  _workspaceDir;
  _stateDir;
  _agentStateDir;
  _qmdDir;
  _xdgConfigHome;
  _xdgCacheHome;
  _indexPath;
  _env;
  _collectionRoots = /* @__PURE__ */ new Map();
  _sources = /* @__PURE__ */ new Set();
  _docPathCache = /* @__PURE__ */ new Map();
  _sessionExporter;
  _updateTimer = null;
  _pendingUpdate = null;
  _closed = false;
  _db = null;
  lastUpdateAt = null;
  lastEmbedAt = null;
  constructor(params) {
    this._cfg = params.cfg;
    this._agentId = params.agentId;
    this._qmd = params.resolved;
    this._workspaceDir = resolveAgentWorkspaceDir(params.cfg, params.agentId);
    this._stateDir = resolveStateDir(process.env, os.homedir);
    this._agentStateDir = path.join(this._stateDir, 'agents', this._agentId);
    this._qmdDir = path.join(this._agentStateDir, 'qmd');
    this._xdgConfigHome = path.join(this._qmdDir, 'xdg-config');
    this._xdgCacheHome = path.join(this._qmdDir, 'xdg-cache');
    this._indexPath = path.join(this._xdgCacheHome, 'qmd', 'index.sqlite');
    this._env = {
      ...process.env,
      XDG_CONFIG_HOME: this._xdgConfigHome,
      XDG_CACHE_HOME: this._xdgCacheHome,
      NO_COLOR: '1'
    };
    this._sessionExporter = this._qmd.sessions.enabled ? {
      dir: this._qmd.sessions.exportDir ?? path.join(this._qmdDir, 'sessions'),
      retentionMs: this._qmd.sessions.retentionDays ? this._qmd.sessions.retentionDays * 24 * 60 * 60 * 1e3 : void 0,
      collectionName: this.pickSessionCollectionName()
    } : null;
    if (this._sessionExporter) {
      this._qmd.collections = [
        ...this._qmd.collections,
        {
          name: this._sessionExporter.collectionName,
          path: this._sessionExporter.dir,
          pattern: '**/*.md',
          kind: 'sessions'
        }
      ];
    }
  }
  async initialize() {
    await fs.mkdir(this._xdgConfigHome, { recursive: true });
    await fs.mkdir(this._xdgCacheHome, { recursive: true });
    await fs.mkdir(path.dirname(this._indexPath), { recursive: true });
    this.bootstrapCollections();
    await this.ensureCollections();
    if (this._qmd.update.onBoot) {
      await this.runUpdate('boot', true);
    }
    if (this._qmd.update.intervalMs > 0) {
      this._updateTimer = setInterval(() => {
        void this.runUpdate('interval').catch((err) => {
          log.warn(`qmd update failed (${String(err)})`);
        });
      }, this._qmd.update.intervalMs);
    }
  }
  bootstrapCollections() {
    this._collectionRoots.clear();
    this._sources.clear();
    for (const collection of this._qmd.collections) {
      const kind = collection.kind === 'sessions' ? 'sessions' : 'memory';
      this._collectionRoots.set(collection.name, { path: collection.path, kind });
      this._sources.add(kind);
    }
  }
  async ensureCollections() {
    const existing = /* @__PURE__ */ new Set();
    try {
      const result = await this.runQmd(['collection', 'list', '--json']);
      const parsed = JSON.parse(result.stdout);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === 'string') {
            existing.add(entry);
          } else if (entry && typeof entry === 'object') {
            const name = entry.name;
            if (typeof name === 'string') {
              existing.add(name);
            }
          }
        }
      }
    } catch { /* intentionally ignored */ }
    for (const collection of this._qmd.collections) {
      if (existing.has(collection.name)) {
        continue;
      }
      try {
        await this.runQmd([
          'collection',
          'add',
          collection.path,
          '--name',
          collection.name,
          '--mask',
          collection.pattern
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes('already exists')) {
          continue;
        }
        if (message.toLowerCase().includes('exists')) {
          continue;
        }
        log.warn(`qmd collection add failed for ${collection.name}: ${message}`);
      }
    }
  }
  async search(query, opts) {
    if (!this.isScopeAllowed(opts?.sessionKey)) {
      return [];
    }
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    await this._pendingUpdate?.catch(() => void 0);
    const limit = Math.min(
      this._qmd.limits.maxResults,
      opts?.maxResults ?? this._qmd.limits.maxResults
    );
    const args = ['query', trimmed, '--json', '-n', String(limit)];
    let stdout;
    try {
      const result = await this.runQmd(args, { timeoutMs: this._qmd.limits.timeoutMs });
      stdout = result.stdout;
    } catch (err) {
      log.warn(`qmd query failed: ${String(err)}`);
      throw err instanceof Error ? err : new Error(String(err));
    }
    let parsed = [];
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(`qmd query returned invalid JSON: ${message}`);
      throw new Error(`qmd query returned invalid JSON: ${message}`, { cause: err });
    }
    const results = [];
    for (const entry of parsed) {
      const doc = await this.resolveDocLocation(entry.docid);
      if (!doc) {
        continue;
      }
      const snippet = entry.snippet?.slice(0, this._qmd.limits.maxSnippetChars) ?? '';
      const lines = this.extractSnippetLines(snippet);
      const score = typeof entry.score === 'number' ? entry.score : 0;
      const minScore = opts?.minScore ?? 0;
      if (score < minScore) {
        continue;
      }
      results.push({
        path: doc.rel,
        startLine: lines.startLine,
        endLine: lines.endLine,
        score,
        snippet,
        source: doc.source
      });
    }
    return this.clampResultsByInjectedChars(results.slice(0, limit));
  }
  async sync(params) {
    if (params?.progress) {
      params.progress({ completed: 0, total: 1, label: 'Updating QMD index\u2026' });
    }
    await this.runUpdate(params?.reason ?? 'manual', params?.force);
    if (params?.progress) {
      params.progress({ completed: 1, total: 1, label: 'QMD index updated' });
    }
  }
  async readFile(params) {
    const relPath = params.relPath?.trim();
    if (!relPath) {
      throw new Error('path required');
    }
    const absPath = this.resolveReadPath(relPath);
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
    const counts = this.readCounts();
    return {
      backend: 'qmd',
      provider: 'qmd',
      model: 'qmd',
      requestedProvider: 'qmd',
      files: counts.totalDocuments,
      chunks: counts.totalDocuments,
      dirty: false,
      workspaceDir: this._workspaceDir,
      dbPath: this._indexPath,
      sources: Array.from(this._sources),
      sourceCounts: counts.sourceCounts,
      vector: { enabled: true, available: true },
      batch: {
        enabled: false,
        failures: 0,
        limit: 0,
        wait: false,
        concurrency: 0,
        pollIntervalMs: 0,
        timeoutMs: 0
      },
      custom: {
        qmd: {
          collections: this._qmd.collections.length,
          lastUpdateAt: this.lastUpdateAt
        }
      }
    };
  }
  async probeEmbeddingAvailability() {
    return { ok: true };
  }
  async probeVectorAvailability() {
    return true;
  }
  async close() {
    if (this._closed) {
      return;
    }
    this._closed = true;
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = null;
    }
    await this._pendingUpdate?.catch(() => void 0);
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
  async runUpdate(reason, force) {
    if (this._pendingUpdate && !force) {
      return this._pendingUpdate;
    }
    if (this.shouldSkipUpdate(force)) {
      return;
    }
    const run = async () => {
      if (this._sessionExporter) {
        await this.exportSessions();
      }
      await this.runQmd(['update'], { timeoutMs: 12e4 });
      const embedIntervalMs = this._qmd.update.embedIntervalMs;
      const shouldEmbed = Boolean(force) || this.lastEmbedAt === null || embedIntervalMs > 0 && Date.now() - this.lastEmbedAt > embedIntervalMs;
      if (shouldEmbed) {
        try {
          await this.runQmd(['embed'], { timeoutMs: 12e4 });
          this.lastEmbedAt = Date.now();
        } catch (err) {
          log.warn(`qmd embed failed (${reason}): ${String(err)}`);
        }
      }
      this.lastUpdateAt = Date.now();
      this._docPathCache.clear();
    };
    this._pendingUpdate = run().finally(() => {
      this._pendingUpdate = null;
    });
    await this._pendingUpdate;
  }
  async runQmd(args, opts) {
    return await new Promise((resolve, reject) => {
      const child = spawn(this._qmd.command, args, {
        env: this._env,
        cwd: this._workspaceDir
      });
      let stdout = '';
      let stderr = '';
      const timer = opts?.timeoutMs ? setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`qmd ${args.join(' ')} timed out after ${opts.timeoutMs}ms`));
      }, opts.timeoutMs) : null;
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      child.on('error', (err) => {
        if (timer) {
          clearTimeout(timer);
        }
        reject(err);
      });
      child.on('close', (code) => {
        if (timer) {
          clearTimeout(timer);
        }
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`qmd ${args.join(' ')} failed (code ${code}): ${stderr || stdout}`));
        }
      });
    });
  }
  ensureDb() {
    if (this._db) {
      return this._db;
    }
    const { DatabaseSync } = requireNodeSqlite();
    this._db = new DatabaseSync(this._indexPath, { readOnly: true });
    return this._db;
  }
  async exportSessions() {
    if (!this._sessionExporter) {
      return;
    }
    const exportDir = this._sessionExporter.dir;
    await fs.mkdir(exportDir, { recursive: true });
    const files = await listSessionFilesForAgent(this._agentId);
    const keep = /* @__PURE__ */ new Set();
    const cutoff = this._sessionExporter.retentionMs ? Date.now() - this._sessionExporter.retentionMs : null;
    for (const sessionFile of files) {
      const entry = await buildSessionEntry(sessionFile);
      if (!entry) {
        continue;
      }
      if (cutoff && entry.mtimeMs < cutoff) {
        continue;
      }
      const target = path.join(exportDir, `${path.basename(sessionFile, '.jsonl')}.md`);
      await fs.writeFile(target, this.renderSessionMarkdown(entry), 'utf-8');
      keep.add(target);
    }
    const exported = await fs.readdir(exportDir).catch(() => []);
    for (const name of exported) {
      if (!name.endsWith('.md')) {
        continue;
      }
      const full = path.join(exportDir, name);
      if (!keep.has(full)) {
        await fs.rm(full, { force: true });
      }
    }
  }
  renderSessionMarkdown(entry) {
    const header = `# Session ${path.basename(entry.absPath, path.extname(entry.absPath))}`;
    const body = entry.content?.trim().length ? entry.content.trim() : '(empty)';
    return `${header}

${body}
`;
  }
  pickSessionCollectionName() {
    const existing = new Set(this._qmd.collections.map((collection) => collection.name));
    if (!existing.has('sessions')) {
      return 'sessions';
    }
    let counter = 2;
    let candidate = `sessions-${counter}`;
    while (existing.has(candidate)) {
      counter += 1;
      candidate = `sessions-${counter}`;
    }
    return candidate;
  }
  async resolveDocLocation(docid) {
    if (!docid) {
      return null;
    }
    const normalized = docid.startsWith('#') ? docid.slice(1) : docid;
    if (!normalized) {
      return null;
    }
    const cached = this._docPathCache.get(normalized);
    if (cached) {
      return cached;
    }
    const db = this.ensureDb();
    const row = db.prepare('SELECT collection, path FROM documents WHERE hash LIKE ? AND active = 1 LIMIT 1').get(`${normalized}%`);
    if (!row) {
      return null;
    }
    const location = this.toDocLocation(row.collection, row.path);
    if (!location) {
      return null;
    }
    this._docPathCache.set(normalized, location);
    return location;
  }
  extractSnippetLines(snippet) {
    const match = SNIPPET_HEADER_RE.exec(snippet);
    if (match) {
      const start = Number(match[1]);
      const count = Number(match[2]);
      if (Number.isFinite(start) && Number.isFinite(count)) {
        return { startLine: start, endLine: start + count - 1 };
      }
    }
    const lines = snippet.split('\n').length;
    return { startLine: 1, endLine: lines };
  }
  readCounts() {
    try {
      const db = this.ensureDb();
      const rows = db.prepare(
        'SELECT collection, COUNT(*) as c FROM documents WHERE active = 1 GROUP BY collection'
      ).all();
      const bySource = /* @__PURE__ */ new Map();
      for (const source of this._sources) {
        bySource.set(source, { files: 0, chunks: 0 });
      }
      let total = 0;
      for (const row of rows) {
        const root = this._collectionRoots.get(row.collection);
        const source = root?.kind ?? 'memory';
        const entry = bySource.get(source) ?? { files: 0, chunks: 0 };
        entry.files += row.c ?? 0;
        entry.chunks += row.c ?? 0;
        bySource.set(source, entry);
        total += row.c ?? 0;
      }
      return {
        totalDocuments: total,
        sourceCounts: Array.from(bySource.entries()).map(([source, value]) => ({
          source,
          files: value.files,
          chunks: value.chunks
        }))
      };
    } catch (err) {
      log.warn(`failed to read qmd index stats: ${String(err)}`);
      return {
        totalDocuments: 0,
        sourceCounts: Array.from(this._sources).map((source) => ({ source, files: 0, chunks: 0 }))
      };
    }
  }
  isScopeAllowed(sessionKey) {
    const scope = this._qmd.scope;
    if (!scope) {
      return true;
    }
    const channel = this.deriveChannelFromKey(sessionKey);
    const chatType = this.deriveChatTypeFromKey(sessionKey);
    const normalizedKey = sessionKey ?? '';
    for (const rule of scope.rules ?? []) {
      if (!rule) {
        continue;
      }
      const match = rule.match ?? {};
      if (match.channel && match.channel !== channel) {
        continue;
      }
      if (match.chatType && match.chatType !== chatType) {
        continue;
      }
      if (match.keyPrefix && !normalizedKey.startsWith(match.keyPrefix)) {
        continue;
      }
      return rule.action === 'allow';
    }
    const fallback = scope.default ?? 'allow';
    return fallback === 'allow';
  }
  deriveChannelFromKey(key) {
    if (!key) {
      return void 0;
    }
    const normalized = this.normalizeSessionKey(key);
    if (!normalized) {
      return void 0;
    }
    const parts = normalized.split(':').filter(Boolean);
    if (parts.length >= 2 && (parts[1] === 'group' || parts[1] === 'channel' || parts[1] === 'dm')) {
      return parts[0]?.toLowerCase();
    }
    return void 0;
  }
  deriveChatTypeFromKey(key) {
    if (!key) {
      return void 0;
    }
    const normalized = this.normalizeSessionKey(key);
    if (!normalized) {
      return void 0;
    }
    if (normalized.includes(':group:')) {
      return 'group';
    }
    if (normalized.includes(':channel:')) {
      return 'channel';
    }
    return 'direct';
  }
  normalizeSessionKey(key) {
    const trimmed = key.trim();
    if (!trimmed) {
      return void 0;
    }
    const parsed = parseAgentSessionKey(trimmed);
    const normalized = (parsed?.rest ?? trimmed).toLowerCase();
    if (normalized.startsWith('subagent:')) {
      return void 0;
    }
    return normalized;
  }
  toDocLocation(collection, collectionRelativePath) {
    const root = this._collectionRoots.get(collection);
    if (!root) {
      return null;
    }
    const normalizedRelative = collectionRelativePath.replace(/\\/g, '/');
    const absPath = path.normalize(path.resolve(root.path, collectionRelativePath));
    const relativeToWorkspace = path.relative(this._workspaceDir, absPath);
    const relPath = this.buildSearchPath(
      collection,
      normalizedRelative,
      relativeToWorkspace,
      absPath
    );
    return { rel: relPath, abs: absPath, source: root.kind };
  }
  buildSearchPath(collection, collectionRelativePath, relativeToWorkspace, absPath) {
    const insideWorkspace = this.isInsideWorkspace(relativeToWorkspace);
    if (insideWorkspace) {
      const normalized = relativeToWorkspace.replace(/\\/g, '/');
      if (!normalized) {
        return path.basename(absPath);
      }
      return normalized;
    }
    const sanitized = collectionRelativePath.replace(/^\/+/, '');
    return `qmd/${collection}/${sanitized}`;
  }
  isInsideWorkspace(relativePath) {
    if (!relativePath) {
      return true;
    }
    if (relativePath.startsWith('..')) {
      return false;
    }
    if (relativePath.startsWith(`..${path.sep}`)) {
      return false;
    }
    return !path.isAbsolute(relativePath);
  }
  resolveReadPath(relPath) {
    if (relPath.startsWith('qmd/')) {
      const [, collection, ...rest] = relPath.split('/');
      if (!collection || rest.length === 0) {
        throw new Error('invalid qmd path');
      }
      const root = this._collectionRoots.get(collection);
      if (!root) {
        throw new Error(`unknown qmd collection: ${collection}`);
      }
      const joined = rest.join('/');
      const resolved = path.resolve(root.path, joined);
      if (!this.isWithinRoot(root.path, resolved)) {
        throw new Error('qmd path escapes collection');
      }
      return resolved;
    }
    const absPath = path.resolve(this._workspaceDir, relPath);
    if (!this.isWithinWorkspace(absPath)) {
      throw new Error('path escapes workspace');
    }
    return absPath;
  }
  isWithinWorkspace(absPath) {
    const normalizedWorkspace = this._workspaceDir.endsWith(path.sep) ? this._workspaceDir : `${this._workspaceDir}${path.sep}`;
    if (absPath === this._workspaceDir) {
      return true;
    }
    const candidate = absPath.endsWith(path.sep) ? absPath : `${absPath}${path.sep}`;
    return candidate.startsWith(normalizedWorkspace);
  }
  isWithinRoot(root, candidate) {
    const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (candidate === root) {
      return true;
    }
    const next = candidate.endsWith(path.sep) ? candidate : `${candidate}${path.sep}`;
    return next.startsWith(normalizedRoot);
  }
  clampResultsByInjectedChars(results) {
    const budget = this._qmd.limits.maxInjectedChars;
    if (!budget || budget <= 0) {
      return results;
    }
    let remaining = budget;
    const clamped = [];
    for (const entry of results) {
      if (remaining <= 0) {
        break;
      }
      const snippet = entry.snippet ?? '';
      if (snippet.length <= remaining) {
        clamped.push(entry);
        remaining -= snippet.length;
      } else {
        const trimmed = snippet.slice(0, Math.max(0, remaining));
        clamped.push({ ...entry, snippet: trimmed });
        break;
      }
    }
    return clamped;
  }
  shouldSkipUpdate(force) {
    if (force) {
      return false;
    }
    const debounceMs = this._qmd.update.debounceMs;
    if (debounceMs <= 0) {
      return false;
    }
    if (!this.lastUpdateAt) {
      return false;
    }
    return Date.now() - this.lastUpdateAt < debounceMs;
  }
}
export {
  QmdMemoryManager
};
