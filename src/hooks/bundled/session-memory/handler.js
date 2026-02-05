import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAgentWorkspaceDir } from '../../../agents/agent-scope.js';
import { resolveAgentIdFromSessionKey } from '../../../routing/session-key.js';
import { resolveHookConfig } from '../../config.js';
async function getRecentSessionContent(sessionFilePath, messageCount = 15) {
  try {
    const content = await fs.readFile(sessionFilePath, 'utf-8');
    const lines = content.trim().split('\n');
    const allMessages = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'message' && entry.message) {
          const msg = entry.message;
          const role = msg.role;
          if ((role === 'user' || role === 'assistant') && msg.content) {
            const text = Array.isArray(msg.content) ? (
              // oxlint-disable-next-line typescript/no-explicit-any
              msg.content.find((c) => c.type === 'text')?.text
            ) : msg.content;
            if (text && !text.startsWith('/')) {
              allMessages.push(`${role}: ${text}`);
            }
          }
        }
      } catch {
        // Intentionally ignored
      }
    }
    const recentMessages = allMessages.slice(-messageCount);
    return recentMessages.join('\n');
  } catch {
    return null;
  }
}
const saveSessionToMemory = async (event) => {
  if (event.type !== 'command' || event.action !== 'new') {
    return;
  }
  try {
    console.log('[session-memory] Hook triggered for /new command');
    const context = event.context || {};
    const cfg = context.cfg;
    const agentId = resolveAgentIdFromSessionKey(event.sessionKey);
    const workspaceDir = cfg ? resolveAgentWorkspaceDir(cfg, agentId) : path.join(os.homedir(), '.openclaw', 'workspace');
    const memoryDir = path.join(workspaceDir, 'memory');
    await fs.mkdir(memoryDir, { recursive: true });
    const now = new Date(event.timestamp);
    const dateStr = now.toISOString().split('T')[0];
    const sessionEntry = context.previousSessionEntry || context.sessionEntry || {};
    const currentSessionId = sessionEntry.sessionId;
    const currentSessionFile = sessionEntry.sessionFile;
    console.log('[session-memory] Current sessionId:', currentSessionId);
    console.log('[session-memory] Current sessionFile:', currentSessionFile);
    console.log('[session-memory] cfg present:', !!cfg);
    const sessionFile = currentSessionFile || void 0;
    const hookConfig = resolveHookConfig(cfg, 'session-memory');
    const messageCount = typeof hookConfig?.messages === 'number' && hookConfig.messages > 0 ? hookConfig.messages : 15;
    let slug = null;
    let sessionContent = null;
    if (sessionFile) {
      sessionContent = await getRecentSessionContent(sessionFile, messageCount);
      console.log('[session-memory] sessionContent length:', sessionContent?.length || 0);
      if (sessionContent && cfg) {
        console.log('[session-memory] Calling generateSlugViaLLM...');
        const openclawRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
        const slugGenPath = path.join(openclawRoot, 'llm-slug-generator.js');
        const { generateSlugViaLLM } = await import(slugGenPath);
        slug = await generateSlugViaLLM({ sessionContent, cfg });
        console.log('[session-memory] Generated slug:', slug);
      }
    }
    if (!slug) {
      const timeSlug = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
      slug = timeSlug.slice(0, 4);
      console.log('[session-memory] Using fallback timestamp slug:', slug);
    }
    const filename = `${dateStr}-${slug}.md`;
    const memoryFilePath = path.join(memoryDir, filename);
    console.log('[session-memory] Generated filename:', filename);
    console.log('[session-memory] Full path:', memoryFilePath);
    const timeStr = now.toISOString().split('T')[1].split('.')[0];
    const sessionId = sessionEntry.sessionId || 'unknown';
    const source = context.commandSource || 'unknown';
    const entryParts = [
      `# Session: ${dateStr} ${timeStr} UTC`,
      '',
      `- **Session Key**: ${event.sessionKey}`,
      `- **Session ID**: ${sessionId}`,
      `- **Source**: ${source}`,
      ''
    ];
    if (sessionContent) {
      entryParts.push('## Conversation Summary', '', sessionContent, '');
    }
    const entry = entryParts.join('\n');
    await fs.writeFile(memoryFilePath, entry, 'utf-8');
    console.log('[session-memory] Memory file written successfully');
    const relPath = memoryFilePath.replace(os.homedir(), '~');
    console.log(`[session-memory] Session context saved to ${relPath}`);
  } catch (err) {
    console.error(
      '[session-memory] Failed to save session memory:',
      err instanceof Error ? err.message : String(err)
    );
  }
};
const stdin_default = saveSessionToMemory;
export {
  stdin_default as default
};
