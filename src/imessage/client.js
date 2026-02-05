/**
 * iMessage JSON-RPC client
 *
 * Communicates with the imsg CLI tool via JSON-RPC over stdin/stdout
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolveUserPath } from '../utils.js';
import { DEFAULT_IMESSAGE_PROBE_TIMEOUT_MS } from './constants.js';

/**
 * @typedef {object} IMessageRpcError
 * @property {number} [code]
 * @property {string} [message]
 * @property {unknown} [data]
 */

/**
 * @typedef {object} IMessageRpcResponse
 * @property {string} [jsonrpc]
 * @property {string | number | null} [id]
 * @property {*} [result]
 * @property {IMessageRpcError} [error]
 * @property {string} [method]
 * @property {unknown} [params]
 */

/**
 * @typedef {object} IMessageRpcNotification
 * @property {string} method
 * @property {unknown} [params]
 */

/**
 * @typedef {object} IMessageRpcClientOptions
 * @property {string} [cliPath]
 * @property {string} [dbPath]
 * @property {import("../runtime.js").RuntimeEnv} [runtime]
 * @property {(msg: IMessageRpcNotification) => void} [onNotification]
 */

export class IMessageRpcClient {
  /** @type {string} */
  _cliPath;
  /** @type {string | undefined} */
  _dbPath;
  _runtime;
  _onNotification;
  _pending = /** @type {Map<string, {resolve: Function, reject: Function, timer?: NodeJS.Timeout}>} */ (new Map());
  _closed;
  _closedResolve = null;
  _child = null;
  _reader = null;
  _nextId = 1;
  constructor(opts = {}) {
    this._cliPath = opts.cliPath?.trim() || 'imsg';
    this._dbPath = opts.dbPath?.trim() ? resolveUserPath(opts.dbPath) : void 0;
    this._runtime = opts.runtime;
    this._onNotification = opts.onNotification;
    this._closed = new Promise((resolve) => {
      this._closedResolve = resolve;
    });
  }
  async start() {
    if (this._child) {
      return;
    }
    const args = ['rpc'];
    if (this._dbPath) {
      args.push('--db', this._dbPath);
    }
    const child = spawn(this._cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this._child = child;
    this._reader = createInterface({ input: child.stdout });
    this._reader.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      this._handleLine(trimmed);
    });
    child.stderr?.on('data', (chunk) => {
      const lines = chunk.toString().split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        this._runtime?.error?.(`imsg rpc: ${line.trim()}`);
      }
    });
    child.on('error', (err) => {
      this._failAll(err instanceof Error ? err : new Error(String(err)));
      this._closedResolve?.();
    });
    child.on('close', (code, signal) => {
      if (code !== 0 && code !== null) {
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        this._failAll(new Error(`imsg rpc exited (${reason})`));
      } else {
        this._failAll(new Error('imsg rpc closed'));
      }
      this._closedResolve?.();
    });
  }
  async stop() {
    if (!this._child) {
      return;
    }
    this._reader?.close();
    this._reader = null;
    this._child.stdin?.end();
    const child = this._child;
    this._child = null;
    await Promise.race([
      this._closed,
      new Promise((resolve) => {
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
          resolve();
        }, 500);
      })
    ]);
  }
  async waitForClose() {
    await this._closed;
  }
  async request(method, params, opts) {
    if (!this._child || !this._child.stdin) {
      throw new Error('imsg rpc not running');
    }
    const id = this._nextId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? {}
    };
    const line = `${JSON.stringify(payload)}\n`;
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_IMESSAGE_PROBE_TIMEOUT_MS;
    const response = new Promise((resolve, reject) => {
      const key = String(id);
      const timer = timeoutMs > 0 ? setTimeout(() => {
        this._pending.delete(key);
        reject(new Error(`imsg rpc timeout (${method})`));
      }, timeoutMs) : void 0;
      this._pending.set(key, {
        resolve: (value) => resolve(value),
        reject,
        timer
      });
    });
    this._child.stdin.write(line);
    return await response;
  }
  _handleLine(line) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this._runtime?.error?.(`imsg rpc: failed to parse ${line}: ${detail}`);
      return;
    }
    if (parsed.id !== void 0 && parsed.id !== null) {
      const key = String(parsed.id);
      const pending = this._pending.get(key);
      if (!pending) {
        return;
      }
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      this._pending.delete(key);
      if (parsed.error) {
        const baseMessage = parsed.error.message ?? 'imsg rpc error';
        const details = parsed.error.data;
        const code = parsed.error.code;
        const suffixes = [];
        if (typeof code === 'number') {
          suffixes.push(`code=${code}`);
        }
        if (details !== void 0) {
          const detailText = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
          if (detailText) {
            suffixes.push(detailText);
          }
        }
        const msg = suffixes.length > 0 ? `${baseMessage}: ${suffixes.join(' ')}` : baseMessage;
        pending.reject(new Error(msg));
        return;
      }
      pending.resolve(parsed.result);
      return;
    }
    if (parsed.method) {
      this._onNotification?.({
        method: parsed.method,
        params: parsed.params
      });
    }
  }
  _failAll(err) {
    for (const [key, pending] of this._pending.entries()) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      pending.reject(err);
      this._pending.delete(key);
    }
  }
}
export async function createIMessageRpcClient(opts = {}) {
  const client = new IMessageRpcClient(opts);
  await client.start();
  return client;
}
