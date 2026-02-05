import fs from 'node:fs/promises';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const plistEscape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const plistUnescape = (value) => value.replaceAll('&apos;', "'").replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const renderEnvDict = (env) => {
  if (!env) {
    return '';
  }
  const entries = Object.entries(env).filter(
    ([, value]) => typeof value === 'string' && value.trim()
  );
  if (entries.length === 0) {
    return '';
  }
  const items = entries.map(
    ([key, value]) => `
    <key>${plistEscape(key)}</key>
    <string>${plistEscape(value?.trim() ?? '')}</string>`
  ).join('');
  return `
    <key>EnvironmentVariables</key>
    <dict>${items}
    </dict>`;
};
async function readLaunchAgentProgramArgumentsFromFile(plistPath) {
  try {
    const plist = await fs.readFile(plistPath, 'utf8');
    const programMatch = plist.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/i);
    if (!programMatch) {
      return null;
    }
    const args = Array.from(programMatch[1].matchAll(/<string>([\s\S]*?)<\/string>/gi)).map(
      (match) => plistUnescape(match[1] ?? '').trim()
    );
    const workingDirMatch = plist.match(
      /<key>WorkingDirectory<\/key>\s*<string>([\s\S]*?)<\/string>/i
    );
    const workingDirectory = workingDirMatch ? plistUnescape(workingDirMatch[1] ?? '').trim() : '';
    const envMatch = plist.match(/<key>EnvironmentVariables<\/key>\s*<dict>([\s\S]*?)<\/dict>/i);
    const environment = {};
    if (envMatch) {
      for (const pair of envMatch[1].matchAll(
        /<key>([\s\S]*?)<\/key>\s*<string>([\s\S]*?)<\/string>/gi
      )) {
        const key = plistUnescape(pair[1] ?? '').trim();
        if (!key) {
          continue;
        }
        const value = plistUnescape(pair[2] ?? '').trim();
        environment[key] = value;
      }
    }
    return {
      programArguments: args.filter(Boolean),
      ...workingDirectory ? { workingDirectory } : {},
      ...Object.keys(environment).length > 0 ? { environment } : {},
      sourcePath: plistPath
    };
  } catch {
    return null;
  }
}
function buildLaunchAgentPlist({
  label,
  comment,
  programArguments,
  workingDirectory,
  stdoutPath,
  stderrPath,
  environment
}) {
  const argsXml = programArguments.map((arg) => `
      <string>${plistEscape(arg)}</string>`).join('');
  const workingDirXml = workingDirectory ? `
    <key>WorkingDirectory</key>
    <string>${plistEscape(workingDirectory)}</string>` : '';
  const commentXml = comment?.trim() ? `
    <key>Comment</key>
    <string>${plistEscape(comment.trim())}</string>` : '';
  const envXml = renderEnvDict(environment);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${plistEscape(label)}</string>
    ${commentXml}
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProgramArguments</key>
    <array>${argsXml}
    </array>
    ${workingDirXml}
    <key>StandardOutPath</key>
    <string>${plistEscape(stdoutPath)}</string>
    <key>StandardErrorPath</key>
    <string>${plistEscape(stderrPath)}</string>${envXml}
  </dict>
</plist>
`;
}
export {
  buildLaunchAgentPlist,
  readLaunchAgentProgramArgumentsFromFile
};
