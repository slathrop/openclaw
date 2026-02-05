import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OpenClawApp } from './app.js';
const originalConnect = OpenClawApp.prototype.connect;
function mountApp(pathname) {
  window.history.replaceState({}, '', pathname);
  const app = document.createElement('openclaw-app');
  document.body.append(app);
  return app;
}
beforeEach(() => {
  OpenClawApp.prototype.connect = () => {
  };
  window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = void 0;
  localStorage.clear();
  document.body.innerHTML = '';
});
afterEach(() => {
  OpenClawApp.prototype.connect = originalConnect;
  window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = void 0;
  localStorage.clear();
  document.body.innerHTML = '';
});
describe('chat focus mode', () => {
  it('collapses header + sidebar on chat tab only', async () => {
    const app = mountApp('/chat');
    await app.updateComplete;
    const shell = app.querySelector('.shell');
    expect(shell).not.toBeNull();
    expect(shell?.classList.contains('shell--chat-focus')).toBe(false);
    const toggle = app.querySelector('button[title^="Toggle focus mode"]');
    expect(toggle).not.toBeNull();
    toggle?.click();
    await app.updateComplete;
    expect(shell?.classList.contains('shell--chat-focus')).toBe(true);
    const link = app.querySelector('a.nav-item[href="/channels"]');
    expect(link).not.toBeNull();
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await app.updateComplete;
    expect(app.tab).toBe('channels');
    expect(shell?.classList.contains('shell--chat-focus')).toBe(false);
    const chatLink = app.querySelector('a.nav-item[href="/chat"]');
    chatLink?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    );
    await app.updateComplete;
    expect(app.tab).toBe('chat');
    expect(shell?.classList.contains('shell--chat-focus')).toBe(true);
  });
});
