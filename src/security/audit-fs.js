 
import fs from 'node:fs/promises';
import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  formatIcaclsResetCommand,
  formatWindowsAclSummary,
  inspectWindowsAcl
} from './windows-acl.js';
async function safeStat(targetPath) {
  try {
    const lst = await fs.lstat(targetPath);
    return {
      ok: true,
      isSymlink: lst.isSymbolicLink(),
      isDir: lst.isDirectory(),
      mode: typeof lst.mode === 'number' ? lst.mode : null,
      uid: typeof lst.uid === 'number' ? lst.uid : null,
      gid: typeof lst.gid === 'number' ? lst.gid : null
    };
  } catch (err) {
    return {
      ok: false,
      isSymlink: false,
      isDir: false,
      mode: null,
      uid: null,
      gid: null,
      error: String(err)
    };
  }
}
async function inspectPathPermissions(targetPath, opts) {
  const st = await safeStat(targetPath);
  if (!st.ok) {
    return {
      ok: false,
      isSymlink: false,
      isDir: false,
      mode: null,
      bits: null,
      source: 'unknown',
      worldWritable: false,
      groupWritable: false,
      worldReadable: false,
      groupReadable: false,
      error: st.error
    };
  }
  const bits = modeBits(st.mode);
  const platform = opts?.platform ?? process.platform;
  if (platform === 'win32') {
    const acl = await inspectWindowsAcl(targetPath, { env: opts?.env, exec: opts?.exec });
    if (!acl.ok) {
      return {
        ok: true,
        isSymlink: st.isSymlink,
        isDir: st.isDir,
        mode: st.mode,
        bits,
        source: 'unknown',
        worldWritable: false,
        groupWritable: false,
        worldReadable: false,
        groupReadable: false,
        error: acl.error
      };
    }
    return {
      ok: true,
      isSymlink: st.isSymlink,
      isDir: st.isDir,
      mode: st.mode,
      bits,
      source: 'windows-acl',
      worldWritable: acl.untrustedWorld.some((entry) => entry.canWrite),
      groupWritable: acl.untrustedGroup.some((entry) => entry.canWrite),
      worldReadable: acl.untrustedWorld.some((entry) => entry.canRead),
      groupReadable: acl.untrustedGroup.some((entry) => entry.canRead),
      aclSummary: formatWindowsAclSummary(acl)
    };
  }
  return {
    ok: true,
    isSymlink: st.isSymlink,
    isDir: st.isDir,
    mode: st.mode,
    bits,
    source: 'posix',
    worldWritable: isWorldWritable(bits),
    groupWritable: isGroupWritable(bits),
    worldReadable: isWorldReadable(bits),
    groupReadable: isGroupReadable(bits)
  };
}
function formatPermissionDetail(targetPath, perms) {
  if (perms.source === 'windows-acl') {
    const summary = perms.aclSummary ?? 'unknown';
    return `${targetPath} acl=${summary}`;
  }
  return `${targetPath} mode=${formatOctal(perms.bits)}`;
}
function formatPermissionRemediation(params) {
  if (params.perms.source === 'windows-acl') {
    return formatIcaclsResetCommand(params.targetPath, { isDir: params.isDir, env: params.env });
  }
  const mode = params.posixMode.toString(8).padStart(3, '0');
  return `chmod ${mode} ${params.targetPath}`;
}
function modeBits(mode) {
  if (mode === null || mode === undefined) {
    return null;
  }
  return mode & 511;
}
function formatOctal(bits) {
  if (bits === null || bits === undefined) {
    return 'unknown';
  }
  return bits.toString(8).padStart(3, '0');
}
function isWorldWritable(bits) {
  if (bits === null || bits === undefined) {
    return false;
  }
  return (bits & 2) !== 0;
}
function isGroupWritable(bits) {
  if (bits === null || bits === undefined) {
    return false;
  }
  return (bits & 16) !== 0;
}
function isWorldReadable(bits) {
  if (bits === null || bits === undefined) {
    return false;
  }
  return (bits & 4) !== 0;
}
function isGroupReadable(bits) {
  if (bits === null || bits === undefined) {
    return false;
  }
  return (bits & 32) !== 0;
}
export {
  formatOctal,
  formatPermissionDetail,
  formatPermissionRemediation,
  inspectPathPermissions,
  isGroupReadable,
  isGroupWritable,
  isWorldReadable,
  isWorldWritable,
  modeBits,
  safeStat
};
