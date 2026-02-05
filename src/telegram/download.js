const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { detectMime } from '../media/mime.js';
import { saveMediaBuffer } from '../media/store.js';
async function getTelegramFile(token, fileId, timeoutMs = 3e4) {
  const res = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { signal: AbortSignal.timeout(timeoutMs) }
  );
  if (!res.ok) {
    throw new Error(`getFile failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.ok || !json.result?.file_path) {
    throw new Error('getFile returned no file_path');
  }
  return json.result;
}
__name(getTelegramFile, 'getTelegramFile');
async function downloadTelegramFile(token, info, maxBytes, timeoutMs = 6e4) {
  if (!info.file_path) {
    throw new Error('file_path missing');
  }
  const url = `https://api.telegram.org/file/bot${token}/${info.file_path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download telegram file: HTTP ${res.status}`);
  }
  const array = Buffer.from(await res.arrayBuffer());
  const mime = await detectMime({
    buffer: array,
    headerMime: res.headers.get('content-type'),
    filePath: info.file_path
  });
  const saved = await saveMediaBuffer(array, mime, 'inbound', maxBytes, info.file_path);
  if (!saved.contentType && mime) {
    saved.contentType = mime;
  }
  return saved;
}
__name(downloadTelegramFile, 'downloadTelegramFile');
export {
  downloadTelegramFile,
  getTelegramFile
};
