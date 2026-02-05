const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import net from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { CHUTES_TOKEN_ENDPOINT, CHUTES_USERINFO_ENDPOINT } from '../agents/chutes-oauth.js';
import { loginChutes } from './chutes-oauth.js';
async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No TCP address')));
        return;
      }
      const port = address.port;
      server.close((err) => err ? reject(err) : resolve(port));
    });
  });
}
__name(getFreePort, 'getFreePort');
describe('loginChutes', () => {
  it('captures local redirect and exchanges code for tokens', async () => {
    const port = await getFreePort();
    const redirectUri = `http://127.0.0.1:${port}/oauth-callback`;
    const fetchFn = /* @__PURE__ */ __name(async (input, init) => {
      const url = String(input);
      if (url === CHUTES_TOKEN_ENDPOINT) {
        return new Response(
          JSON.stringify({
            access_token: 'at_local',
            refresh_token: 'rt_local',
            expires_in: 3600
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === CHUTES_USERINFO_ENDPOINT) {
        return new Response(JSON.stringify({ username: 'local-user' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return fetch(input, init);
    }, 'fetchFn');
    const onPrompt = vi.fn(async () => {
      throw new Error('onPrompt should not be called for local callback');
    });
    const creds = await loginChutes({
      app: { clientId: 'cid_test', redirectUri, scopes: ['openid'] },
      onAuth: /* @__PURE__ */ __name(async ({ url }) => {
        const state = new URL(url).searchParams.get('state');
        expect(state).toBeTruthy();
        await fetch(`${redirectUri}?code=code_local&state=${state}`);
      }, 'onAuth'),
      onPrompt,
      fetchFn
    });
    expect(onPrompt).not.toHaveBeenCalled();
    expect(creds.access).toBe('at_local');
    expect(creds.refresh).toBe('rt_local');
    expect(creds.email).toBe('local-user');
  });
  it('supports manual flow with pasted code', async () => {
    const fetchFn = /* @__PURE__ */ __name(async (input) => {
      const url = String(input);
      if (url === CHUTES_TOKEN_ENDPOINT) {
        return new Response(
          JSON.stringify({
            access_token: 'at_manual',
            refresh_token: 'rt_manual',
            expires_in: 3600
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === CHUTES_USERINFO_ENDPOINT) {
        return new Response(JSON.stringify({ username: 'manual-user' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('not found', { status: 404 });
    }, 'fetchFn');
    const creds = await loginChutes({
      app: {
        clientId: 'cid_test',
        redirectUri: 'http://127.0.0.1:1456/oauth-callback',
        scopes: ['openid']
      },
      manual: true,
      onAuth: /* @__PURE__ */ __name(async () => {
      }, 'onAuth'),
      onPrompt: /* @__PURE__ */ __name(async () => 'code_manual', 'onPrompt'),
      fetchFn
    });
    expect(creds.access).toBe('at_manual');
    expect(creds.refresh).toBe('rt_manual');
    expect(creds.email).toBe('manual-user');
  });
  it('does not reuse code_verifier as state', async () => {
    const fetchFn = /* @__PURE__ */ __name(async (input) => {
      const url = String(input);
      if (url === CHUTES_TOKEN_ENDPOINT) {
        return new Response(
          JSON.stringify({
            access_token: 'at_manual',
            refresh_token: 'rt_manual',
            expires_in: 3600
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === CHUTES_USERINFO_ENDPOINT) {
        return new Response(JSON.stringify({ username: 'manual-user' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('not found', { status: 404 });
    }, 'fetchFn');
    const createPkce = /* @__PURE__ */ __name(() => ({
      verifier: 'verifier_123',
      challenge: 'chal_123'
    }), 'createPkce');
    const createState = /* @__PURE__ */ __name(() => 'state_456', 'createState');
    const creds = await loginChutes({
      app: {
        clientId: 'cid_test',
        redirectUri: 'http://127.0.0.1:1456/oauth-callback',
        scopes: ['openid']
      },
      manual: true,
      createPkce,
      createState,
      onAuth: /* @__PURE__ */ __name(async ({ url }) => {
        const parsed = new URL(url);
        expect(parsed.searchParams.get('state')).toBe('state_456');
        expect(parsed.searchParams.get('state')).not.toBe('verifier_123');
      }, 'onAuth'),
      onPrompt: /* @__PURE__ */ __name(async () => 'code_manual', 'onPrompt'),
      fetchFn
    });
    expect(creds.access).toBe('at_manual');
  });
  it('rejects pasted redirect URLs missing state', async () => {
    const fetchFn = /* @__PURE__ */ __name(async () => new Response('not found', { status: 404 }), 'fetchFn');
    await expect(
      loginChutes({
        app: {
          clientId: 'cid_test',
          redirectUri: 'http://127.0.0.1:1456/oauth-callback',
          scopes: ['openid']
        },
        manual: true,
        createPkce: /* @__PURE__ */ __name(() => ({ verifier: 'verifier_123', challenge: 'chal_123' }), 'createPkce'),
        createState: /* @__PURE__ */ __name(() => 'state_456', 'createState'),
        onAuth: /* @__PURE__ */ __name(async () => {
        }, 'onAuth'),
        onPrompt: /* @__PURE__ */ __name(async () => 'http://127.0.0.1:1456/oauth-callback?code=code_only', 'onPrompt'),
        fetchFn
      })
    ).rejects.toThrow("Missing 'state' parameter");
  });
});
