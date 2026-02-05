import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import { theme } from '../theme/theme.js';
import { AssistantMessageComponent } from './assistant-message.js';
import { ToolExecutionComponent } from './tool-execution.js';
import { UserMessageComponent } from './user-message.js';
class ChatLog extends Container {
  _toolById = /* @__PURE__ */ new Map();
  _streamingRuns = /* @__PURE__ */ new Map();
  _toolsExpanded = false;
  clearAll() {
    this.clear();
    this._toolById.clear();
    this._streamingRuns.clear();
  }
  addSystem(text) {
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.system(text), 1, 0));
  }
  addUser(text) {
    this.addChild(new UserMessageComponent(text));
  }
  _resolveRunId(runId) {
    return runId ?? 'default';
  }
  startAssistant(text, runId) {
    const component = new AssistantMessageComponent(text);
    this._streamingRuns.set(this._resolveRunId(runId), component);
    this.addChild(component);
    return component;
  }
  updateAssistant(text, runId) {
    const effectiveRunId = this._resolveRunId(runId);
    const existing = this._streamingRuns.get(effectiveRunId);
    if (!existing) {
      this.startAssistant(text, runId);
      return;
    }
    existing.setText(text);
  }
  finalizeAssistant(text, runId) {
    const effectiveRunId = this._resolveRunId(runId);
    const existing = this._streamingRuns.get(effectiveRunId);
    if (existing) {
      existing.setText(text);
      this._streamingRuns.delete(effectiveRunId);
      return;
    }
    this.addChild(new AssistantMessageComponent(text));
  }
  startTool(toolCallId, toolName, args) {
    const existing = this._toolById.get(toolCallId);
    if (existing) {
      existing.setArgs(args);
      return existing;
    }
    const component = new ToolExecutionComponent(toolName, args);
    component.setExpanded(this._toolsExpanded);
    this._toolById.set(toolCallId, component);
    this.addChild(component);
    return component;
  }
  updateToolArgs(toolCallId, args) {
    const existing = this._toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setArgs(args);
  }
  updateToolResult(toolCallId, result, opts) {
    const existing = this._toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    if (opts?.partial) {
      existing.setPartialResult(result);
      return;
    }
    existing.setResult(result, {
      isError: opts?.isError
    });
  }
  setToolsExpanded(expanded) {
    this._toolsExpanded = expanded;
    for (const tool of this._toolById.values()) {
      tool.setExpanded(expanded);
    }
  }
}
export {
  ChatLog
};
