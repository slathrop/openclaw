/**
 * @module version
 * OpenClaw version parsing and comparison utilities.
 */

/**
 * @typedef {{ major: number, minor: number, patch: number, revision: number }} OpenClawVersion
 */

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-(\d+))?/;

/**
 * Parses an OpenClaw version string into its components.
 * @param {string | null | undefined} raw
 * @returns {OpenClawVersion | null}
 */
export function parseOpenClawVersion(raw) {
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(VERSION_RE);
  if (!match) {
    return null;
  }
  const [, major, minor, patch, revision] = match;
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
    revision: revision ? Number.parseInt(revision, 10) : 0
  };
}

/**
 * Compares two OpenClaw version strings. Returns -1, 0, 1, or null if unparseable.
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @returns {number | null}
 */
export function compareOpenClawVersions(a, b) {
  const parsedA = parseOpenClawVersion(a);
  const parsedB = parseOpenClawVersion(b);
  if (!parsedA || !parsedB) {
    return null;
  }
  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }
  if (parsedA.revision !== parsedB.revision) {
    return parsedA.revision < parsedB.revision ? -1 : 1;
  }
  return 0;
}
