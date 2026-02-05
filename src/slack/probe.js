const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { createSlackWebClient } from './client.js';
function withTimeout(promise, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}
__name(withTimeout, 'withTimeout');
async function probeSlack(token, timeoutMs = 2500) {
  const client = createSlackWebClient(token);
  const start = Date.now();
  try {
    const result = await withTimeout(client.auth.test(), timeoutMs);
    if (!result.ok) {
      return {
        ok: false,
        status: 200,
        error: result.error ?? 'unknown',
        elapsedMs: Date.now() - start
      };
    }
    return {
      ok: true,
      status: 200,
      elapsedMs: Date.now() - start,
      bot: { id: result.user_id ?? void 0, name: result.user ?? void 0 },
      team: { id: result.team_id ?? void 0, name: result.team ?? void 0 }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = typeof err.status === 'number' ? err.status : null;
    return {
      ok: false,
      status,
      error: message,
      elapsedMs: Date.now() - start
    };
  }
}
__name(probeSlack, 'probeSlack');
export {
  probeSlack
};
