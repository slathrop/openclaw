/**
 * Utility functions for web fetch operations and content extraction.
 * @param value
 * @module agents/tools/web-fetch-utils
 */
function decodeEntities(value) {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))).replace(/&#(\d+);/gi, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)));
}
function stripTags(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ''));
}
function normalizeWhitespace(value) {
  return value.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}
function htmlToMarkdown(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? normalizeWhitespace(stripTags(titleMatch[1])) : void 0;
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => {
    const label = normalizeWhitespace(stripTags(body));
    if (!label) {
      return href;
    }
    return `[${label}](${href})`;
  });
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => {
    const prefix = '#'.repeat(Math.max(1, Math.min(6, Number.parseInt(level, 10))));
    const label = normalizeWhitespace(stripTags(body));
    return `
${prefix} ${label}
`;
  });
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => {
    const label = normalizeWhitespace(stripTags(body));
    return label ? `
- ${label}` : '';
  });
  text = text.replace(/<(br|hr)\s*\/?>/gi, '\n').replace(/<\/(p|div|section|article|header|footer|table|tr|ul|ol)>/gi, '\n');
  text = stripTags(text);
  text = normalizeWhitespace(text);
  return { text, title };
}
function markdownToText(markdown) {
  let text = markdown;
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, '');
  text = text.replace(/\[([^\]]+)]\([^)]+\)/g, '$1');
  text = text.replace(
    /```[\s\S]*?```/g,
    (block) => block.replace(/```[^\n]*\n?/g, '').replace(/```/g, '')
  );
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  return normalizeWhitespace(text);
}
function truncateText(value, maxChars) {
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }
  return { text: value.slice(0, maxChars), truncated: true };
}
async function extractReadableContent(params) {
  const fallback = () => {
    const rendered = htmlToMarkdown(params.html);
    if (params.extractMode === 'text') {
      const text = markdownToText(rendered.text) || normalizeWhitespace(stripTags(params.html));
      return { text, title: rendered.title };
    }
    return rendered;
  };
  try {
    const [{ Readability }, { parseHTML }] = await Promise.all([
      import('@mozilla/readability'),
      import('linkedom')
    ]);
    const { document } = parseHTML(params.html);
    try {
      document.baseURI = params.url;
    } catch {
      // intentionally ignored
    }
    const reader = new Readability(document, { charThreshold: 0 });
    const parsed = reader.parse();
    if (!parsed?.content) {
      return fallback();
    }
    const title = parsed.title || void 0;
    if (params.extractMode === 'text') {
      const text = normalizeWhitespace(parsed.textContent ?? '');
      return text ? { text, title } : fallback();
    }
    const rendered = htmlToMarkdown(parsed.content);
    return { text: rendered.text, title: title ?? rendered.title };
  } catch {
    return fallback();
  }
}
export {
  extractReadableContent,
  htmlToMarkdown,
  markdownToText,
  truncateText
};
