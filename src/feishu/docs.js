import { getChildLogger } from '../logging.js';
import { resolveFeishuApiBase } from './domain.js';

const logger = getChildLogger({ module: 'feishu-docs' });

/**
 * Regex patterns to extract doc_token from various Feishu/Lark URLs
 *
 * Supported URL formats:
 * - https://xxx.feishu.cn/docx/xxxxx
 * - https://xxx.feishu.cn/wiki/xxxxx
 * - https://xxx.feishu.cn/sheets/xxxxx
 * - https://xxx.feishu.cn/base/xxxxx (bitable)
 * - https://xxx.larksuite.com/docx/xxxxx
 * etc.
 */
/* eslint-disable no-useless-escape */
const DOC_URL_PATTERNS = [
  // docx (new version document) - token is typically 22-27 chars
  /https?:\/\/[^\/]+\/(docx)\/([A-Za-z0-9_-]{15,35})/,
  // doc (legacy document)
  /https?:\/\/[^\/]+\/(doc)\/([A-Za-z0-9_-]{15,35})/,
  // wiki
  /https?:\/\/[^\/]+\/(wiki)\/([A-Za-z0-9_-]{15,35})/,
  // sheets
  /https?:\/\/[^\/]+\/(sheets?)\/([A-Za-z0-9_-]{15,35})/,
  // bitable (base)
  /https?:\/\/[^\/]+\/(base|bitable)\/([A-Za-z0-9_-]{15,35})/,
  // mindnote
  /https?:\/\/[^\/]+\/(mindnote)\/([A-Za-z0-9_-]{15,35})/,
  // file
  /https?:\/\/[^\/]+\/(file)\/([A-Za-z0-9_-]{15,35})/,
  // slide
  /https?:\/\/[^\/]+\/(slides?)\/([A-Za-z0-9_-]{15,35})/
];
/* eslint-enable no-useless-escape */

/**
 * Extract document references from text content.
 * Looks for Feishu/Lark document URLs and extracts doc tokens.
 * @param {string} text
 * @returns {Array<{docToken: string, docType: string, url: string, title?: string}>}
 */
export function extractDocRefsFromText(text) {
  const refs = [];
  const seenTokens = new Set();

  for (const pattern of DOC_URL_PATTERNS) {
    const regex = new RegExp(pattern, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const [url, typeStr, token] = match;
      const docType = normalizeDocType(typeStr);

      if (!seenTokens.has(token)) {
        seenTokens.add(token);
        refs.push({
          docToken: token,
          docType,
          url
        });
      }
    }
  }

  return refs;
}

/**
 * Extract document references from a rich text (post) message content.
 * @param {unknown} content
 * @returns {Array<{docToken: string, docType: string, url: string, title?: string}>}
 */
