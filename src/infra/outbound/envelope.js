/**
 * Outbound result envelope formatting.
 * Wraps delivery results into a standardized JSON envelope format.
 * @module
 */

import { normalizeOutboundPayloadsForJson } from './payloads.js';
const isOutboundPayloadJson = (payload) => 'mediaUrl' in payload;
function buildOutboundResultEnvelope(params) {
  const hasPayloads = params.payloads !== void 0;
  const payloads = params.payloads === void 0 ? void 0 : params.payloads.length === 0 ? [] : isOutboundPayloadJson(params.payloads[0]) ? params.payloads : normalizeOutboundPayloadsForJson(params.payloads);
  if (params.flattenDelivery !== false && params.delivery && !params.meta && !hasPayloads) {
    return params.delivery;
  }
  return {
    ...hasPayloads ? { payloads } : {},
    ...params.meta ? { meta: params.meta } : {},
    ...params.delivery ? { delivery: params.delivery } : {}
  };
}
export {
  buildOutboundResultEnvelope
};
