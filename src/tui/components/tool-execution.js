import { Box, Container, Markdown, Spacer, Text } from '@mariozechner/pi-tui';
import { formatToolDetail, resolveToolDisplay } from '../../agents/tool-display.js';
import { markdownTheme, theme } from '../theme/theme.js';
const PREVIEW_LINES = 12;
function formatArgs(toolName, args) {
  const display = resolveToolDisplay({ name: toolName, args });
  const detail = formatToolDetail(display);
  if (detail) {
    return detail;
  }
  if (!args || typeof args !== 'object') {
    return '';
  }
  try {
    return JSON.stringify(args);
  } catch {
    return '';
  }
}
function extractText(result) {
  if (!result?.content) {
    return '';
  }
  const lines = [];
  for (const entry of result.content) {
    if (entry.type === 'text' && entry.text) {
      lines.push(entry.text);
    } else if (entry.type === 'image') {
      const mime = entry.mimeType ?? 'image';
      const size = entry.bytes ? ` ${Math.round(entry.bytes / 1024)}kb` : '';
      const omitted = entry.omitted ? ' (omitted)' : '';
      lines.push(`[${mime}${size}${omitted}]`);
    }
  }
  return lines.join('\n').trim();
}
class ToolExecutionComponent extends Container {
  _box;
  _header;
  _argsLine;
  _output;
  _toolName;
  _args;
  _result;
  _expanded = false;
  _isError = false;
  _isPartial = true;
  constructor(toolName, args) {
    super();
    this._toolName = toolName;
    this._args = args;
    this._box = new Box(1, 1, (line) => theme.toolPendingBg(line));
    this._header = new Text('', 0, 0);
    this._argsLine = new Text('', 0, 0);
    this._output = new Markdown('', 0, 0, markdownTheme, {
      color: (line) => theme.toolOutput(line)
    });
    this.addChild(new Spacer(1));
    this.addChild(this._box);
    this._box.addChild(this._header);
    this._box.addChild(this._argsLine);
    this._box.addChild(this._output);
    this._refresh();
  }
  setArgs(args) {
    this._args = args;
    this._refresh();
  }
  setExpanded(expanded) {
    this._expanded = expanded;
    this._refresh();
  }
  setResult(result, opts) {
    this._result = result;
    this._isPartial = false;
    this._isError = Boolean(opts?._isError);
    this._refresh();
  }
  setPartialResult(result) {
    this._result = result;
    this._isPartial = true;
    this._refresh();
  }
  _refresh() {
    const bg = this._isPartial ? theme.toolPendingBg : this._isError ? theme.toolErrorBg : theme.toolSuccessBg;
    this._box.setBgFn((line) => bg(line));
    const display = resolveToolDisplay({
      name: this._toolName,
      args: this._args
    });
    const title = `${display.emoji} ${display.label}${this._isPartial ? ' (running)' : ''}`;
    this._header.setText(theme.toolTitle(theme.bold(title)));
    const argLine = formatArgs(this._toolName, this._args);
    this._argsLine.setText(argLine ? theme.dim(argLine) : theme.dim(' '));
    const raw = extractText(this._result);
    const text = raw || (this._isPartial ? '\u2026' : '');
    if (!this._expanded && text) {
      const lines = text.split('\n');
      const preview = lines.length > PREVIEW_LINES ? `${lines.slice(0, PREVIEW_LINES).join('\n')}
\u2026` : text;
      this._output.setText(preview);
    } else {
      this._output.setText(text);
    }
  }
}
export {
  ToolExecutionComponent
};