export function extractDocRefsFromPost(content) {
  const refs = [];
  const seenTokens = new Set();

  try {
    // Post content structure: { title, content: [[{tag, ...}]] }
    const postContent = typeof content === 'string' ? JSON.parse(content) : content;

    // Check title for links
    if (postContent.title) {
      const titleRefs = extractDocRefsFromText(postContent.title);
      for (const ref of titleRefs) {
        if (!seenTokens.has(ref.docToken)) {
          seenTokens.add(ref.docToken);
          refs.push(ref);
        }
      }
    }

    // Check content elements
    if (Array.isArray(postContent.content)) {
      for (const line of postContent.content) {
        if (!Array.isArray(line)) {
          continue;
        }

        for (const element of line) {
          // Check hyperlinks
          if (element.tag === 'a' && element.href) {
            const linkRefs = extractDocRefsFromText(element.href);
            for (const ref of linkRefs) {
              if (!seenTokens.has(ref.docToken)) {
                seenTokens.add(ref.docToken);
                // Use the link text as title if available
                ref.title = element.text || undefined;
                refs.push(ref);
              }
            }
          }

          // Check text content for inline URLs
          if (element.tag === 'text' && element.text) {
            const textRefs = extractDocRefsFromText(element.text);
            for (const ref of textRefs) {
              if (!seenTokens.has(ref.docToken)) {
                seenTokens.add(ref.docToken);
                refs.push(ref);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    logger.debug(`Failed to parse post content: ${String(err)}`);
  }

  return refs;
}

/**
 * @param {string} typeStr
 * @returns {string}
 */
function normalizeDocType(typeStr) {
  switch (typeStr.toLowerCase()) {
    case 'docx':
      return 'docx';
    case 'doc':
      return 'doc';
    case 'sheet':
    case 'sheets':
      return 'sheet';
    case 'base':
    case 'bitable':
      return 'bitable';
    case 'wiki':
      return 'wiki';
    case 'mindnote':
      return 'mindnote';
    case 'file':
      return 'file';
    case 'slide':
    case 'slides':
      return 'slide';
    default:
      return 'docx';
  }
}

/**
 * Get wiki node info to resolve the actual document token.
 * @param {object} client
 * @param {string} nodeToken
 * @param {string} apiBase
 * @returns {Promise<{objToken: string, objType: string, title?: string}|null>}
 */
async function resolveWikiNode(client, nodeToken, apiBase) {
  try {
    logger.debug(`Resolving wiki node: ${nodeToken}`);

    const response = await client.request({
      method: 'GET',
      url: `${apiBase}/wiki/v2/spaces/get_node`,
      params: {
        token: nodeToken,
        obj_type: 'wiki'
      }
    });

    if (response?.code !== 0) {
      const errMsg = response?.msg || 'Unknown error';
      logger.warn(`Failed to resolve wiki node: ${errMsg} (code: ${response?.code})`);
      return null;
    }

    const node = response.data?.node;
    if (!node?.obj_token || !node?.obj_type) {
      logger.warn('Wiki node response missing obj_token or obj_type');
      return null;
    }

    return {
      objToken: node.obj_token,
      objType: node.obj_type,
      title: node.title
    };
  } catch (err) {
    logger.error(`Error resolving wiki node: ${String(err)}`);
    return null;
  }
}

/**
 * Fetch the content of a Feishu document.
 * @param {object} client
 * @param {{docToken: string, docType: string, url: string, title?: string}} docRef
 * @param {{maxLength?: number, lang?: string, apiBase?: string}} [options]
 * @returns {Promise<{content: string, truncated: boolean}|null>}
 */
export async function fetchFeishuDocContent(client, docRef, options = {}) {
  const { maxLength = 50000, lang = 'zh', apiBase } = options;
  const resolvedApiBase = apiBase ?? resolveFeishuApiBase();

  // For wiki type, first resolve the node to get the actual document token
  let targetToken = docRef.docToken;
  let targetType = docRef.docType;
  let resolvedTitle = docRef.title;

  if (docRef.docType === 'wiki') {
    const wikiNode = await resolveWikiNode(client, docRef.docToken, resolvedApiBase);
    if (!wikiNode) {
      return {
        content: `[Feishu Wiki Document: ${docRef.title || docRef.docToken}]\nLink: ${docRef.url}\n\n(Unable to access wiki node info. Please ensure the bot has been added as a wiki space member)`,
        truncated: false
      };
    }

    targetToken = wikiNode.objToken;
    targetType = wikiNode.objType;
    resolvedTitle = wikiNode.title || docRef.title;

    logger.debug(`Wiki node resolved: ${docRef.docToken} -> ${targetToken} (${targetType})`);
  }

  // Only docx is supported for content fetching
  if (targetType !== 'docx') {
    logger.debug(`Document type ${targetType} is not supported for content fetching`);
    return {
      content: `[Feishu ${getDocTypeName(targetType)} Document: ${resolvedTitle || targetToken}]\nLink: ${docRef.url}\n\n(This document type does not support content extraction. Please access the link directly)`,
      truncated: false
    };
  }

  try {
    logger.debug(`Fetching document content: ${targetToken} (${targetType})`);

    const response = await client.request({
      method: 'GET',
      url: `${resolvedApiBase}/docs/v1/content`,
      params: {
        doc_token: targetToken,
        doc_type: 'docx',
        content_type: 'markdown',
        lang
      }
    });

    if (response?.code !== 0) {
      const errMsg = response?.msg || 'Unknown error';
      logger.warn(`Failed to fetch document content: ${errMsg} (code: ${response?.code})`);

      // Check for common errors
      if (response?.code === 2889902) {
        return {
          content: `[Feishu Document: ${resolvedTitle || targetToken}]\nLink: ${docRef.url}\n\n(No permission to access this document. Please ensure the bot has been added as a document collaborator)`,
          truncated: false
        };
      }

      return {
        content: `[Feishu Document: ${resolvedTitle || targetToken}]\nLink: ${docRef.url}\n\n(Failed to fetch document content: ${errMsg})`,
        truncated: false
      };
    }

    let content = response.data?.content || '';
    let truncated = false;

    // Truncate if too long
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n... (Content truncated due to length)';
      truncated = true;
    }

    // Add document header
    const header = resolvedTitle
      ? `[Feishu Document: ${resolvedTitle}]\nLink: ${docRef.url}\n\n---\n\n`
      : `[Feishu Document]\nLink: ${docRef.url}\n\n---\n\n`;

    return {
      content: header + content,
      truncated
    };
  } catch (err) {
    logger.error(`Error fetching document content: ${String(err)}`);
    return {
      content: `[Feishu Document: ${resolvedTitle || targetToken}]\nLink: ${docRef.url}\n\n(Error occurred while fetching document content)`,
      truncated: false
    };
  }
}

/**
 * @param {string} docType
 * @returns {string}
 */
function getDocTypeName(docType) {
  switch (docType) {
    case 'docx':
    case 'doc':
      return '';
    case 'sheet':
      return 'Sheet';
    case 'bitable':
      return 'Bitable';
    case 'wiki':
      return 'Wiki';
    case 'mindnote':
      return 'Mindnote';
    case 'file':
      return 'File';
    case 'slide':
      return 'Slide';
    default:
      return '';
  }
}

/**
 * Resolve document content from a message.
 * Extracts document links and fetches their content.
 * @param {object} client
 * @param {{message_type?: string, content?: string}} message
 * @param {{maxDocsPerMessage?: number, maxTotalLength?: number, domain?: string}} [options]
 * @returns {Promise<string|null>}
 */
export async function resolveFeishuDocsFromMessage(client, message, options = {}) {
  const { maxDocsPerMessage = 3, maxTotalLength = 100000 } = options;
  const apiBase = resolveFeishuApiBase(options.domain);

  const msgType = message.message_type;
  let docRefs = [];

  try {
    const content = JSON.parse(message.content ?? '{}');

    if (msgType === 'text' && content.text) {
      // Extract from plain text
      docRefs = extractDocRefsFromText(content.text);
    } else if (msgType === 'post') {
      // Extract from rich text - handle locale wrapper
      let postData = content;
      if (content.post && typeof content.post === 'object') {
        const localeKey = Object.keys(content.post).find(
          (key) => content.post[key]?.content || content.post[key]?.title
        );
        if (localeKey) {
          postData = content.post[localeKey];
        }
      }
      docRefs = extractDocRefsFromPost(postData);
    }
    // TODO: Handle interactive (card) messages with document links
  } catch (err) {
    logger.debug(`Failed to parse message content for document extraction: ${String(err)}`);
    return null;
  }

  if (docRefs.length === 0) {
    return null;
  }

  // Limit number of documents to process
  const refsToProcess = docRefs.slice(0, maxDocsPerMessage);

  logger.debug(`Found ${docRefs.length} document(s), processing ${refsToProcess.length}`);

  const contents = [];
  let totalLength = 0;

  for (const ref of refsToProcess) {
    const result = await fetchFeishuDocContent(client, ref, {
      maxLength: Math.min(50000, maxTotalLength - totalLength),
      apiBase
    });

    if (result) {
      contents.push(result.content);
      totalLength += result.content.length;

      if (totalLength >= maxTotalLength) {
        break;
      }
    }
  }

  if (contents.length === 0) {
    return null;
  }

  return contents.join('\n\n---\n\n');
}
