/**
 * Image extraction and processing for Pi embedded runner payloads.
 * @module agents/pi-embedded-runner/run/images
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTextFromMessage } from '../../../tui/tui-formatters.js';
import { resolveUserPath } from '../../../utils.js';
import { loadWebMedia } from '../../../web/media.js';
import { assertSandboxPath } from '../../sandbox-paths.js';
import { sanitizeImageBlocks } from '../../tool-images.js';
import { log } from '../logger.js';
const IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.heic',
  '.heif'
]);
function isImageExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
async function sanitizeImagesWithLog(images, label) {
  const { images: sanitized, dropped } = await sanitizeImageBlocks(images, label);
  if (dropped > 0) {
    log.warn(`Native image: dropped ${dropped} image(s) after sanitization (${label}).`);
  }
  return sanitized;
}
function detectImageReferences(prompt) {
  const refs = [];
  const seen = /* @__PURE__ */ new Set();
  const addPathRef = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) {
      return;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return;
    }
    if (!isImageExtension(trimmed)) {
      return;
    }
    seen.add(trimmed.toLowerCase());
    const resolved = trimmed.startsWith('~') ? resolveUserPath(trimmed) : trimmed;
    refs.push({ raw: trimmed, type: 'path', resolved });
  };
  const mediaAttachedPattern = /\[media attached(?:\s+\d+\/\d+)?:\s*([^\]]+)\]/gi;
  let match;
  while ((match = mediaAttachedPattern.exec(prompt)) !== null) {
    const content = match[1];
    if (/^\d+\s+files?$/i.test(content.trim())) {
      continue;
    }
    const pathMatch = content.match(
      /^\s*(.+?\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|heif))\s*(?:\(|$|\|)/i
    );
    if (pathMatch?.[1]) {
      addPathRef(pathMatch[1].trim());
    }
  }
  const messageImagePattern = /\[Image:\s*source:\s*([^\]]+\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|heif))\]/gi;
  while ((match = messageImagePattern.exec(prompt)) !== null) {
    const raw = match[1]?.trim();
    if (raw) {
      addPathRef(raw);
    }
  }
  const fileUrlPattern = /file:\/\/[^\s<>"'`\]]+\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|heif)/gi;
  while ((match = fileUrlPattern.exec(prompt)) !== null) {
    const raw = match[0];
    if (seen.has(raw.toLowerCase())) {
      continue;
    }
    seen.add(raw.toLowerCase());
    try {
      const resolved = fileURLToPath(raw);
      refs.push({ raw, type: 'path', resolved });
    } catch {
      // intentionally ignored
    }
  }
  const pathPattern = /(?:^|\s|["'`(])((\.\.?\/|[~/])[^\s"'`()[\]]*\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|heif))/gi;
  while ((match = pathPattern.exec(prompt)) !== null) {
    if (match[1]) {
      addPathRef(match[1]);
    }
  }
  return refs;
}
async function loadImageFromRef(ref, workspaceDir, options) {
  try {
    let targetPath = ref.resolved;
    if (ref.type === 'url') {
      log.debug(`Native image: rejecting remote URL (local-only): ${ref.resolved}`);
      return null;
    }
    if (ref.type === 'path' && !path.isAbsolute(targetPath)) {
      const resolveRoot = options?.sandboxRoot ?? workspaceDir;
      targetPath = path.resolve(resolveRoot, targetPath);
    }
    if (ref.type === 'path' && options?.sandboxRoot) {
      try {
        const validated = await assertSandboxPath({
          filePath: targetPath,
          cwd: options.sandboxRoot,
          root: options.sandboxRoot
        });
        targetPath = validated.resolved;
      } catch (err) {
        log.debug(
          `Native image: sandbox validation failed for ${ref.resolved}: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
      }
    }
    if (ref.type === 'path') {
      try {
        await fs.stat(targetPath);
      } catch {
        log.debug(`Native image: file not found: ${targetPath}`);
        return null;
      }
    }
    const media = await loadWebMedia(targetPath, options?.maxBytes);
    if (media.kind !== 'image') {
      log.debug(`Native image: not an image file: ${targetPath} (got ${media.kind})`);
      return null;
    }
    const mimeType = media.contentType ?? 'image/jpeg';
    const data = media.buffer.toString('base64');
    return { type: 'image', data, mimeType };
  } catch (err) {
    log.debug(
      `Native image: failed to load ${ref.resolved}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}
function modelSupportsImages(model) {
  return model.input?.includes('image') ?? false;
}
function detectImagesFromHistory(messages) {
  const allRefs = [];
  const seen = /* @__PURE__ */ new Set();
  const messageHasImageContent = (msg) => {
    if (!msg || typeof msg !== 'object') {
      return false;
    }
    const content = msg.content;
    if (!Array.isArray(content)) {
      return false;
    }
    return content.some(
      (part) => part !== null && part !== undefined && typeof part === 'object' && part.type === 'image'
    );
  };
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== 'object') {
      continue;
    }
    const message = msg;
    if (message.role !== 'user') {
      continue;
    }
    if (messageHasImageContent(msg)) {
      continue;
    }
    const text = extractTextFromMessage(msg);
    if (!text) {
      continue;
    }
    const refs = detectImageReferences(text);
    for (const ref of refs) {
      const key = ref.resolved.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      allRefs.push({ ...ref, messageIndex: i });
    }
  }
  return allRefs;
}
async function detectAndLoadPromptImages(params) {
  if (!modelSupportsImages(params.model)) {
    return {
      images: [],
      historyImagesByIndex: /* @__PURE__ */ new Map(),
      detectedRefs: [],
      loadedCount: 0,
      skippedCount: 0
    };
  }
  const promptRefs = detectImageReferences(params.prompt);
  const historyRefs = params.historyMessages ? detectImagesFromHistory(params.historyMessages) : [];
  const seenPaths = new Set(promptRefs.map((r) => r.resolved.toLowerCase()));
  const uniqueHistoryRefs = historyRefs.filter((r) => !seenPaths.has(r.resolved.toLowerCase()));
  const allRefs = [...promptRefs, ...uniqueHistoryRefs];
  if (allRefs.length === 0) {
    return {
      images: params.existingImages ?? [],
      historyImagesByIndex: /* @__PURE__ */ new Map(),
      detectedRefs: [],
      loadedCount: 0,
      skippedCount: 0
    };
  }
  log.debug(
    `Native image: detected ${allRefs.length} image refs (${promptRefs.length} in prompt, ${uniqueHistoryRefs.length} in history)`
  );
  const promptImages = [...params.existingImages ?? []];
  const historyImagesByIndex = /* @__PURE__ */ new Map();
  let loadedCount = 0;
  let skippedCount = 0;
  for (const ref of allRefs) {
    const image = await loadImageFromRef(ref, params.workspaceDir, {
      maxBytes: params.maxBytes,
      sandboxRoot: params.sandboxRoot
    });
    if (image) {
      if (ref.messageIndex !== void 0) {
        const existing = historyImagesByIndex.get(ref.messageIndex);
        if (existing) {
          existing.push(image);
        } else {
          historyImagesByIndex.set(ref.messageIndex, [image]);
        }
      } else {
        promptImages.push(image);
      }
      loadedCount++;
      log.debug(`Native image: loaded ${ref.type} ${ref.resolved}`);
    } else {
      skippedCount++;
    }
  }
  const sanitizedPromptImages = await sanitizeImagesWithLog(promptImages, 'prompt:images');
  const sanitizedHistoryImagesByIndex = /* @__PURE__ */ new Map();
  for (const [index, images] of historyImagesByIndex) {
    const sanitized = await sanitizeImagesWithLog(images, `history:images:${index}`);
    if (sanitized.length > 0) {
      sanitizedHistoryImagesByIndex.set(index, sanitized);
    }
  }
  return {
    images: sanitizedPromptImages,
    historyImagesByIndex: sanitizedHistoryImagesByIndex,
    detectedRefs: allRefs,
    loadedCount,
    skippedCount
  };
}
export {
  detectAndLoadPromptImages,
  detectImageReferences,
  loadImageFromRef,
  modelSupportsImages
};
