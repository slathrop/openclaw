import * as ops from './service/ops.js';
import { createCronServiceState } from './service/state.js';
class CronService {
  _state;
  constructor(deps) {
    this._state = createCronServiceState(deps);
  }
  async start() {
    await ops.start(this._state);
  }
  stop() {
    ops.stop(this._state);
  }
  async status() {
    return await ops.status(this._state);
  }
  async list(opts) {
    return await ops.list(this._state, opts);
  }
  async add(input) {
    return await ops.add(this._state, input);
  }
  async update(id, patch) {
    return await ops.update(this._state, id, patch);
  }
  async remove(id) {
    return await ops.remove(this._state, id);
  }
  async run(id, mode) {
    return await ops.run(this._state, id, mode);
  }
  wake(opts) {
    return ops.wakeNow(this._state, opts);
  }
}
export {
  CronService
};
