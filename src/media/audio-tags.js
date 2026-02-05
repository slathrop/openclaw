import { parseInlineDirectives } from '../utils/directive-tags.js';
function parseAudioTag(text) {
  const result = parseInlineDirectives(text, { stripReplyTags: false });
  return {
    text: result.text,
    audioAsVoice: result.audioAsVoice,
    hadTag: result.hasAudioTag
  };
}
export {
  parseAudioTag
};
