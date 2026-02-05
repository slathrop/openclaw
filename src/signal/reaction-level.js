import { resolveSignalAccount } from './accounts.js';
function resolveSignalReactionLevel(params) {
  const account = resolveSignalAccount({
    cfg: params.cfg,
    accountId: params.accountId
  });
  const level = account.config.reactionLevel ?? 'minimal';
  switch (level) {
    case 'off':
      return {
        level,
        ackEnabled: false,
        agentReactionsEnabled: false
      };
    case 'ack':
      return {
        level,
        ackEnabled: true,
        agentReactionsEnabled: false
      };
    case 'minimal':
      return {
        level,
        ackEnabled: false,
        agentReactionsEnabled: true,
        agentReactionGuidance: 'minimal'
      };
    case 'extensive':
      return {
        level,
        ackEnabled: false,
        agentReactionsEnabled: true,
        agentReactionGuidance: 'extensive'
      };
    default:
      return {
        level: 'minimal',
        ackEnabled: false,
        agentReactionsEnabled: true,
        agentReactionGuidance: 'minimal'
      };
  }
}
export {
  resolveSignalReactionLevel
};
