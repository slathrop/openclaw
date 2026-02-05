import { describe, expect, it } from 'vitest';
import {
  CONTEXT_WINDOW_HARD_MIN_TOKENS,
  CONTEXT_WINDOW_WARN_BELOW_TOKENS,
  evaluateContextWindowGuard,
  resolveContextWindowInfo
} from './context-window-guard.js';
describe('context-window-guard', () => {
  it('blocks below 16k (model metadata)', () => {
    const info = resolveContextWindowInfo({
      cfg: void 0,
      provider: 'openrouter',
      modelId: 'tiny',
      modelContextWindow: 8e3,
      defaultTokens: 2e5
    });
    const guard = evaluateContextWindowGuard({ info });
    expect(guard.source).toBe('model');
    expect(guard.tokens).toBe(8e3);
    expect(guard.shouldWarn).toBe(true);
    expect(guard.shouldBlock).toBe(true);
  });
  it('warns below 32k but does not block at 16k+', () => {
    const info = resolveContextWindowInfo({
      cfg: void 0,
      provider: 'openai',
      modelId: 'small',
      modelContextWindow: 24e3,
      defaultTokens: 2e5
    });
    const guard = evaluateContextWindowGuard({ info });
    expect(guard.tokens).toBe(24e3);
    expect(guard.shouldWarn).toBe(true);
    expect(guard.shouldBlock).toBe(false);
  });
  it('does not warn at 32k+ (model metadata)', () => {
    const info = resolveContextWindowInfo({
      cfg: void 0,
      provider: 'openai',
      modelId: 'ok',
      modelContextWindow: 64e3,
      defaultTokens: 2e5
    });
    const guard = evaluateContextWindowGuard({ info });
    expect(guard.shouldWarn).toBe(false);
    expect(guard.shouldBlock).toBe(false);
  });
  it('uses models.providers.*.models[].contextWindow when present', () => {
    const cfg = {
      models: {
        providers: {
          openrouter: {
            baseUrl: 'http://localhost',
            apiKey: 'x',
            models: [
              {
                id: 'tiny',
                name: 'tiny',
                reasoning: false,
                input: ['text'],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 12e3,
                maxTokens: 256
              }
            ]
          }
        }
      }
    };
    const info = resolveContextWindowInfo({
      cfg,
      provider: 'openrouter',
      modelId: 'tiny',
      modelContextWindow: 64e3,
      defaultTokens: 2e5
    });
    const guard = evaluateContextWindowGuard({ info });
    expect(info.source).toBe('modelsConfig');
    expect(guard.shouldBlock).toBe(true);
  });
  it('caps with agents.defaults.contextTokens', () => {
    const cfg = {
      agents: { defaults: { contextTokens: 2e4 } }
    };
    const info = resolveContextWindowInfo({
      cfg,
      provider: 'anthropic',
      modelId: 'whatever',
      modelContextWindow: 2e5,
      defaultTokens: 2e5
    });
    const guard = evaluateContextWindowGuard({ info });
    expect(info.source).toBe('agentContextTokens');
    expect(guard.shouldWarn).toBe(true);
    expect(guard.shouldBlock).toBe(false);
  });
  it('does not override when cap exceeds base window', () => {
    const cfg = {
      agents: { defaults: { contextTokens: 128e3 } }
    };
    const info = resolveContextWindowInfo({
      cfg,
      provider: 'anthropic',
      modelId: 'whatever',
      modelContextWindow: 64e3,
      defaultTokens: 2e5
    });
    expect(info.source).toBe('model');
    expect(info.tokens).toBe(64e3);
  });
  it('uses default when nothing else is available', () => {
    const info = resolveContextWindowInfo({
      cfg: void 0,
      provider: 'anthropic',
      modelId: 'unknown',
      modelContextWindow: void 0,
      defaultTokens: 2e5
    });
    const guard = evaluateContextWindowGuard({ info });
    expect(info.source).toBe('default');
    expect(guard.shouldWarn).toBe(false);
    expect(guard.shouldBlock).toBe(false);
  });
  it('allows overriding thresholds', () => {
    const info = { tokens: 1e4, source: 'model' };
    const guard = evaluateContextWindowGuard({
      info,
      warnBelowTokens: 12e3,
      hardMinTokens: 9e3
    });
    expect(guard.shouldWarn).toBe(true);
    expect(guard.shouldBlock).toBe(false);
  });
  it('exports thresholds as expected', () => {
    expect(CONTEXT_WINDOW_HARD_MIN_TOKENS).toBe(16e3);
    expect(CONTEXT_WINDOW_WARN_BELOW_TOKENS).toBe(32e3);
  });
});
