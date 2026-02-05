/**
 * Sensitive data redaction for log output and tool details.
 *
 * Applies regex-based pattern matching to mask secrets, tokens,
 * API keys, PEM blocks, and other sensitive values in log text.
 * Configurable via the OpenClaw config file redaction settings.
 */
import { createRequire } from 'node:module';

const requireConfig = createRequire(import.meta.url);

/**
 * @typedef {"off" | "tools"} RedactSensitiveMode
 */

const DEFAULT_REDACT_MODE = 'tools';
const DEFAULT_REDACT_MIN_LENGTH = 18;
const DEFAULT_REDACT_KEEP_START = 6;
const DEFAULT_REDACT_KEEP_END = 4;

const DEFAULT_REDACT_PATTERNS = [
  // ENV-style assignments.
  String.raw`\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)\b\s*[=:]\s*(["']?)([^\s"'\\]+)\1`,
  // JSON fields.
  String.raw`"(?:apiKey|token|secret|password|passwd|accessToken|refreshToken)"\s*:\s*"([^"]+)"`,
  // CLI flags.
  String.raw`--(?:api[-_]?key|token|secret|password|passwd)\s+(["']?)([^\s"']+)\1`,
  // Authorization headers.
  String.raw`Authorization\s*[:=]\s*Bearer\s+([A-Za-z0-9._\-+=]+)`,
  String.raw`\bBearer\s+([A-Za-z0-9._\-+=]{18,})\b`,
  // PEM blocks.
  String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----`,
  // Common token prefixes.
  String.raw`\b(sk-[A-Za-z0-9_-]{8,})\b`,
  String.raw`\b(ghp_[A-Za-z0-9]{20,})\b`,
  String.raw`\b(github_pat_[A-Za-z0-9_]{20,})\b`,
  String.raw`\b(xox[baprs]-[A-Za-z0-9-]{10,})\b`,
  String.raw`\b(xapp-[A-Za-z0-9-]{10,})\b`,
  String.raw`\b(gsk_[A-Za-z0-9_-]{10,})\b`,
  String.raw`\b(AIza[0-9A-Za-z\-_]{20,})\b`,
  String.raw`\b(pplx-[A-Za-z0-9_-]{10,})\b`,
  String.raw`\b(npm_[A-Za-z0-9]{10,})\b`,
  String.raw`\b(\d{6,}:[A-Za-z0-9_-]{20,})\b`
];

const normalizeMode = (value) => {
  return value === 'off' ? 'off' : DEFAULT_REDACT_MODE;
};

const parsePattern = (raw) => {
  if (!raw.trim()) {
    return null;
  }
  const match = raw.match(/^\/(.+)\/([gimsuy]*)$/);
  try {
    if (match) {
      const flags = match[2].includes('g') ? match[2] : `${match[2]}g`;
      return new RegExp(match[1], flags);
    }
    return new RegExp(raw, 'gi');
  } catch {
    return null;
  }
};

const resolvePatterns = (value) => {
  const source = value?.length ? value : DEFAULT_REDACT_PATTERNS;
  return source.map(parsePattern).filter((re) => Boolean(re));
};

const maskToken = (token) => {
  if (token.length < DEFAULT_REDACT_MIN_LENGTH) {
    return '***';
  }
  const start = token.slice(0, DEFAULT_REDACT_KEEP_START);
  const end = token.slice(-DEFAULT_REDACT_KEEP_END);
  return `${start}\u2026${end}`;
};

const redactPemBlock = (block) => {
  const lines = block.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return '***';
  }
  return `${lines[0]}\n\u2026redacted\u2026\n${lines[lines.length - 1]}`;
};

const redactMatch = (match, groups) => {
  if (match.includes('PRIVATE KEY-----')) {
    return redactPemBlock(match);
  }
  const token =
    groups.filter((value) => typeof value === 'string' && value.length > 0).at(-1) ?? match;
  const masked = maskToken(token);
  if (token === match) {
    return masked;
  }
  return match.replace(token, masked);
};

const redactText = (text, patterns) => {
  let next = text;
  for (const pattern of patterns) {
    next = next.replace(pattern, (...args) =>
      redactMatch(args[0], args.slice(1, args.length - 2))
    );
  }
  return next;
};

const resolveConfigRedaction = () => {
  let cfg;
  try {
    const loaded = requireConfig('../config/config.js');
    cfg = loaded.loadConfig?.().logging;
  } catch {
    cfg = undefined;
  }
  return {
    mode: normalizeMode(cfg?.redactSensitive),
    patterns: cfg?.redactPatterns
  };
};

/**
 * @param {string} text
 * @param {object} [options]
 * @param {string} [options.mode]
 * @param {string[]} [options.patterns]
 * @returns {string}
 */
export const redactSensitiveText = (text, options) => {
  if (!text) {
    return text;
  }
  const resolved = options ?? resolveConfigRedaction();
  if (normalizeMode(resolved.mode) === 'off') {
    return text;
  }
  const patterns = resolvePatterns(resolved.patterns);
  if (!patterns.length) {
    return text;
  }
  return redactText(text, patterns);
};

/**
 * @param {string} detail
 * @returns {string}
 */
export const redactToolDetail = (detail) => {
  const resolved = resolveConfigRedaction();
  if (normalizeMode(resolved.mode) !== 'tools') {
    return detail;
  }
  return redactSensitiveText(detail, resolved);
};

/**
 * @returns {string[]}
 */
export const getDefaultRedactPatterns = () => {
  return [...DEFAULT_REDACT_PATTERNS];
};
