import { getFileExtension } from './mime.js';
const VOICE_AUDIO_EXTENSIONS = /* @__PURE__ */ new Set(['.oga', '.ogg', '.opus']);
function isVoiceCompatibleAudio(opts) {
  const mime = opts.contentType?.toLowerCase();
  if (mime && (mime.includes('ogg') || mime.includes('opus'))) {
    return true;
  }
  const fileName = opts.fileName?.trim();
  if (!fileName) {
    return false;
  }
  const ext = getFileExtension(fileName);
  if (!ext) {
    return false;
  }
  return VOICE_AUDIO_EXTENSIONS.has(ext);
}
export {
  isVoiceCompatibleAudio
};
