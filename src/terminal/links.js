/**
 * Terminal hyperlink formatting for documentation URLs.
 *
 * Creates clickable terminal links (OSC-8) to the OpenClaw docs site.
 * Falls back to plain URLs in terminals without hyperlink support.
 */
import { formatTerminalLink } from '../utils.js';

export const DOCS_ROOT = 'https://docs.openclaw.ai';

/**
 * @param {string} path
 * @param {string} [label]
 * @param {object} [opts]
 * @param {string} [opts.fallback]
 * @param {boolean} [opts.force]
 * @returns {string}
 */
export const formatDocsLink = (path, label, opts) => {
  const trimmed = path.trim();
  const url = trimmed.startsWith('http')
    ? trimmed
    : `${DOCS_ROOT}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
  return formatTerminalLink(label ?? url, url, {
    fallback: opts?.fallback ?? url,
    force: opts?.force
  });
};

/**
 * @param {string} [label]
 * @returns {string}
 */
export const formatDocsRootLink = (label) => {
  return formatTerminalLink(label ?? DOCS_ROOT, DOCS_ROOT, {
    fallback: DOCS_ROOT
  });
};
