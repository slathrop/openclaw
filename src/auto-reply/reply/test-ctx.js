import { finalizeInboundContext } from './inbound-context.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

function buildTestCtx(overrides = {}) {
  return finalizeInboundContext({
    Body: '',
    CommandBody: '',
    CommandSource: 'text',
    From: 'whatsapp:+1000',
    To: 'whatsapp:+2000',
    ChatType: 'direct',
    Provider: 'whatsapp',
    Surface: 'whatsapp',
    CommandAuthorized: false,
    ...overrides
  });
}
export {
  buildTestCtx
};
