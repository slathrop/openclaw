import {
  chunkMarkdownIR,
  markdownToIR
} from '../markdown/ir.js';
function renderFeishuPost(ir) {
  const lines = [];
  const text = ir.text;
  if (!text) {
    return { zh_cn: { content: [[{ tag: 'text', text: '' }]] } };
  }
  const styleRanges = buildStyleRanges(ir.styles, text.length);
  const linkMap = buildLinkMap(ir.links);
  const textLines = text.split('\n');
  let charIndex = 0;
  for (const line of textLines) {
    const lineElements = [];
    if (line.length === 0) {
      lineElements.push({ tag: 'text', text: '' });
    } else {
      let segmentStart = charIndex;
      let currentStyles = getStylesAt(styleRanges, segmentStart);
      let currentLink = getLinkAt(linkMap, segmentStart);
      for (let i = 0; i < line.length; i++) {
        const pos = charIndex + i;
        const newStyles = getStylesAt(styleRanges, pos);
        const newLink = getLinkAt(linkMap, pos);
        const stylesChanged = !stylesEqual(currentStyles, newStyles);
        const linkChanged = currentLink !== newLink;
        if (stylesChanged || linkChanged) {
          const segmentText = text.slice(segmentStart, pos);
          if (segmentText) {
            lineElements.push(createPostElement(segmentText, currentStyles, currentLink));
          }
          segmentStart = pos;
          currentStyles = newStyles;
          currentLink = newLink;
        }
      }
      const finalText = text.slice(segmentStart, charIndex + line.length);
      if (finalText) {
        lineElements.push(createPostElement(finalText, currentStyles, currentLink));
      }
    }
    lines.push(lineElements.length > 0 ? lineElements : [{ tag: 'text', text: '' }]);
    charIndex += line.length + 1;
  }
  return {
    zh_cn: {
      content: lines
    }
  };
}
function buildStyleRanges(styles, textLength) {
  const ranges = Array(textLength).fill(null).map(() => ({
    bold: false,
    italic: false,
    strikethrough: false,
    code: false
  }));
  for (const span of styles) {
    for (let i = span.start; i < span.end && i < textLength; i++) {
      switch (span.style) {
        case 'bold':
          ranges[i].bold = true;
          break;
        case 'italic':
          ranges[i].italic = true;
          break;
        case 'strikethrough':
          ranges[i].strikethrough = true;
          break;
        case 'code':
        case 'code_block':
          ranges[i].code = true;
          break;
      }
    }
  }
  return ranges;
}
function buildLinkMap(links) {
  const map = /* @__PURE__ */ new Map();
  for (const link of links) {
    for (let i = link.start; i < link.end; i++) {
      map.set(i, link.href);
    }
  }
  return map;
}
function getStylesAt(ranges, pos) {
  return ranges[pos] ?? { bold: false, italic: false, strikethrough: false, code: false };
}
function getLinkAt(linkMap, pos) {
  return linkMap.get(pos);
}
function stylesEqual(a, b) {
  return a.bold === b.bold && a.italic === b.italic && a.strikethrough === b.strikethrough && a.code === b.code;
}
function createPostElement(text, styles, link) {
  const styleArray = [];
  if (styles.bold) {
    styleArray.push('bold');
  }
  if (styles.italic) {
    styleArray.push('italic');
  }
  if (styles.strikethrough) {
    styleArray.push('lineThrough');
  }
  if (styles.code) {
    styleArray.push('code');
  }
  if (link) {
    return {
      tag: 'a',
      text,
      href: link,
      ...styleArray.length > 0 ? { style: styleArray } : {}
    };
  }
  return {
    tag: 'text',
    text,
    ...styleArray.length > 0 ? { style: styleArray } : {}
  };
}
function markdownToFeishuPost(markdown, options = {}) {
  const ir = markdownToIR(markdown ?? '', {
    linkify: true,
    headingStyle: 'bold',
    blockquotePrefix: '\uFF5C ',
    tableMode: options.tableMode
  });
  return renderFeishuPost(ir);
}
function markdownToFeishuChunks(markdown, limit, options = {}) {
  const ir = markdownToIR(markdown ?? '', {
    linkify: true,
    headingStyle: 'bold',
    blockquotePrefix: '\uFF5C ',
    tableMode: options.tableMode
  });
  const chunks = chunkMarkdownIR(ir, limit);
  return chunks.map((chunk) => ({
    post: renderFeishuPost(chunk),
    text: chunk.text
  }));
}
function containsMarkdown(text) {
  if (!text) {
    return false;
  }
  const markdownPatterns = [
    /\*\*[^*]+\*\*/,
    // bold
    /\*[^*]+\*/,
    // italic
    /~~[^~]+~~/,
    // strikethrough
    /`[^`]+`/,
    // inline code
    /```[\s\S]*```/,
    // code block
    /\[.+\]\(.+\)/,
    // links
    /^#{1,6}\s/m,
    // headings
    /^[-*]\s/m,
    // unordered list
    /^\d+\.\s/m
    // ordered list
  ];
  return markdownPatterns.some((pattern) => pattern.test(text));
}
export {
  containsMarkdown,
  markdownToFeishuChunks,
  markdownToFeishuPost
};
