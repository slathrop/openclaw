/**
 * @module sessions/transcript
 * Session transcript file management and assistant message mirroring.
 */
import {CURRENT_SESSION_VERSION, SessionManager} from '@mariozechner/pi-coding-agent';
import fs from 'node:fs';
import path from 'node:path';
import {emitSessionTranscriptUpdate} from '../../sessions/transcript-events.js';
import {resolveDefaultSessionStorePath, resolveSessionTranscriptPath} from './paths.js';
import {loadSessionStore, updateSessionStore} from './store.js';

/**
 * @param {string} value
 * @returns {string}
 */
function stripQuery(value) {
  const noHash = value.split('#')[0] ?? value;
  return noHash.split('?')[0] ?? noHash;
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function extractFileNameFromMediaUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = stripQuery(trimmed);
  try {
    const parsed = new URL(cleaned);
    const base = path.basename(parsed.pathname);
    if (!base) {
      return null;
    }
    try {
      return decodeURIComponent(base);
    } catch {
      return base;
    }
  } catch {
    const base = path.basename(cleaned);
    if (!base || base === '/' || base === '.') {
      return null;
    }
    return base;
  }
}

/**
 * Resolves the display text for a mirrored transcript entry.
 * @param {{ text?: string, mediaUrls?: string[] }} params
 * @returns {string | null}
 */
export function resolveMirroredTranscriptText(params) {
  const mediaUrls = params.mediaUrls?.filter((url) => url && url.trim()) ?? [];
  if (mediaUrls.length > 0) {
    const names = mediaUrls
      .map((url) => extractFileNameFromMediaUrl(url))
      .filter((name) => Boolean(name && name.trim()));
    if (names.length > 0) {
      return names.join(', ');
    }
    return 'media';
  }

  const text = params.text ?? '';
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

/**
 * @param {{ sessionFile: string, sessionId: string }} params
 * @returns {Promise<void>}
 */
async function ensureSessionHeader(params) {
  if (fs.existsSync(params.sessionFile)) {
    return;
  }
  await fs.promises.mkdir(path.dirname(params.sessionFile), {recursive: true});
  const header = {
    type: 'session',
    version: CURRENT_SESSION_VERSION,
    id: params.sessionId,
    timestamp: new Date().toISOString(),
    cwd: process.cwd()
  };
  await fs.promises.writeFile(params.sessionFile, `${JSON.stringify(header)}\n`, 'utf-8');
}

/**
 * Appends an assistant message to a session transcript file.
 * @param {{ agentId?: string, sessionKey: string, text?: string, mediaUrls?: string[], storePath?: string }} params
 * @returns {Promise<{ ok: true, sessionFile: string } | { ok: false, reason: string }>}
 */
export async function appendAssistantMessageToSessionTranscript(params) {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    return {ok: false, reason: 'missing sessionKey'};
  }

  const mirrorText = resolveMirroredTranscriptText({
    text: params.text,
    mediaUrls: params.mediaUrls
  });
  if (!mirrorText) {
    return {ok: false, reason: 'empty text'};
  }

  const storePath = params.storePath ?? resolveDefaultSessionStorePath(params.agentId);
  const store = loadSessionStore(storePath, {skipCache: true});
  const entry = store[sessionKey];
  if (!entry?.sessionId) {
    return {ok: false, reason: `unknown sessionKey: ${sessionKey}`};
  }

  const sessionFile =
    entry.sessionFile?.trim() || resolveSessionTranscriptPath(entry.sessionId, params.agentId);

  await ensureSessionHeader({sessionFile, sessionId: entry.sessionId});

  const sessionManager = SessionManager.open(sessionFile);
  sessionManager.appendMessage({
    role: 'assistant',
    content: [{type: 'text', text: mirrorText}],
    api: 'openai-responses',
    provider: 'openclaw',
    model: 'delivery-mirror',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      }
    },
    stopReason: 'stop',
    timestamp: Date.now()
  });

  if (!entry.sessionFile || entry.sessionFile !== sessionFile) {
    await updateSessionStore(storePath, (current) => {
      current[sessionKey] = {
        ...entry,
        sessionFile
      };
    });
  }

  emitSessionTranscriptUpdate(sessionFile);
  return {ok: true, sessionFile};
}
