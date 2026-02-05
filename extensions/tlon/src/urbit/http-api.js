import { Urbit } from '@urbit/http-api';
let patched = false;
function ensureUrbitConnectPatched() {
  if (patched) {
    return;
  }
  patched = true;
  Urbit.prototype.connect = async function patchedConnect() {
    const resp = await fetch(`${this.url}/~/login`, {
      method: 'POST',
      body: `password=${this.code}`,
      credentials: 'include'
    });
    if (resp.status >= 400) {
      throw new Error(`Login failed with status ${resp.status}`);
    }
    const cookie = resp.headers.get('set-cookie');
    if (cookie) {
      const match = /urbauth-~([\w-]+)/.exec(cookie);
      if (match) {
        if (!this.ship) {
          this.ship = match[1];
        }
        this.nodeId = match[1];
      }
      this.cookie = cookie;
    }
    await this.getShipName();
    await this.getOurName();
  };
}
export {
  Urbit,
  ensureUrbitConnectPatched
};
