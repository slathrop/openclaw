import { resolveMattermostAccount } from './mattermost/accounts.js';
function resolveMattermostGroupRequireMention(params) {
  const account = resolveMattermostAccount({
    cfg: params.cfg,
    accountId: params.accountId
  });
  if (typeof account.requireMention === 'boolean') {
    return account.requireMention;
  }
  return true;
}
export {
  resolveMattermostGroupRequireMention
};
