/**
 * @module talk
 * Voice/TTS API key resolution from environment and shell profiles.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Reads the ElevenLabs API key from shell profile files.
 * @param {{ fs?: typeof import('node:fs'), os?: typeof import('node:os'), path?: typeof import('node:path') }} [deps]
 * @returns {string | null}
 */
export function readTalkApiKeyFromProfile(deps = {}) {
  const fsImpl = deps.fs ?? fs;
  const osImpl = deps.os ?? os;
  const pathImpl = deps.path ?? path;

  const home = osImpl.homedir();
  const candidates = ['.profile', '.zprofile', '.zshrc', '.bashrc'].map((name) =>
    pathImpl.join(home, name)
  );
  for (const candidate of candidates) {
    if (!fsImpl.existsSync(candidate)) {
      continue;
    }
    try {
      const text = fsImpl.readFileSync(candidate, 'utf-8');
      const match = text.match(
        /(?:^|\n)\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^\n"']+)["']?/
      );
      const value = match?.[1]?.trim();
      if (value) {
        return value;
      }
    } catch {
      // Ignore profile read errors.
    }
  }
  return null;
}

/**
 * Resolves the ElevenLabs API key from env or shell profiles.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ fs?: typeof import('node:fs'), os?: typeof import('node:os'), path?: typeof import('node:path') }} [deps]
 * @returns {string | null}
 */
export function resolveTalkApiKey(env = process.env, deps = {}) {
  const envValue = (env.ELEVENLABS_API_KEY ?? '').trim();
  if (envValue) {
    return envValue;
  }
  return readTalkApiKeyFromProfile(deps);
}
