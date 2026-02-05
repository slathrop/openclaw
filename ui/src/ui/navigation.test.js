import { describe, expect, it } from 'vitest';
import {
  TAB_GROUPS,
  iconForTab,
  inferBasePathFromPathname,
  normalizeBasePath,
  normalizePath,
  pathForTab,
  subtitleForTab,
  tabFromPath,
  titleForTab
} from './navigation.js';
const ALL_TABS = TAB_GROUPS.flatMap((group) => group.tabs);
describe('iconForTab', () => {
  it('returns a non-empty string for every tab', () => {
    for (const tab of ALL_TABS) {
      const icon = iconForTab(tab);
      expect(icon).toBeTruthy();
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    }
  });
  it('returns stable icons for known tabs', () => {
    expect(iconForTab('chat')).toBe('\u{1F4AC}');
    expect(iconForTab('overview')).toBe('\u{1F4CA}');
    expect(iconForTab('channels')).toBe('\u{1F517}');
    expect(iconForTab('instances')).toBe('\u{1F4E1}');
    expect(iconForTab('sessions')).toBe('\u{1F4C4}');
    expect(iconForTab('cron')).toBe('\u23F0');
    expect(iconForTab('skills')).toBe('\u26A1\uFE0F');
    expect(iconForTab('nodes')).toBe('\u{1F5A5}\uFE0F');
    expect(iconForTab('config')).toBe('\u2699\uFE0F');
    expect(iconForTab('debug')).toBe('\u{1F41E}');
    expect(iconForTab('logs')).toBe('\u{1F9FE}');
  });
  it('returns a fallback icon for unknown tab', () => {
    const unknownTab = 'unknown';
    expect(iconForTab(unknownTab)).toBe('\u{1F4C1}');
  });
});
describe('titleForTab', () => {
  it('returns a non-empty string for every tab', () => {
    for (const tab of ALL_TABS) {
      const title = titleForTab(tab);
      expect(title).toBeTruthy();
      expect(typeof title).toBe('string');
    }
  });
  it('returns expected titles', () => {
    expect(titleForTab('chat')).toBe('Chat');
    expect(titleForTab('overview')).toBe('Overview');
    expect(titleForTab('cron')).toBe('Cron Jobs');
  });
});
describe('subtitleForTab', () => {
  it('returns a string for every tab', () => {
    for (const tab of ALL_TABS) {
      const subtitle = subtitleForTab(tab);
      expect(typeof subtitle).toBe('string');
    }
  });
  it('returns descriptive subtitles', () => {
    expect(subtitleForTab('chat')).toContain('chat session');
    expect(subtitleForTab('config')).toContain('openclaw.json');
  });
});
describe('normalizeBasePath', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeBasePath('')).toBe('');
  });
  it('adds leading slash if missing', () => {
    expect(normalizeBasePath('ui')).toBe('/ui');
  });
  it('removes trailing slash', () => {
    expect(normalizeBasePath('/ui/')).toBe('/ui');
  });
  it('returns empty string for root path', () => {
    expect(normalizeBasePath('/')).toBe('');
  });
  it('handles nested paths', () => {
    expect(normalizeBasePath('/apps/openclaw')).toBe('/apps/openclaw');
  });
});
describe('normalizePath', () => {
  it('returns / for falsy input', () => {
    expect(normalizePath('')).toBe('/');
  });
  it('adds leading slash if missing', () => {
    expect(normalizePath('chat')).toBe('/chat');
  });
  it('removes trailing slash except for root', () => {
    expect(normalizePath('/chat/')).toBe('/chat');
    expect(normalizePath('/')).toBe('/');
  });
});
describe('pathForTab', () => {
  it('returns correct path without base', () => {
    expect(pathForTab('chat')).toBe('/chat');
    expect(pathForTab('overview')).toBe('/overview');
  });
  it('prepends base path', () => {
    expect(pathForTab('chat', '/ui')).toBe('/ui/chat');
    expect(pathForTab('sessions', '/apps/openclaw')).toBe('/apps/openclaw/sessions');
  });
});
describe('tabFromPath', () => {
  it('returns tab for valid path', () => {
    expect(tabFromPath('/chat')).toBe('chat');
    expect(tabFromPath('/overview')).toBe('overview');
    expect(tabFromPath('/sessions')).toBe('sessions');
  });
  it('returns chat for root path', () => {
    expect(tabFromPath('/')).toBe('chat');
  });
  it('handles base paths', () => {
    expect(tabFromPath('/ui/chat', '/ui')).toBe('chat');
    expect(tabFromPath('/apps/openclaw/sessions', '/apps/openclaw')).toBe('sessions');
  });
  it('returns null for unknown path', () => {
    expect(tabFromPath('/unknown')).toBeNull();
  });
  it('is case-insensitive', () => {
    expect(tabFromPath('/CHAT')).toBe('chat');
    expect(tabFromPath('/Overview')).toBe('overview');
  });
});
describe('inferBasePathFromPathname', () => {
  it('returns empty string for root', () => {
    expect(inferBasePathFromPathname('/')).toBe('');
  });
  it('returns empty string for direct tab path', () => {
    expect(inferBasePathFromPathname('/chat')).toBe('');
    expect(inferBasePathFromPathname('/overview')).toBe('');
  });
  it('infers base path from nested paths', () => {
    expect(inferBasePathFromPathname('/ui/chat')).toBe('/ui');
    expect(inferBasePathFromPathname('/apps/openclaw/sessions')).toBe('/apps/openclaw');
  });
  it('handles index.html suffix', () => {
    expect(inferBasePathFromPathname('/index.html')).toBe('');
    expect(inferBasePathFromPathname('/ui/index.html')).toBe('/ui');
  });
});
describe('TAB_GROUPS', () => {
  it('contains all expected groups', () => {
    const labels = TAB_GROUPS.map((g) => g.label);
    expect(labels).toContain('Chat');
    expect(labels).toContain('Control');
    expect(labels).toContain('Agent');
    expect(labels).toContain('Settings');
  });
  it('all tabs are unique', () => {
    const allTabs = TAB_GROUPS.flatMap((g) => g.tabs);
    const uniqueTabs = new Set(allTabs);
    expect(uniqueTabs.size).toBe(allTabs.length);
  });
});
