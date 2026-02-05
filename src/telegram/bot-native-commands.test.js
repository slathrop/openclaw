import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTelegramNativeCommands } from './bot-native-commands.js';
const { listSkillCommandsForAgents } = vi.hoisted(() => ({
  listSkillCommandsForAgents: vi.fn(() => [])
}));
vi.mock('../auto-reply/skill-commands.js', () => ({
  listSkillCommandsForAgents
}));
describe('registerTelegramNativeCommands', () => {
  beforeEach(() => {
    listSkillCommandsForAgents.mockReset();
  });
  const buildParams = (cfg, accountId = 'default') => ({
    bot: {
      api: {
        setMyCommands: vi.fn().mockResolvedValue(void 0),
        sendMessage: vi.fn().mockResolvedValue(void 0)
      },
      command: vi.fn()
    },
    cfg,
    runtime: {},
    accountId,
    telegramCfg: {},
    allowFrom: [],
    groupAllowFrom: [],
    replyToMode: 'off',
    textLimit: 4096,
    useAccessGroups: false,
    nativeEnabled: true,
    nativeSkillsEnabled: true,
    nativeDisabledExplicit: false,
    resolveGroupPolicy: () => ({ allowlistEnabled: false, allowed: true }),
    resolveTelegramGroupConfig: () => ({
      groupConfig: void 0,
      topicConfig: void 0
    }),
    shouldSkipUpdate: () => false,
    opts: { token: 'token' }
  });
  it('scopes skill commands when account binding exists', () => {
    const cfg = {
      agents: {
        list: [{ id: 'main', default: true }, { id: 'butler' }]
      },
      bindings: [
        {
          agentId: 'butler',
          match: { channel: 'telegram', accountId: 'bot-a' }
        }
      ]
    };
    registerTelegramNativeCommands(buildParams(cfg, 'bot-a'));
    expect(listSkillCommandsForAgents).toHaveBeenCalledWith({
      cfg,
      agentIds: ['butler']
    });
  });
  it('keeps skill commands unscoped without a matching binding', () => {
    const cfg = {
      agents: {
        list: [{ id: 'main', default: true }, { id: 'butler' }]
      }
    };
    registerTelegramNativeCommands(buildParams(cfg, 'bot-a'));
    expect(listSkillCommandsForAgents).toHaveBeenCalledWith({ cfg });
  });
});
