/**
 * @module pi-embedded-subscribe.handlers.messages
 * Message and content delta event handlers for embedded Pi subscriptions.
 */
import { parseReplyDirectives } from '../auto-reply/reply/reply-directives.js';
import { emitAgentEvent } from '../infra/agent-events.js';
import { createInlineCodeState } from '../markdown/code-spans.js';
import {
  isMessagingToolDuplicateNormalized,
  normalizeTextForComparison
} from './pi-embedded-helpers.js';
import { appendRawStream } from './pi-embedded-subscribe.raw-stream.js';
import {
  extractAssistantText,
  extractAssistantThinking,
  extractThinkingFromTaggedStream,
  extractThinkingFromTaggedText,
  formatReasoningMessage,
  promoteThinkingTagsToBlocks
} from './pi-embedded-utils.js';
const stripTrailingDirective = (text) => {
  const openIndex = text.lastIndexOf('[[');
  if (openIndex < 0) {
    return text;
  }
  const closeIndex = text.indexOf(']]', openIndex + 2);
  if (closeIndex >= 0) {
    return text;
  }
  return text.slice(0, openIndex);
};
function handleMessageStart(ctx, evt) {
  const msg = evt.message;
  if (msg?.role !== 'assistant') {
    return;
  }
  ctx.resetAssistantMessageState(ctx.state.assistantTexts.length);
  void ctx.params.onAssistantMessageStart?.();
}
function handleMessageUpdate(ctx, evt) {
  const msg = evt.message;
  if (msg?.role !== 'assistant') {
    return;
  }
  const assistantEvent = evt.assistantMessageEvent;
  const assistantRecord = assistantEvent && typeof assistantEvent === 'object' ? assistantEvent : void 0;
  const evtType = typeof assistantRecord?.type === 'string' ? assistantRecord.type : '';
  if (evtType !== 'text_delta' && evtType !== 'text_start' && evtType !== 'text_end') {
    return;
  }
  const delta = typeof assistantRecord?.delta === 'string' ? assistantRecord.delta : '';
  const content = typeof assistantRecord?.content === 'string' ? assistantRecord.content : '';
  appendRawStream({
    ts: Date.now(),
    event: 'assistant_text_stream',
    runId: ctx.params.runId,
    sessionId: ctx.params.session.id,
    evtType,
    delta,
    content
  });
  let chunk = '';
  if (evtType === 'text_delta') {
    chunk = delta;
  } else if (evtType === 'text_start' || evtType === 'text_end') {
    if (delta) {
      chunk = delta;
    } else if (content) {
      if (content.startsWith(ctx.state.deltaBuffer)) {
        chunk = content.slice(ctx.state.deltaBuffer.length);
      } else if (ctx.state.deltaBuffer.startsWith(content)) {
        chunk = '';
      } else if (!ctx.state.deltaBuffer.includes(content)) {
        chunk = content;
      }
    }
  }
  if (chunk) {
    ctx.state.deltaBuffer += chunk;
    if (ctx.blockChunker) {
      ctx.blockChunker.append(chunk);
    } else {
      ctx.state.blockBuffer += chunk;
    }
  }
  if (ctx.state.streamReasoning) {
    ctx.emitReasoningStream(extractThinkingFromTaggedStream(ctx.state.deltaBuffer));
  }
  const next = ctx.stripBlockTags(ctx.state.deltaBuffer, {
    thinking: false,
    final: false,
    inlineCode: createInlineCodeState()
  }).trim();
  if (next) {
    const visibleDelta = chunk ? ctx.stripBlockTags(chunk, ctx.state.partialBlockState) : '';
    const parsedDelta = visibleDelta ? ctx.consumePartialReplyDirectives(visibleDelta) : null;
    const parsedFull = parseReplyDirectives(stripTrailingDirective(next));
    const cleanedText = parsedFull.text;
    const mediaUrls = parsedDelta?.mediaUrls;
    const hasMedia = Boolean(mediaUrls && mediaUrls.length > 0);
    const hasAudio = Boolean(parsedDelta?.audioAsVoice);
    const previousCleaned = ctx.state.lastStreamedAssistantCleaned ?? '';
    let shouldEmit = false;
    let deltaText = '';
    if (!cleanedText && !hasMedia && !hasAudio) {
      shouldEmit = false;
    } else if (previousCleaned && !cleanedText.startsWith(previousCleaned)) {
      shouldEmit = false;
    } else {
      deltaText = cleanedText.slice(previousCleaned.length);
      shouldEmit = Boolean(deltaText || hasMedia || hasAudio);
    }
    ctx.state.lastStreamedAssistant = next;
    ctx.state.lastStreamedAssistantCleaned = cleanedText;
    if (shouldEmit) {
      emitAgentEvent({
        runId: ctx.params.runId,
        stream: 'assistant',
        data: {
          text: cleanedText,
          delta: deltaText,
          mediaUrls: hasMedia ? mediaUrls : void 0
        }
      });
      void ctx.params.onAgentEvent?.({
        stream: 'assistant',
        data: {
          text: cleanedText,
          delta: deltaText,
          mediaUrls: hasMedia ? mediaUrls : void 0
        }
      });
      ctx.state.emittedAssistantUpdate = true;
      if (ctx.params.onPartialReply && ctx.state.shouldEmitPartialReplies) {
        void ctx.params.onPartialReply({
          text: cleanedText,
          mediaUrls: hasMedia ? mediaUrls : void 0
        });
      }
    }
  }
  if (ctx.params.onBlockReply && ctx.blockChunking && ctx.state.blockReplyBreak === 'text_end') {
    ctx.blockChunker?.drain({ force: false, emit: ctx.emitBlockChunk });
  }
  if (evtType === 'text_end' && ctx.state.blockReplyBreak === 'text_end') {
    if (ctx.blockChunker?.hasBuffered()) {
      ctx.blockChunker.drain({ force: true, emit: ctx.emitBlockChunk });
      ctx.blockChunker.reset();
    } else if (ctx.state.blockBuffer.length > 0) {
      ctx.emitBlockChunk(ctx.state.blockBuffer);
      ctx.state.blockBuffer = '';
    }
  }
}
function handleMessageEnd(ctx, evt) {
  const msg = evt.message;
  if (msg?.role !== 'assistant') {
    return;
  }
  const assistantMessage = msg;
  promoteThinkingTagsToBlocks(assistantMessage);
  const rawText = extractAssistantText(assistantMessage);
  appendRawStream({
    ts: Date.now(),
    event: 'assistant_message_end',
    runId: ctx.params.runId,
    sessionId: ctx.params.session.id,
    rawText,
    rawThinking: extractAssistantThinking(assistantMessage)
  });
  const text = ctx.stripBlockTags(rawText, { thinking: false, final: false });
  const rawThinking = ctx.state.includeReasoning || ctx.state.streamReasoning ? extractAssistantThinking(assistantMessage) || extractThinkingFromTaggedText(rawText) : '';
  const formattedReasoning = rawThinking ? formatReasoningMessage(rawThinking) : '';
  const trimmedText = text.trim();
  const parsedText = trimmedText ? parseReplyDirectives(stripTrailingDirective(trimmedText)) : null;
  let cleanedText = parsedText?.text ?? '';
  let mediaUrls = parsedText?.mediaUrls;
  let hasMedia = Boolean(mediaUrls && mediaUrls.length > 0);
  if (!cleanedText && !hasMedia) {
    const rawTrimmed = rawText.trim();
    const rawStrippedFinal = rawTrimmed.replace(/<\s*\/?\s*final\s*>/gi, '').trim();
    const rawCandidate = rawStrippedFinal || rawTrimmed;
    if (rawCandidate) {
      const parsedFallback = parseReplyDirectives(stripTrailingDirective(rawCandidate));
      cleanedText = parsedFallback.text ?? rawCandidate;
      mediaUrls = parsedFallback.mediaUrls;
      hasMedia = Boolean(mediaUrls && mediaUrls.length > 0);
    }
  }
  if (!ctx.state.emittedAssistantUpdate && (cleanedText || hasMedia)) {
    emitAgentEvent({
      runId: ctx.params.runId,
      stream: 'assistant',
      data: {
        text: cleanedText,
        delta: cleanedText,
        mediaUrls: hasMedia ? mediaUrls : void 0
      }
    });
    void ctx.params.onAgentEvent?.({
      stream: 'assistant',
      data: {
        text: cleanedText,
        delta: cleanedText,
        mediaUrls: hasMedia ? mediaUrls : void 0
      }
    });
    ctx.state.emittedAssistantUpdate = true;
  }
  const addedDuringMessage = ctx.state.assistantTexts.length > ctx.state.assistantTextBaseline;
  const chunkerHasBuffered = ctx.blockChunker?.hasBuffered() ?? false;
  ctx.finalizeAssistantTexts({ text, addedDuringMessage, chunkerHasBuffered });
  const onBlockReply = ctx.params.onBlockReply;
  const shouldEmitReasoning = Boolean(
    ctx.state.includeReasoning && formattedReasoning && onBlockReply && formattedReasoning !== ctx.state.lastReasoningSent
  );
  const shouldEmitReasoningBeforeAnswer = shouldEmitReasoning && ctx.state.blockReplyBreak === 'message_end' && !addedDuringMessage;
  const maybeEmitReasoning = () => {
    if (!shouldEmitReasoning || !formattedReasoning) {
      return;
    }
    ctx.state.lastReasoningSent = formattedReasoning;
    void onBlockReply?.({ text: formattedReasoning });
  };
  if (shouldEmitReasoningBeforeAnswer) {
    maybeEmitReasoning();
  }
  if ((ctx.state.blockReplyBreak === 'message_end' || (ctx.blockChunker ? ctx.blockChunker.hasBuffered() : ctx.state.blockBuffer.length > 0)) && text && onBlockReply) {
    if (ctx.blockChunker?.hasBuffered()) {
      ctx.blockChunker.drain({ force: true, emit: ctx.emitBlockChunk });
      ctx.blockChunker.reset();
    } else if (text !== ctx.state.lastBlockReplyText) {
      const normalizedText = normalizeTextForComparison(text);
      if (isMessagingToolDuplicateNormalized(
        normalizedText,
        ctx.state.messagingToolSentTextsNormalized
      )) {
        ctx.log.debug(
          `Skipping message_end block reply - already sent via messaging tool: ${text.slice(0, 50)}...`
        );
      } else {
        ctx.state.lastBlockReplyText = text;
        const splitResult = ctx.consumeReplyDirectives(text, { final: true });
        if (splitResult) {
          const {
            text: cleanedText2,
            mediaUrls: mediaUrls2,
            audioAsVoice,
            replyToId,
            replyToTag,
            replyToCurrent
          } = splitResult;
          if (cleanedText2 || mediaUrls2 && mediaUrls2.length > 0 || audioAsVoice) {
            void onBlockReply({
              text: cleanedText2,
              mediaUrls: mediaUrls2?.length ? mediaUrls2 : void 0,
              audioAsVoice,
              replyToId,
              replyToTag,
              replyToCurrent
            });
          }
        }
      }
    }
  }
  if (!shouldEmitReasoningBeforeAnswer) {
    maybeEmitReasoning();
  }
  if (ctx.state.streamReasoning && rawThinking) {
    ctx.emitReasoningStream(rawThinking);
  }
  if (ctx.state.blockReplyBreak === 'text_end' && onBlockReply) {
    const tailResult = ctx.consumeReplyDirectives('', { final: true });
    if (tailResult) {
      const {
        text: cleanedText2,
        mediaUrls: mediaUrls2,
        audioAsVoice,
        replyToId,
        replyToTag,
        replyToCurrent
      } = tailResult;
      if (cleanedText2 || mediaUrls2 && mediaUrls2.length > 0 || audioAsVoice) {
        void onBlockReply({
          text: cleanedText2,
          mediaUrls: mediaUrls2?.length ? mediaUrls2 : void 0,
          audioAsVoice,
          replyToId,
          replyToTag,
          replyToCurrent
        });
      }
    }
  }
  ctx.state.deltaBuffer = '';
  ctx.state.blockBuffer = '';
  ctx.blockChunker?.reset();
  ctx.state.blockState.thinking = false;
  ctx.state.blockState.final = false;
  ctx.state.blockState.inlineCode = createInlineCodeState();
  ctx.state.lastStreamedAssistant = void 0;
  ctx.state.lastStreamedAssistantCleaned = void 0;
}
export {
  handleMessageEnd,
  handleMessageStart,
  handleMessageUpdate
};
