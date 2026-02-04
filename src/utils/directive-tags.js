/**
 * Inline directive tag parsing for model output.
 *
 * Parses [[audio_as_voice]], [[reply_to_current]], and [[reply_to: <id>]]
 * directives embedded in text output, stripping them and returning
 * structured parse results.
 */

/**
 * @typedef {object} InlineDirectiveParseResult
 * @property {string} text - Cleaned text with directives removed.
 * @property {boolean} audioAsVoice - Whether audio_as_voice directive was found.
 * @property {string} [replyToId] - Resolved reply target message ID.
 * @property {string} [replyToExplicitId] - Explicit reply_to ID if specified.
 * @property {boolean} replyToCurrent - Whether reply_to_current was found.
 * @property {boolean} hasAudioTag - Whether any audio directive was present.
 * @property {boolean} hasReplyTag - Whether any reply directive was present.
 */

const AUDIO_TAG_RE = /\[\[\s*audio_as_voice\s*\]\]/gi;
const REPLY_TAG_RE = /\[\[\s*(?:reply_to_current|reply_to\s*:\s*([^\]\n]+))\s*\]\]/gi;

/**
 * Normalizes whitespace in directive-stripped text.
 * @param {string} text
 * @returns {string}
 */
function normalizeDirectiveWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

/**
 * Parses inline directives from text and returns structured results.
 * @param {string} [text]
 * @param {object} [options]
 * @param {string} [options.currentMessageId]
 * @param {boolean} [options.stripAudioTag]
 * @param {boolean} [options.stripReplyTags]
 * @returns {InlineDirectiveParseResult}
 */
export function parseInlineDirectives(text, options = {}) {
  const {currentMessageId, stripAudioTag = true, stripReplyTags = true} = options;
  if (!text) {
    return {
      text: '',
      audioAsVoice: false,
      replyToCurrent: false,
      hasAudioTag: false,
      hasReplyTag: false
    };
  }

  let cleaned = text;
  let audioAsVoice = false;
  let hasAudioTag = false;
  let hasReplyTag = false;
  let sawCurrent = false;
  let lastExplicitId;

  cleaned = cleaned.replace(AUDIO_TAG_RE, (match) => {
    audioAsVoice = true;
    hasAudioTag = true;
    return stripAudioTag ? ' ' : match;
  });

  cleaned = cleaned.replace(REPLY_TAG_RE, (match, idRaw) => {
    hasReplyTag = true;
    if (idRaw === undefined) {
      sawCurrent = true;
    } else {
      const id = idRaw.trim();
      if (id) {
        lastExplicitId = id;
      }
    }
    return stripReplyTags ? ' ' : match;
  });

  cleaned = normalizeDirectiveWhitespace(cleaned);

  const replyToId =
    lastExplicitId ?? (sawCurrent ? currentMessageId?.trim() || undefined : undefined);

  return {
    text: cleaned,
    audioAsVoice,
    replyToId,
    replyToExplicitId: lastExplicitId,
    replyToCurrent: sawCurrent,
    hasAudioTag,
    hasReplyTag
  };
}
