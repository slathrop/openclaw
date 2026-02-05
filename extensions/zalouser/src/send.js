import { runZca } from './zca.js';
async function sendMessageZalouser(threadId, text, options = {}) {
  const profile = options.profile || process.env.ZCA_PROFILE || 'default';
  if (!threadId?.trim()) {
    return { ok: false, error: 'No threadId provided' };
  }
  if (options.mediaUrl) {
    return sendMediaZalouser(threadId, options.mediaUrl, {
      ...options,
      caption: text || options.caption
    });
  }
  const args = ['msg', 'send', threadId.trim(), text.slice(0, 2e3)];
  if (options.isGroup) {
    args.push('-g');
  }
  try {
    const result = await runZca(args, { profile });
    if (result.ok) {
      return { ok: true, messageId: extractMessageId(result.stdout) };
    }
    return { ok: false, error: result.stderr || 'Failed to send message' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function sendMediaZalouser(threadId, mediaUrl, options = {}) {
  const profile = options.profile || process.env.ZCA_PROFILE || 'default';
  if (!threadId?.trim()) {
    return { ok: false, error: 'No threadId provided' };
  }
  if (!mediaUrl?.trim()) {
    return { ok: false, error: 'No media URL provided' };
  }
  const lowerUrl = mediaUrl.toLowerCase();
  let command;
  if (lowerUrl.match(/\.(mp4|mov|avi|webm)$/)) {
    command = 'video';
  } else if (lowerUrl.match(/\.(mp3|wav|ogg|m4a)$/)) {
    command = 'voice';
  } else {
    command = 'image';
  }
  const args = ['msg', command, threadId.trim(), '-u', mediaUrl.trim()];
  if (options.caption) {
    args.push('-m', options.caption.slice(0, 2e3));
  }
  if (options.isGroup) {
    args.push('-g');
  }
  try {
    const result = await runZca(args, { profile });
    if (result.ok) {
      return { ok: true, messageId: extractMessageId(result.stdout) };
    }
    return { ok: false, error: result.stderr || `Failed to send ${command}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function sendImageZalouser(threadId, imageUrl, options = {}) {
  const profile = options.profile || process.env.ZCA_PROFILE || 'default';
  const args = ['msg', 'image', threadId.trim(), '-u', imageUrl.trim()];
  if (options.caption) {
    args.push('-m', options.caption.slice(0, 2e3));
  }
  if (options.isGroup) {
    args.push('-g');
  }
  try {
    const result = await runZca(args, { profile });
    if (result.ok) {
      return { ok: true, messageId: extractMessageId(result.stdout) };
    }
    return { ok: false, error: result.stderr || 'Failed to send image' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function sendLinkZalouser(threadId, url, options = {}) {
  const profile = options.profile || process.env.ZCA_PROFILE || 'default';
  const args = ['msg', 'link', threadId.trim(), url.trim()];
  if (options.isGroup) {
    args.push('-g');
  }
  try {
    const result = await runZca(args, { profile });
    if (result.ok) {
      return { ok: true, messageId: extractMessageId(result.stdout) };
    }
    return { ok: false, error: result.stderr || 'Failed to send link' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
function extractMessageId(stdout) {
  const match = stdout.match(/message[_\s]?id[:\s]+(\S+)/i);
  if (match) {
    return match[1];
  }
  const firstWord = stdout.trim().split(/\s+/)[0];
  if (firstWord && /^[a-zA-Z0-9_-]+$/.test(firstWord)) {
    return firstWord;
  }
  return void 0;
}
export {
  sendImageZalouser,
  sendLinkZalouser,
  sendMessageZalouser
};
