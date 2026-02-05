import { Container, Markdown, Spacer } from '@mariozechner/pi-tui';
import { markdownTheme, theme } from '../theme/theme.js';
class UserMessageComponent extends Container {
  _body;
  constructor(text) {
    super();
    this._body = new Markdown(text, 1, 1, markdownTheme, {
      bgColor: (line) => theme.userBg(line),
      color: (line) => theme.userText(line)
    });
    this.addChild(new Spacer(1));
    this.addChild(this._body);
  }
  setText(text) {
    this._body.setText(text);
  }
}
export {
  UserMessageComponent
};
