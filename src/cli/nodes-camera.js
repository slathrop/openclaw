const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveCliName } from './cli-name.js';
function asRecord(value) {
  return typeof value === 'object' && value !== null ? value : {};
}
__name(asRecord, 'asRecord');
function asString(value) {
  return typeof value === 'string' ? value : void 0;
}
__name(asString, 'asString');
function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : void 0;
}
__name(asNumber, 'asNumber');
function asBoolean(value) {
  return typeof value === 'boolean' ? value : void 0;
}
__name(asBoolean, 'asBoolean');
function parseCameraSnapPayload(value) {
  const obj = asRecord(value);
  const format = asString(obj.format);
  const base64 = asString(obj.base64);
  const width = asNumber(obj.width);
  const height = asNumber(obj.height);
  if (!format || !base64 || width === void 0 || height === void 0) {
    throw new Error('invalid camera.snap payload');
  }
  return { format, base64, width, height };
}
__name(parseCameraSnapPayload, 'parseCameraSnapPayload');
function parseCameraClipPayload(value) {
  const obj = asRecord(value);
  const format = asString(obj.format);
  const base64 = asString(obj.base64);
  const durationMs = asNumber(obj.durationMs);
  const hasAudio = asBoolean(obj.hasAudio);
  if (!format || !base64 || durationMs === void 0 || hasAudio === void 0) {
    throw new Error('invalid camera.clip payload');
  }
  return { format, base64, durationMs, hasAudio };
}
__name(parseCameraClipPayload, 'parseCameraClipPayload');
function cameraTempPath(opts) {
  const tmpDir = opts.tmpDir ?? os.tmpdir();
  const id = opts.id ?? randomUUID();
  const facingPart = opts.facing ? `-${opts.facing}` : '';
  const ext = opts.ext.startsWith('.') ? opts.ext : `.${opts.ext}`;
  const cliName = resolveCliName();
  return path.join(tmpDir, `${cliName}-camera-${opts.kind}${facingPart}-${id}${ext}`);
}
__name(cameraTempPath, 'cameraTempPath');
async function writeBase64ToFile(filePath, base64) {
  const buf = Buffer.from(base64, 'base64');
  await fs.writeFile(filePath, buf);
  return { path: filePath, bytes: buf.length };
}
__name(writeBase64ToFile, 'writeBase64ToFile');
export {
  cameraTempPath,
  parseCameraClipPayload,
  parseCameraSnapPayload,
  writeBase64ToFile
};
