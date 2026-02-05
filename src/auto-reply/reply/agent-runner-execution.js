import crypto from 'node:crypto';
import fs from 'node:fs';
import { resolveAgentModelFallbacksOverride } from '../../agents/agent-scope.js';
import { runCliAgent } from '../../agents/cli-runner.js';
import { getCliSessionId } from '../../agents/cli-session.js';
import { runWithModelFallback } from '../../agents/model-fallback.js';
import { isCliProvider } from '../../agents/model-selection.js';
import {
  isCompactionFailureError,
  isContextOverflowError,
  isLikelyContextOverflowError,
  sanitizeUserFacingText
} from '../../agents/pi-embedded-helpers.js';
import { runEmbeddedPiAgent } from '../../agents/pi-embedded.js';
import {
  resolveAgentIdFromSessionKey,
  resolveGroupSessionKey,
  resolveSessionTranscriptPath,
  updateSessionStore
} from '../../config/sessions.js';
import { logVerbose } from '../../globals.js';
import { emitAgentEvent, registerAgentRunContext } from '../../infra/agent-events.js';
import { defaultRuntime } from '../../runtime.js';
import {
  isMarkdownCapableMessageChannel,
  resolveMessageChannel
} from '../../utils/message-channel.js';
import { stripHeartbeatToken } from '../heartbeat.js';
import { isSilentReplyText, SILENT_REPLY_TOKEN } from '../tokens.js';
import { buildThreadingToolContext, resolveEnforceFinalTag } from './agent-runner-utils.js';
import { createBlockReplyPayloadKey } from './block-reply-pipeline.js';
import { parseReplyDirectives } from './reply-directives.js';
import { applyReplyTagsToPayload, isRenderablePayload } from './reply-payloads.js';
async function runAgentTurnWithFallback(params) {
  let didLogHeartbeatStrip = false;
  let autoCompactionCompleted = false;
  const directlySentBlockKeys = /* @__PURE__ */ new Set();
  const runId = params.opts?.runId ?? crypto.randomUUID();
  params.opts?.onAgentRunStart?.(runId);
  if (params.sessionKey) {
    registerAgentRunContext(runId, {
      sessionKey: params.sessionKey,
      verboseLevel: params.resolvedVerboseLevel,
      isHeartbeat: params.isHeartbeat
    });
  }
  let runResult;
  let fallbackProvider = params.followupRun.run.provider;
  let fallbackModel = params.followupRun.run.model;
  let didResetAfterCompactionFailure = false;
  while (true) {
    try {
      const allowPartialStream = !(params.followupRun.run.reasoningLevel === 'stream' && params.opts?.onReasoningStream);
      const normalizeStreamingText = (payload) => {
        if (!allowPartialStream) {
          return { skip: true };
        }
        let text = payload.text;
        if (!params.isHeartbeat && text?.includes('HEARTBEAT_OK')) {
          const stripped = stripHeartbeatToken(text, {
            mode: 'message'
          });
          if (stripped.didStrip && !didLogHeartbeatStrip) {
            didLogHeartbeatStrip = true;
            logVerbose('Stripped stray HEARTBEAT_OK token from reply');
          }
          if (stripped.shouldSkip && (payload.mediaUrls?.length ?? 0) === 0) {
            return { skip: true };
          }
          text = stripped.text;
        }
        if (isSilentReplyText(text, SILENT_REPLY_TOKEN)) {
          return { skip: true };
        }
        if (!text) {
          return { skip: true };
        }
        const sanitized = sanitizeUserFacingText(text);
        if (!sanitized.trim()) {
          return { skip: true };
        }
        return { text: sanitized, skip: false };
      };
      const handlePartialForTyping = async (payload) => {
        const { text, skip } = normalizeStreamingText(payload);
        if (skip || !text) {
          return void 0;
        }
        await params.typingSignals.signalTextDelta(text);
        return text;
      };
      const blockReplyPipeline = params.blockReplyPipeline;
      const onToolResult = params.opts?.onToolResult;
      const fallbackResult = await runWithModelFallback({
        cfg: params.followupRun.run.config,
        provider: params.followupRun.run.provider,
        model: params.followupRun.run.model,
        agentDir: params.followupRun.run.agentDir,
        fallbacksOverride: resolveAgentModelFallbacksOverride(
          params.followupRun.run.config,
          resolveAgentIdFromSessionKey(params.followupRun.run.sessionKey)
        ),
        run: (provider, model) => {
          params.opts?.onModelSelected?.({
            provider,
            model,
            thinkLevel: params.followupRun.run.thinkLevel
          });
          if (isCliProvider(provider, params.followupRun.run.config)) {
            const startedAt = Date.now();
            emitAgentEvent({
              runId,
              stream: 'lifecycle',
              data: {
                phase: 'start',
                startedAt
              }
            });
            const cliSessionId = getCliSessionId(params.getActiveSessionEntry(), provider);
            return (async () => {
              let lifecycleTerminalEmitted = false;
              try {
                const result = await runCliAgent({
                  sessionId: params.followupRun.run.sessionId,
                  sessionKey: params.sessionKey,
                  sessionFile: params.followupRun.run.sessionFile,
                  workspaceDir: params.followupRun.run.workspaceDir,
                  config: params.followupRun.run.config,
                  prompt: params.commandBody,
                  provider,
                  model,
                  thinkLevel: params.followupRun.run.thinkLevel,
                  timeoutMs: params.followupRun.run.timeoutMs,
                  runId,
                  extraSystemPrompt: params.followupRun.run.extraSystemPrompt,
                  ownerNumbers: params.followupRun.run.ownerNumbers,
                  cliSessionId,
                  images: params.opts?.images
                });
                const cliText = result.payloads?.[0]?.text?.trim();
                if (cliText) {
                  emitAgentEvent({
                    runId,
                    stream: 'assistant',
                    data: { text: cliText }
                  });
                }
                emitAgentEvent({
                  runId,
                  stream: 'lifecycle',
                  data: {
                    phase: 'end',
                    startedAt,
                    endedAt: Date.now()
                  }
                });
                lifecycleTerminalEmitted = true;
                return result;
              } catch (err) {
                emitAgentEvent({
                  runId,
                  stream: 'lifecycle',
                  data: {
                    phase: 'error',
                    startedAt,
                    endedAt: Date.now(),
                    error: String(err)
                  }
                });
                lifecycleTerminalEmitted = true;
                throw err;
              } finally {
                if (!lifecycleTerminalEmitted) {
                  emitAgentEvent({
                    runId,
                    stream: 'lifecycle',
                    data: {
                      phase: 'error',
                      startedAt,
                      endedAt: Date.now(),
                      error: 'CLI run completed without lifecycle terminal event'
                    }
                  });
                }
              }
            })();
          }
          const authProfileId = provider === params.followupRun.run.provider ? params.followupRun.run.authProfileId : void 0;
          return runEmbeddedPiAgent({
            sessionId: params.followupRun.run.sessionId,
            sessionKey: params.sessionKey,
            messageProvider: params.sessionCtx.Provider?.trim().toLowerCase() || void 0,
            agentAccountId: params.sessionCtx.AccountId,
            messageTo: params.sessionCtx.OriginatingTo ?? params.sessionCtx.To,
            messageThreadId: params.sessionCtx.MessageThreadId ?? void 0,
            groupId: resolveGroupSessionKey(params.sessionCtx)?.id,
            groupChannel: params.sessionCtx.GroupChannel?.trim() ?? params.sessionCtx.GroupSubject?.trim(),
            groupSpace: params.sessionCtx.GroupSpace?.trim() ?? void 0,
            senderId: params.sessionCtx.SenderId?.trim() || void 0,
            senderName: params.sessionCtx.SenderName?.trim() || void 0,
            senderUsername: params.sessionCtx.SenderUsername?.trim() || void 0,
            senderE164: params.sessionCtx.SenderE164?.trim() || void 0,
            // Provider threading context for tool auto-injection
            ...buildThreadingToolContext({
              sessionCtx: params.sessionCtx,
              config: params.followupRun.run.config,
              hasRepliedRef: params.opts?.hasRepliedRef
            }),
            sessionFile: params.followupRun.run.sessionFile,
            workspaceDir: params.followupRun.run.workspaceDir,
            agentDir: params.followupRun.run.agentDir,
            config: params.followupRun.run.config,
            skillsSnapshot: params.followupRun.run.skillsSnapshot,
            prompt: params.commandBody,
            extraSystemPrompt: params.followupRun.run.extraSystemPrompt,
            ownerNumbers: params.followupRun.run.ownerNumbers,
            enforceFinalTag: resolveEnforceFinalTag(params.followupRun.run, provider),
            provider,
            model,
            authProfileId,
            authProfileIdSource: authProfileId ? params.followupRun.run.authProfileIdSource : void 0,
            thinkLevel: params.followupRun.run.thinkLevel,
            verboseLevel: params.followupRun.run.verboseLevel,
            reasoningLevel: params.followupRun.run.reasoningLevel,
            execOverrides: params.followupRun.run.execOverrides,
            toolResultFormat: (() => {
              const channel = resolveMessageChannel(
                params.sessionCtx.Surface,
                params.sessionCtx.Provider
              );
              if (!channel) {
                return 'markdown';
              }
              return isMarkdownCapableMessageChannel(channel) ? 'markdown' : 'plain';
            })(),
            bashElevated: params.followupRun.run.bashElevated,
            timeoutMs: params.followupRun.run.timeoutMs,
            runId,
            images: params.opts?.images,
            abortSignal: params.opts?.abortSignal,
            blockReplyBreak: params.resolvedBlockStreamingBreak,
            blockReplyChunking: params.blockReplyChunking,
            onPartialReply: allowPartialStream ? async (payload) => {
              const textForTyping = await handlePartialForTyping(payload);
              if (!params.opts?.onPartialReply || textForTyping === void 0) {
                return;
              }
              await params.opts.onPartialReply({
                text: textForTyping,
                mediaUrls: payload.mediaUrls
              });
            } : void 0,
            onAssistantMessageStart: async () => {
              await params.typingSignals.signalMessageStart();
            },
            onReasoningStream: params.typingSignals.shouldStartOnReasoning || params.opts?.onReasoningStream ? async (payload) => {
              await params.typingSignals.signalReasoningDelta();
              await params.opts?.onReasoningStream?.({
                text: payload.text,
                mediaUrls: payload.mediaUrls
              });
            } : void 0,
            onAgentEvent: async (evt) => {
              if (evt.stream === 'tool') {
                const phase = typeof evt.data.phase === 'string' ? evt.data.phase : '';
                if (phase === 'start' || phase === 'update') {
                  await params.typingSignals.signalToolStart();
                }
              }
              if (evt.stream === 'compaction') {
                const phase = typeof evt.data.phase === 'string' ? evt.data.phase : '';
                const willRetry = Boolean(evt.data.willRetry);
                if (phase === 'end' && !willRetry) {
                  autoCompactionCompleted = true;
                }
              }
            },
            // Always pass onBlockReply so flushBlockReplyBuffer works before tool execution,
            // even when regular block streaming is disabled. The handler sends directly
            // via opts.onBlockReply when the pipeline isn't available.
            onBlockReply: params.opts?.onBlockReply ? async (payload) => {
              const { text, skip } = normalizeStreamingText(payload);
              const hasPayloadMedia = (payload.mediaUrls?.length ?? 0) > 0;
              if (skip && !hasPayloadMedia) {
                return;
              }
              const currentMessageId = params.sessionCtx.MessageSidFull ?? params.sessionCtx.MessageSid;
              const taggedPayload = applyReplyTagsToPayload(
                {
                  text,
                  mediaUrls: payload.mediaUrls,
                  mediaUrl: payload.mediaUrls?.[0],
                  replyToId: payload.replyToId,
                  replyToTag: payload.replyToTag,
                  replyToCurrent: payload.replyToCurrent
                },
                currentMessageId
              );
              if (!isRenderablePayload(taggedPayload) && !payload.audioAsVoice) {
                return;
              }
              const parsed = parseReplyDirectives(taggedPayload.text ?? '', {
                currentMessageId,
                silentToken: SILENT_REPLY_TOKEN
              });
              const cleaned = parsed.text || void 0;
              const hasRenderableMedia = Boolean(taggedPayload.mediaUrl) || (taggedPayload.mediaUrls?.length ?? 0) > 0;
              if (!cleaned && !hasRenderableMedia && !payload.audioAsVoice && !parsed.audioAsVoice) {
                return;
              }
              if (parsed.isSilent && !hasRenderableMedia) {
                return;
              }
              const blockPayload = params.applyReplyToMode({
                ...taggedPayload,
                text: cleaned,
                audioAsVoice: Boolean(parsed.audioAsVoice || payload.audioAsVoice),
                replyToId: taggedPayload.replyToId ?? parsed.replyToId,
                replyToTag: taggedPayload.replyToTag || parsed.replyToTag,
                replyToCurrent: taggedPayload.replyToCurrent || parsed.replyToCurrent
              });
              void params.typingSignals.signalTextDelta(cleaned ?? taggedPayload.text).catch((err) => {
                logVerbose(`block reply typing signal failed: ${String(err)}`);
              });
              if (params.blockStreamingEnabled && params.blockReplyPipeline) {
                params.blockReplyPipeline.enqueue(blockPayload);
              } else if (params.blockStreamingEnabled) {
                directlySentBlockKeys.add(createBlockReplyPayloadKey(blockPayload));
                await params.opts?.onBlockReply?.(blockPayload);
              }
            } : void 0,
            onBlockReplyFlush: params.blockStreamingEnabled && blockReplyPipeline ? async () => {
              await blockReplyPipeline.flush({ force: true });
            } : void 0,
            shouldEmitToolResult: params.shouldEmitToolResult,
            shouldEmitToolOutput: params.shouldEmitToolOutput,
            onToolResult: onToolResult ? (payload) => {
              const task = (async () => {
                const { text, skip } = normalizeStreamingText(payload);
                if (skip) {
                  return;
                }
                await params.typingSignals.signalTextDelta(text);
                await onToolResult({
                  text,
                  mediaUrls: payload.mediaUrls
                });
              })().catch((err) => {
                logVerbose(`tool result delivery failed: ${String(err)}`);
              }).finally(() => {
                params.pendingToolTasks.delete(task);
              });
              params.pendingToolTasks.add(task);
            } : void 0
          });
        }
      });
      runResult = fallbackResult.result;
      fallbackProvider = fallbackResult.provider;
      fallbackModel = fallbackResult.model;
      const embeddedError = runResult.meta?.error;
      if (embeddedError && isContextOverflowError(embeddedError.message) && !didResetAfterCompactionFailure && await params.resetSessionAfterCompactionFailure(embeddedError.message)) {
        didResetAfterCompactionFailure = true;
        return {
          kind: 'final',
          payload: {
            text: "\u26A0\uFE0F Context limit exceeded. I've reset our conversation to start fresh - please try again.\n\nTo prevent this, increase your compaction buffer by setting `agents.defaults.compaction.reserveTokensFloor` to 4000 or higher in your config."
          }
        };
      }
      if (embeddedError?.kind === 'role_ordering') {
        const didReset = await params.resetSessionAfterRoleOrderingConflict(embeddedError.message);
        if (didReset) {
          return {
            kind: 'final',
            payload: {
              text: "\u26A0\uFE0F Message ordering conflict. I've reset the conversation - please try again."
            }
          };
        }
      }
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isContextOverflow = isLikelyContextOverflowError(message);
      const isCompactionFailure = isCompactionFailureError(message);
      const isSessionCorruption = /function call turn comes immediately after/i.test(message);
      const isRoleOrderingError = /incorrect role information|roles must alternate/i.test(message);
      if (isCompactionFailure && !didResetAfterCompactionFailure && await params.resetSessionAfterCompactionFailure(message)) {
        didResetAfterCompactionFailure = true;
        return {
          kind: 'final',
          payload: {
            text: "\u26A0\uFE0F Context limit exceeded during compaction. I've reset our conversation to start fresh - please try again.\n\nTo prevent this, increase your compaction buffer by setting `agents.defaults.compaction.reserveTokensFloor` to 4000 or higher in your config."
          }
        };
      }
      if (isRoleOrderingError) {
        const didReset = await params.resetSessionAfterRoleOrderingConflict(message);
        if (didReset) {
          return {
            kind: 'final',
            payload: {
              text: "\u26A0\uFE0F Message ordering conflict. I've reset the conversation - please try again."
            }
          };
        }
      }
      if (isSessionCorruption && params.sessionKey && params.activeSessionStore && params.storePath) {
        const sessionKey = params.sessionKey;
        const corruptedSessionId = params.getActiveSessionEntry()?.sessionId;
        defaultRuntime.error(
          `Session history corrupted (Gemini function call ordering). Resetting session: ${params.sessionKey}`
        );
        try {
          if (corruptedSessionId) {
            const transcriptPath = resolveSessionTranscriptPath(corruptedSessionId);
            try {
              fs.unlinkSync(transcriptPath);
            } catch {
              // Intentionally ignored
            }
          }
          delete params.activeSessionStore[sessionKey];
          await updateSessionStore(params.storePath, (store) => {
            delete store[sessionKey];
          });
        } catch (cleanupErr) {
          defaultRuntime.error(
            `Failed to reset corrupted session ${params.sessionKey}: ${String(cleanupErr)}`
          );
        }
        return {
          kind: 'final',
          payload: {
            text: "\u26A0\uFE0F Session history was corrupted. I've reset the conversation - please try again!"
          }
        };
      }
      defaultRuntime.error(`Embedded agent failed before reply: ${message}`);
      const trimmedMessage = message.replace(/\.\s*$/, '');
      const fallbackText = isContextOverflow ? '\u26A0\uFE0F Context overflow \u2014 prompt too large for this model. Try a shorter message or a larger-context model.' : isRoleOrderingError ? '\u26A0\uFE0F Message ordering conflict - please try again. If this persists, use /new to start a fresh session.' : `\u26A0\uFE0F Agent failed before reply: ${trimmedMessage}.
Logs: openclaw logs --follow`;
      return {
        kind: 'final',
        payload: {
          text: fallbackText
        }
      };
    }
  }
  return {
    kind: 'success',
    runResult,
    fallbackProvider,
    fallbackModel,
    didLogHeartbeatStrip,
    autoCompactionCompleted,
    directlySentBlockKeys: directlySentBlockKeys.size > 0 ? directlySentBlockKeys : void 0
  };
}
export {
  runAgentTurnWithFallback
};
