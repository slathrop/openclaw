const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { Writable } from 'node:stream';
import { defaultRuntime } from '../../runtime.js';
function emitDaemonActionJson(payload) {
  defaultRuntime.log(JSON.stringify(payload, null, 2));
}
__name(emitDaemonActionJson, 'emitDaemonActionJson');
function buildDaemonServiceSnapshot(service, loaded) {
  return {
    label: service.label,
    loaded,
    loadedText: service.loadedText,
    notLoadedText: service.notLoadedText
  };
}
__name(buildDaemonServiceSnapshot, 'buildDaemonServiceSnapshot');
function createNullWriter() {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
}
__name(createNullWriter, 'createNullWriter');
export {
  buildDaemonServiceSnapshot,
  createNullWriter,
  emitDaemonActionJson
};
