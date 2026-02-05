import { PREVIEW_MAX_CHARS, PREVIEW_MAX_LINES } from './constants.js';
function formatToolOutputForSidebar(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return `\`\`\`json\n${  JSON.stringify(parsed, null, 2)  }\n\`\`\``;
    } catch {
    }
  }
  return text;
}
function getTruncatedPreview(text) {
  const allLines = text.split('\n');
  const lines = allLines.slice(0, PREVIEW_MAX_LINES);
  const preview = lines.join('\n');
  if (preview.length > PREVIEW_MAX_CHARS) {
    return `${preview.slice(0, PREVIEW_MAX_CHARS)  }\u2026`;
  }
  return lines.length < allLines.length ? `${preview  }\u2026` : preview;
}
export {
  formatToolOutputForSidebar,
  getTruncatedPreview
};
