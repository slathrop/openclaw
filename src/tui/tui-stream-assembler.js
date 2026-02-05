import {
  composeThinkingAndContent,
  extractContentFromMessage,
  extractThinkingFromMessage,
  resolveFinalAssistantText
} from './tui-formatters.js';
class TuiStreamAssembler {
  _runs = /* @__PURE__ */ new Map();
  _getOrCreateRun(runId) {
    let state = this._runs.get(runId);
    if (!state) {
      state = {
        thinkingText: '',
        contentText: '',
        displayText: ''
      };
      this._runs.set(runId, state);
    }
    return state;
  }
  _updateRunState(state, message, showThinking) {
    const thinkingText = extractThinkingFromMessage(message);
    const contentText = extractContentFromMessage(message);
    if (thinkingText) {
      state.thinkingText = thinkingText;
    }
    if (contentText) {
      state.contentText = contentText;
    }
    const displayText = composeThinkingAndContent({
      thinkingText: state.thinkingText,
      contentText: state.contentText,
      showThinking
    });
    state.displayText = displayText;
  }
  ingestDelta(runId, message, showThinking) {
    const state = this._getOrCreateRun(runId);
    const previousDisplayText = state.displayText;
    this._updateRunState(state, message, showThinking);
    if (!state.displayText || state.displayText === previousDisplayText) {
      return null;
    }
    return state.displayText;
  }
  finalize(runId, message, showThinking) {
    const state = this._getOrCreateRun(runId);
    this._updateRunState(state, message, showThinking);
    const finalComposed = state.displayText;
    const finalText = resolveFinalAssistantText({
      finalText: finalComposed,
      streamedText: state.displayText
    });
    this._runs.delete(runId);
    return finalText;
  }
  drop(runId) {
    this._runs.delete(runId);
  }
}
export {
  TuiStreamAssembler
};
