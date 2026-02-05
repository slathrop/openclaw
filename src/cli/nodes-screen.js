const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeBase64ToFile } from './nodes-camera.js';
function asRecord(value) {
  return typeof value === 'object' && value !== null ? value : {};
}
__name(asRecord, 'asRecord');
function asString(value) {
  return typeof value === 'string' ? value : void 0;
}
__name(asString, 'asString');
function parseScreenRecordPayload(value) {
  const obj = asRecord(value);
  const format = asString(obj.format);
  const base64 = asString(obj.base64);
  if (!format || !base64) {
    throw new Error('invalid screen.record payload');
  }
  return {
    format,
    base64,
    durationMs: typeof obj.durationMs === 'number' ? obj.durationMs : void 0,
    fps: typeof obj.fps === 'number' ? obj.fps : void 0,
    screenIndex: typeof obj.screenIndex === 'number' ? obj.screenIndex : void 0,
    hasAudio: typeof obj.hasAudio === 'boolean' ? obj.hasAudio : void 0
  };
}
__name(parseScreenRecordPayload, 'parseScreenRecordPayload');
function screenRecordTempPath(opts) {
  const tmpDir = opts.tmpDir ?? os.tmpdir();
  const id = opts.id ?? randomUUID();
  const ext = opts.ext.startsWith('.') ? opts.ext : `.${opts.ext}`;
  return path.join(tmpDir, `openclaw-screen-record-${id}${ext}`);
}
__name(screenRecordTempPath, 'screenRecordTempPath');
async function writeScreenRecordToFile(filePath, base64) {
  return writeBase64ToFile(filePath, base64);
}
__name(writeScreenRecordToFile, 'writeScreenRecordToFile');
export {
  parseScreenRecordPayload,
  screenRecordTempPath,
  writeScreenRecordToFile
};
