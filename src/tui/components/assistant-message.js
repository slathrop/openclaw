import { Container, Markdown, Spacer } from '@mariozechner/pi-tui';
import { markdownTheme, theme } from '../theme/theme.js';
class AssistantMessageComponent extends Container {
  _body;
  constructor(text) {
    super();
    this._body = new Markdown(text, 1, 0, markdownTheme, {
      color: (line) => theme.fg(line)
    });
    this.addChild(new Spacer(1));
    this.addChild(this._body);
  }
  setText(text) {
    this._body.setText(text);
  }
}
export {
  AssistantMessageComponent
};
