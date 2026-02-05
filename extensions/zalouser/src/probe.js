import { runZca, parseJsonOutput } from './zca.js';
async function probeZalouser(profile, timeoutMs) {
  const result = await runZca(['me', 'info', '-j'], {
    profile,
    timeout: timeoutMs
  });
  if (!result.ok) {
    return { ok: false, error: result.stderr || 'Failed to probe' };
  }
  const user = parseJsonOutput(result.stdout);
  if (!user) {
    return { ok: false, error: 'Failed to parse user info' };
  }
  return { ok: true, user };
}
export {
  probeZalouser
};
