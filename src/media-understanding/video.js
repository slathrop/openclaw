import { DEFAULT_VIDEO_MAX_BASE64_BYTES } from './defaults.js';
function estimateBase64Size(bytes) {
  return Math.ceil(bytes / 3) * 4;
}
function resolveVideoMaxBase64Bytes(maxBytes) {
  const expanded = Math.floor(maxBytes * (4 / 3));
  return Math.min(expanded, DEFAULT_VIDEO_MAX_BASE64_BYTES);
}
export {
  estimateBase64Size,
  resolveVideoMaxBase64Bytes
};
