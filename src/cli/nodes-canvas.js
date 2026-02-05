const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { randomUUID } from 'node:crypto';
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
function parseCanvasSnapshotPayload(value) {
  const obj = asRecord(value);
  const format = asString(obj.format);
  const base64 = asString(obj.base64);
  if (!format || !base64) {
    throw new Error('invalid canvas.snapshot payload');
  }
  return { format, base64 };
}
__name(parseCanvasSnapshotPayload, 'parseCanvasSnapshotPayload');
function canvasSnapshotTempPath(opts) {
  const tmpDir = opts.tmpDir ?? os.tmpdir();
  const id = opts.id ?? randomUUID();
  const ext = opts.ext.startsWith('.') ? opts.ext : `.${opts.ext}`;
  const cliName = resolveCliName();
  return path.join(tmpDir, `${cliName}-canvas-snapshot-${id}${ext}`);
}
__name(canvasSnapshotTempPath, 'canvasSnapshotTempPath');
export {
  canvasSnapshotTempPath,
  parseCanvasSnapshotPayload
};
