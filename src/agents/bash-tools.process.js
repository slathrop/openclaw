/**
 * @module bash-tools.process
 * Bash process tool -- background/long-running command management.
 * @typedef {object} ProcessToolDefaults - Default options for process tool.
 * @property
 */

import { Type } from '@sinclair/typebox';
import {
  deleteSession,
  drainSession,
  getFinishedSession,
  getSession,
  listFinishedSessions,
  listRunningSessions,
  markExited,
  setJobTtlMs
} from './bash-process-registry.js';
import {
  deriveSessionName,
  formatDuration,
  killSession,
  pad,
  sliceLogLines,
  truncateMiddle
} from './bash-tools.shared.js';
import { encodeKeySequence, encodePaste } from './pty-keys.js';
const processSchema = Type.Object({
  action: Type.String({ description: 'Process action' }),
  sessionId: Type.Optional(Type.String({ description: 'Session id for actions other than list' })),
  data: Type.Optional(Type.String({ description: 'Data to write for write' })),
  keys: Type.Optional(
    Type.Array(Type.String(), { description: 'Key tokens to send for send-keys' })
  ),
  hex: Type.Optional(Type.Array(Type.String(), { description: 'Hex bytes to send for send-keys' })),
  literal: Type.Optional(Type.String({ description: 'Literal string for send-keys' })),
  text: Type.Optional(Type.String({ description: 'Text to paste for paste' })),
  bracketed: Type.Optional(Type.Boolean({ description: 'Wrap paste in bracketed mode' })),
  eof: Type.Optional(Type.Boolean({ description: 'Close stdin after write' })),
  offset: Type.Optional(Type.Number({ description: 'Log offset' })),
  limit: Type.Optional(Type.Number({ description: 'Log length' }))
});
function createProcessTool(defaults) {
  if (defaults?.cleanupMs !== void 0) {
    setJobTtlMs(defaults.cleanupMs);
  }
  const scopeKey = defaults?.scopeKey;
  const isInScope = (session) => !scopeKey || session?.scopeKey === scopeKey;
  return {
    name: 'process',
    label: 'process',
    description: 'Manage running exec sessions: list, poll, log, write, send-keys, submit, paste, kill.',
    parameters: processSchema,
    execute: async (_toolCallId, args) => {
      const params = args;
      if (params.action === 'list') {
        const running = listRunningSessions().filter((s) => isInScope(s)).map((s) => ({
          sessionId: s.id,
          status: 'running',
          pid: s.pid ?? void 0,
          startedAt: s.startedAt,
          runtimeMs: Date.now() - s.startedAt,
          cwd: s.cwd,
          command: s.command,
          name: deriveSessionName(s.command),
          tail: s.tail,
          truncated: s.truncated
        }));
        const finished2 = listFinishedSessions().filter((s) => isInScope(s)).map((s) => ({
          sessionId: s.id,
          status: s.status,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          runtimeMs: s.endedAt - s.startedAt,
          cwd: s.cwd,
          command: s.command,
          name: deriveSessionName(s.command),
          tail: s.tail,
          truncated: s.truncated,
          exitCode: s.exitCode ?? void 0,
          exitSignal: s.exitSignal ?? void 0
        }));
        const lines = [...running, ...finished2].toSorted((a, b) => b.startedAt - a.startedAt).map((s) => {
          const label = s.name ? truncateMiddle(s.name, 80) : truncateMiddle(s.command, 120);
          return `${s.sessionId} ${pad(s.status, 9)} ${formatDuration(s.runtimeMs)} :: ${label}`;
        });
        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n') || 'No running or recent sessions.'
            }
          ],
          details: { status: 'completed', sessions: [...running, ...finished2] }
        };
      }
      if (!params.sessionId) {
        return {
          content: [{ type: 'text', text: 'sessionId is required for this action.' }],
          details: { status: 'failed' }
        };
      }
      const session = getSession(params.sessionId);
      const finished = getFinishedSession(params.sessionId);
      const scopedSession = isInScope(session) ? session : void 0;
      const scopedFinished = isInScope(finished) ? finished : void 0;
      switch (params.action) {
        case 'poll': {
          if (!scopedSession) {
            if (scopedFinished) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `${scopedFinished.tail || `(no output recorded${scopedFinished.truncated ? ' \u2014 truncated to cap' : ''})`  }

Process exited with ${scopedFinished.exitSignal ? `signal ${scopedFinished.exitSignal}` : `code ${scopedFinished.exitCode ?? 0}`}.`
                  }
                ],
                details: {
                  status: scopedFinished.status === 'completed' ? 'completed' : 'failed',
                  sessionId: params.sessionId,
                  exitCode: scopedFinished.exitCode ?? void 0,
                  aggregated: scopedFinished.aggregated,
                  name: deriveSessionName(scopedFinished.command)
                }
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `No session found for ${params.sessionId}`
                }
              ],
              details: { status: 'failed' }
            };
          }
          if (!scopedSession.backgrounded) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} is not backgrounded.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          const { stdout, stderr } = drainSession(scopedSession);
          const exited = scopedSession.exited;
          const exitCode = scopedSession.exitCode ?? 0;
          const exitSignal = scopedSession.exitSignal ?? void 0;
          if (exited) {
            const status2 = exitCode === 0 && exitSignal === null || exitSignal === undefined ? 'completed' : 'failed';
            markExited(
              scopedSession,
              scopedSession.exitCode ?? null,
              scopedSession.exitSignal ?? null,
              status2
            );
          }
          const status = exited ? exitCode === 0 && exitSignal === null || exitSignal === undefined ? 'completed' : 'failed' : 'running';
          const output = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join('\n').trim();
          return {
            content: [
              {
                type: 'text',
                text: (output || '(no new output)') + (exited ? `

Process exited with ${exitSignal ? `signal ${exitSignal}` : `code ${exitCode}`}.` : '\n\nProcess still running.')
              }
            ],
            details: {
              status,
              sessionId: params.sessionId,
              exitCode: exited ? exitCode : void 0,
              aggregated: scopedSession.aggregated,
              name: deriveSessionName(scopedSession.command)
            }
          };
        }
        case 'log': {
          if (scopedSession) {
            if (!scopedSession.backgrounded) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Session ${params.sessionId} is not backgrounded.`
                  }
                ],
                details: { status: 'failed' }
              };
            }
            const { slice, totalLines, totalChars } = sliceLogLines(
              scopedSession.aggregated,
              params.offset,
              params.limit
            );
            return {
              content: [{ type: 'text', text: slice || '(no output yet)' }],
              details: {
                status: scopedSession.exited ? 'completed' : 'running',
                sessionId: params.sessionId,
                total: totalLines,
                totalLines,
                totalChars,
                truncated: scopedSession.truncated,
                name: deriveSessionName(scopedSession.command)
              }
            };
          }
          if (scopedFinished) {
            const { slice, totalLines, totalChars } = sliceLogLines(
              scopedFinished.aggregated,
              params.offset,
              params.limit
            );
            const status = scopedFinished.status === 'completed' ? 'completed' : 'failed';
            return {
              content: [{ type: 'text', text: slice || '(no output recorded)' }],
              details: {
                status,
                sessionId: params.sessionId,
                total: totalLines,
                totalLines,
                totalChars,
                truncated: scopedFinished.truncated,
                exitCode: scopedFinished.exitCode ?? void 0,
                exitSignal: scopedFinished.exitSignal ?? void 0,
                name: deriveSessionName(scopedFinished.command)
              }
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `No session found for ${params.sessionId}`
              }
            ],
            details: { status: 'failed' }
          };
        }
        case 'write': {
          if (!scopedSession) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No active session found for ${params.sessionId}`
                }
              ],
              details: { status: 'failed' }
            };
          }
          if (!scopedSession.backgrounded) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} is not backgrounded.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          const stdin = scopedSession.stdin ?? scopedSession.child?.stdin;
          if (!stdin || stdin.destroyed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} stdin is not writable.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          await new Promise((resolve, reject) => {
            stdin.write(params.data ?? '', (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
          if (params.eof) {
            stdin.end();
          }
          return {
            content: [
              {
                type: 'text',
                text: `Wrote ${(params.data ?? '').length} bytes to session ${params.sessionId}${params.eof ? ' (stdin closed)' : ''}.`
              }
            ],
            details: {
              status: 'running',
              sessionId: params.sessionId,
              name: scopedSession ? deriveSessionName(scopedSession.command) : void 0
            }
          };
        }
        case 'send-keys': {
          if (!scopedSession) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No active session found for ${params.sessionId}`
                }
              ],
              details: { status: 'failed' }
            };
          }
          if (!scopedSession.backgrounded) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} is not backgrounded.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          const stdin = scopedSession.stdin ?? scopedSession.child?.stdin;
          if (!stdin || stdin.destroyed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} stdin is not writable.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          const { data, warnings } = encodeKeySequence({
            keys: params.keys,
            hex: params.hex,
            literal: params.literal
          });
          if (!data) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No key data provided.'
                }
              ],
              details: { status: 'failed' }
            };
          }
          await new Promise((resolve, reject) => {
            stdin.write(data, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
          return {
            content: [
              {
                type: 'text',
                text: `Sent ${data.length} bytes to session ${params.sessionId}.${  warnings.length ? `
Warnings:
- ${warnings.join('\n- ')}` : ''}`
              }
            ],
            details: {
              status: 'running',
              sessionId: params.sessionId,
              name: scopedSession ? deriveSessionName(scopedSession.command) : void 0
            }
          };
        }
        case 'submit': {
          if (!scopedSession) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No active session found for ${params.sessionId}`
                }
              ],
              details: { status: 'failed' }
            };
          }
          if (!scopedSession.backgrounded) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} is not backgrounded.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          const stdin = scopedSession.stdin ?? scopedSession.child?.stdin;
          if (!stdin || stdin.destroyed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} stdin is not writable.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          await new Promise((resolve, reject) => {
            stdin.write('\r', (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
          return {
            content: [
              {
                type: 'text',
                text: `Submitted session ${params.sessionId} (sent CR).`
              }
            ],
            details: {
              status: 'running',
              sessionId: params.sessionId,
              name: scopedSession ? deriveSessionName(scopedSession.command) : void 0
            }
          };
        }
        case 'paste': {
          if (!scopedSession) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No active session found for ${params.sessionId}`
                }
              ],
              details: { status: 'failed' }
            };
          }
          if (!scopedSession.backgrounded) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} is not backgrounded.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          const stdin = scopedSession.stdin ?? scopedSession.child?.stdin;
          if (!stdin || stdin.destroyed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} stdin is not writable.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          const payload = encodePaste(params.text ?? '', params.bracketed !== false);
          if (!payload) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No paste text provided.'
                }
              ],
              details: { status: 'failed' }
            };
          }
          await new Promise((resolve, reject) => {
            stdin.write(payload, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
          return {
            content: [
              {
                type: 'text',
                text: `Pasted ${params.text?.length ?? 0} chars to session ${params.sessionId}.`
              }
            ],
            details: {
              status: 'running',
              sessionId: params.sessionId,
              name: scopedSession ? deriveSessionName(scopedSession.command) : void 0
            }
          };
        }
        case 'kill': {
          if (!scopedSession) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No active session found for ${params.sessionId}`
                }
              ],
              details: { status: 'failed' }
            };
          }
          if (!scopedSession.backgrounded) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Session ${params.sessionId} is not backgrounded.`
                }
              ],
              details: { status: 'failed' }
            };
          }
          killSession(scopedSession);
          markExited(scopedSession, null, 'SIGKILL', 'failed');
          return {
            content: [{ type: 'text', text: `Killed session ${params.sessionId}.` }],
            details: {
              status: 'failed',
              name: scopedSession ? deriveSessionName(scopedSession.command) : void 0
            }
          };
        }
        case 'clear': {
          if (scopedFinished) {
            deleteSession(params.sessionId);
            return {
              content: [{ type: 'text', text: `Cleared session ${params.sessionId}.` }],
              details: { status: 'completed' }
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `No finished session found for ${params.sessionId}`
              }
            ],
            details: { status: 'failed' }
          };
        }
        case 'remove': {
          if (scopedSession) {
            killSession(scopedSession);
            markExited(scopedSession, null, 'SIGKILL', 'failed');
            return {
              content: [{ type: 'text', text: `Removed session ${params.sessionId}.` }],
              details: {
                status: 'failed',
                name: scopedSession ? deriveSessionName(scopedSession.command) : void 0
              }
            };
          }
          if (scopedFinished) {
            deleteSession(params.sessionId);
            return {
              content: [{ type: 'text', text: `Removed session ${params.sessionId}.` }],
              details: { status: 'completed' }
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `No session found for ${params.sessionId}`
              }
            ],
            details: { status: 'failed' }
          };
        }
      }
      return {
        content: [{ type: 'text', text: `Unknown action ${params.action}` }],
        details: { status: 'failed' }
      };
    }
  };
}
const processTool = createProcessTool();
export {
  createProcessTool,
  processTool
};
