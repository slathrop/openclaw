const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLegacyConfigValues } from './doctor-legacy-config.js';
describe('normalizeLegacyConfigValues', () => {
  let previousOauthDir;
  let tempOauthDir;
  const writeCreds = /* @__PURE__ */ __name((dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'creds.json'), JSON.stringify({ me: {} }));
  }, 'writeCreds');
  beforeEach(() => {
    previousOauthDir = process.env.OPENCLAW_OAUTH_DIR;
    tempOauthDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-oauth-'));
    process.env.OPENCLAW_OAUTH_DIR = tempOauthDir;
  });
  afterEach(() => {
    if (previousOauthDir === void 0) {
      delete process.env.OPENCLAW_OAUTH_DIR;
    } else {
      process.env.OPENCLAW_OAUTH_DIR = previousOauthDir;
    }
    if (tempOauthDir) {
      fs.rmSync(tempOauthDir, { recursive: true, force: true });
      tempOauthDir = void 0;
    }
  });
  it('does not add whatsapp config when missing and no auth exists', () => {
    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: '\u{1F440}' }
    });
    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });
  it('copies legacy ack reaction when whatsapp config exists', () => {
    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: '\u{1F440}', ackReactionScope: 'group-mentions' },
      channels: { whatsapp: {} }
    });
    expect(res.config.channels?.whatsapp?.ackReaction).toEqual({
      emoji: '\u{1F440}',
      direct: false,
      group: 'mentions'
    });
    expect(res.changes).toEqual([
      'Copied messages.ackReaction \u2192 channels.whatsapp.ackReaction (scope: group-mentions).'
    ]);
  });
  it('does not add whatsapp config when only auth exists (issue #900)', () => {
    const credsDir = path.join(tempOauthDir ?? '', 'whatsapp', 'default');
    writeCreds(credsDir);
    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: '\u{1F440}', ackReactionScope: 'group-mentions' }
    });
    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });
  it('does not add whatsapp config when only legacy auth exists (issue #900)', () => {
    const credsPath = path.join(tempOauthDir ?? '', 'creds.json');
    fs.writeFileSync(credsPath, JSON.stringify({ me: {} }));
    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: '\u{1F440}', ackReactionScope: 'group-mentions' }
    });
    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });
  it('does not add whatsapp config when only non-default auth exists (issue #900)', () => {
    const credsDir = path.join(tempOauthDir ?? '', 'whatsapp', 'work');
    writeCreds(credsDir);
    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: '\u{1F440}', ackReactionScope: 'group-mentions' }
    });
    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });
  it('copies legacy ack reaction when authDir override exists', () => {
    const customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-wa-auth-'));
    try {
      writeCreds(customDir);
      const res = normalizeLegacyConfigValues({
        messages: { ackReaction: '\u{1F440}', ackReactionScope: 'group-mentions' },
        channels: { whatsapp: { accounts: { work: { authDir: customDir } } } }
      });
      expect(res.config.channels?.whatsapp?.ackReaction).toEqual({
        emoji: '\u{1F440}',
        direct: false,
        group: 'mentions'
      });
    } finally {
      fs.rmSync(customDir, { recursive: true, force: true });
    }
  });
});
