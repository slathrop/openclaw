const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import {
  chunkMarkdownIR,
  markdownToIR
} from '../markdown/ir.js';
import { renderMarkdownWithMarkers } from '../markdown/render.js';
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
__name(escapeHtml, 'escapeHtml');
function escapeHtmlAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
__name(escapeHtmlAttr, 'escapeHtmlAttr');
// eslint-disable-next-line no-unused-vars
function buildTelegramLink(link, _text) {
  const href = link.href.trim();
  if (!href) {
    return null;
  }
  if (link.start === link.end) {
    return null;
  }
  const safeHref = escapeHtmlAttr(href);
  return {
    start: link.start,
    end: link.end,
    open: `<a href="${safeHref}">`,
    close: '</a>'
  };
}
__name(buildTelegramLink, 'buildTelegramLink');
function renderTelegramHtml(ir) {
  return renderMarkdownWithMarkers(ir, {
    styleMarkers: {
      bold: { open: '<b>', close: '</b>' },
      italic: { open: '<i>', close: '</i>' },
      strikethrough: { open: '<s>', close: '</s>' },
      code: { open: '<code>', close: '</code>' },
      code_block: { open: '<pre><code>', close: '</code></pre>' }
    },
    escapeText: escapeHtml,
    buildLink: buildTelegramLink
  });
}
__name(renderTelegramHtml, 'renderTelegramHtml');
function markdownToTelegramHtml(markdown, options = {}) {
  const ir = markdownToIR(markdown ?? '', {
    linkify: true,
    headingStyle: 'none',
    blockquotePrefix: '',
    tableMode: options.tableMode
  });
  return renderTelegramHtml(ir);
}
__name(markdownToTelegramHtml, 'markdownToTelegramHtml');
function renderTelegramHtmlText(text, options = {}) {
  const textMode = options.textMode ?? 'markdown';
  if (textMode === 'html') {
    return text;
  }
  return markdownToTelegramHtml(text, { tableMode: options.tableMode });
}
__name(renderTelegramHtmlText, 'renderTelegramHtmlText');
function markdownToTelegramChunks(markdown, limit, options = {}) {
  const ir = markdownToIR(markdown ?? '', {
    linkify: true,
    headingStyle: 'none',
    blockquotePrefix: '',
    tableMode: options.tableMode
  });
  const chunks = chunkMarkdownIR(ir, limit);
  return chunks.map((chunk) => ({
    html: renderTelegramHtml(chunk),
    text: chunk.text
  }));
}
__name(markdownToTelegramChunks, 'markdownToTelegramChunks');
function markdownToTelegramHtmlChunks(markdown, limit) {
  return markdownToTelegramChunks(markdown, limit).map((chunk) => chunk.html);
}
__name(markdownToTelegramHtmlChunks, 'markdownToTelegramHtmlChunks');
export {
  markdownToTelegramChunks,
  markdownToTelegramHtml,
  markdownToTelegramHtmlChunks,
  renderTelegramHtmlText
};
