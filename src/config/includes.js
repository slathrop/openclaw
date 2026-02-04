/**
 * Config includes: $include directive for modular configs.
 *
 * Resolves $include directives in parsed config objects, supporting
 * single file includes, array includes with deep merge, sibling key
 * overrides, nested includes with circular detection, and max depth limits.
 * @example
 * ```json5
 * {
 *   "$include": "./base.json5",           // single file
 *   "$include": ["./a.json5", "./b.json5"] // merge multiple
 * }
 * ```
 */

import JSON5 from 'json5';
import fs from 'node:fs';
import path from 'node:path';

export const INCLUDE_KEY = '$include';
export const MAX_INCLUDE_DEPTH = 10;

/**
 * @typedef {{ readFile: (path: string) => string, parseJson: (raw: string) => unknown }} IncludeResolver
 */

// ============================================================================
// Errors
// ============================================================================

export class ConfigIncludeError extends Error {
  /**
   * @param {string} message
   * @param {string} includePath
   * @param {Error} [cause]
   */
  constructor(message, includePath, cause) {
    super(message);
    this.name = 'ConfigIncludeError';
    this.includePath = includePath;
    this.cause = cause;
  }
}

export class CircularIncludeError extends ConfigIncludeError {
  /** @param {string[]} chain */
  constructor(chain) {
    super(`Circular include detected: ${chain.join(' -> ')}`, chain[chain.length - 1]);
    this.name = 'CircularIncludeError';
    this.chain = chain;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Deep merge: arrays concatenate, objects merge recursively, primitives: source wins.
 * @param {unknown} target
 * @param {unknown} source
 * @returns {unknown}
 */
export function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      result[key] = key in result ? deepMerge(result[key], source[key]) : source[key];
    }
    return result;
  }
  return source;
}

// ============================================================================
// Include Resolver Class
// ============================================================================

class IncludeProcessor {
  /**
   * @param {string} basePath
   * @param {IncludeResolver} resolver
   */
  constructor(basePath, resolver) {
    this._basePath = basePath;
    this._resolver = resolver;
    this._visited = new Set();
    this._visited.add(path.normalize(basePath));
    this._depth = 0;
  }

  /** @param {unknown} obj */
  process(obj) {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.process(item));
    }

    if (!isPlainObject(obj)) {
      return obj;
    }

    if (!(INCLUDE_KEY in obj)) {
      return this._processObject(obj);
    }

    return this._processInclude(obj);
  }

  /** @param {Record<string, unknown>} obj */
  _processObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.process(value);
    }
    return result;
  }

  /** @param {Record<string, unknown>} obj */
  _processInclude(obj) {
    const includeValue = obj[INCLUDE_KEY];
    const otherKeys = Object.keys(obj).filter((k) => k !== INCLUDE_KEY);
    const included = this._resolveInclude(includeValue);

    if (otherKeys.length === 0) {
      return included;
    }

    if (!isPlainObject(included)) {
      throw new ConfigIncludeError(
        'Sibling keys require included content to be an object',
        typeof includeValue === 'string' ? includeValue : INCLUDE_KEY
      );
    }

    // Merge included content with sibling keys
    const rest = {};
    for (const key of otherKeys) {
      rest[key] = this.process(obj[key]);
    }
    return deepMerge(included, rest);
  }

  /** @param {unknown} value */
  _resolveInclude(value) {
    if (typeof value === 'string') {
      return this._loadFile(value);
    }

    if (Array.isArray(value)) {
      return value.reduce((merged, item) => {
        if (typeof item !== 'string') {
          throw new ConfigIncludeError(
            `Invalid $include array item: expected string, got ${typeof item}`,
            String(item)
          );
        }
        return deepMerge(merged, this._loadFile(item));
      }, {});
    }

    throw new ConfigIncludeError(
      `Invalid $include value: expected string or array of strings, got ${typeof value}`,
      String(value)
    );
  }

  /** @param {string} includePath */
  _loadFile(includePath) {
    const resolvedPath = this._resolvePath(includePath);

    this._checkCircular(resolvedPath);
    this._checkDepth(includePath);

    const raw = this._readFile(includePath, resolvedPath);
    const parsed = this._parseFile(includePath, resolvedPath, raw);

    return this._processNested(resolvedPath, parsed);
  }

  /** @param {string} includePath */
  _resolvePath(includePath) {
    const resolved = path.isAbsolute(includePath)
      ? includePath
      : path.resolve(path.dirname(this._basePath), includePath);
    return path.normalize(resolved);
  }

  /** @param {string} resolvedPath */
  _checkCircular(resolvedPath) {
    if (this._visited.has(resolvedPath)) {
      throw new CircularIncludeError([...this._visited, resolvedPath]);
    }
  }

  /** @param {string} includePath */
  _checkDepth(includePath) {
    if (this._depth >= MAX_INCLUDE_DEPTH) {
      throw new ConfigIncludeError(
        `Maximum include depth (${MAX_INCLUDE_DEPTH}) exceeded at: ${includePath}`,
        includePath
      );
    }
  }

  /**
   * @param {string} includePath
   * @param {string} resolvedPath
   */
  _readFile(includePath, resolvedPath) {
    try {
      return this._resolver.readFile(resolvedPath);
    } catch (err) {
      throw new ConfigIncludeError(
        `Failed to read include file: ${includePath} (resolved: ${resolvedPath})`,
        includePath,
        err instanceof Error ? err : undefined
      );
    }
  }

  /**
   * @param {string} includePath
   * @param {string} resolvedPath
   * @param {string} raw
   */
  _parseFile(includePath, resolvedPath, raw) {
    try {
      return this._resolver.parseJson(raw);
    } catch (err) {
      throw new ConfigIncludeError(
        `Failed to parse include file: ${includePath} (resolved: ${resolvedPath})`,
        includePath,
        err instanceof Error ? err : undefined
      );
    }
  }

  /**
   * @param {string} resolvedPath
   * @param parsed
   */
  _processNested(resolvedPath, parsed) {
    const nested = new IncludeProcessor(resolvedPath, this._resolver);
    nested._visited = new Set([...this._visited, resolvedPath]);
    nested._depth = this._depth + 1;
    return nested.process(parsed);
  }
}

// ============================================================================
// Public API
// ============================================================================

/** @type {IncludeResolver} */
const defaultResolver = {
  readFile: (p) => fs.readFileSync(p, 'utf-8'),
  parseJson: (raw) => JSON5.parse(raw)
};

/**
 * Resolves all $include directives in a parsed config object.
 * @param {unknown} obj
 * @param {string} configPath
 * @param {IncludeResolver} [resolver]
 * @returns {unknown}
 */
export function resolveConfigIncludes(obj, configPath, resolver = defaultResolver) {
  return new IncludeProcessor(configPath, resolver).process(obj);
}
