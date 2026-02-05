/**
 * TypeBox schema utilities for agent tool definitions.
 * @module agents/schema/typebox
 */
import { Type } from '@sinclair/typebox';
import {
  CHANNEL_TARGET_DESCRIPTION,
  CHANNEL_TARGETS_DESCRIPTION
} from '../../infra/outbound/channel-target.js';
function stringEnum(values, options = {}) {
  return Type.Unsafe({
    type: 'string',
    enum: [...values],
    ...options
  });
}
function optionalStringEnum(values, options = {}) {
  return Type.Optional(stringEnum(values, options));
}
function channelTargetSchema(options) {
  return Type.String({
    description: options?.description ?? CHANNEL_TARGET_DESCRIPTION
  });
}
function channelTargetsSchema(options) {
  return Type.Array(
    channelTargetSchema({ description: options?.description ?? CHANNEL_TARGETS_DESCRIPTION })
  );
}
export {
  channelTargetSchema,
  channelTargetsSchema,
  optionalStringEnum,
  stringEnum
};
