import { buildChannelConfigSchema } from 'openclaw/plugin-sdk';
import { z } from 'zod';
const ShipSchema = z.string().min(1);
const ChannelNestSchema = z.string().min(1);
const TlonChannelRuleSchema = z.object({
  mode: z.enum(['restricted', 'open']).optional(),
  allowedShips: z.array(ShipSchema).optional()
});
const TlonAuthorizationSchema = z.object({
  channelRules: z.record(z.string(), TlonChannelRuleSchema).optional()
});
const TlonAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  ship: ShipSchema.optional(),
  url: z.string().optional(),
  code: z.string().optional(),
  groupChannels: z.array(ChannelNestSchema).optional(),
  dmAllowlist: z.array(ShipSchema).optional(),
  autoDiscoverChannels: z.boolean().optional(),
  showModelSignature: z.boolean().optional(),
  responsePrefix: z.string().optional()
});
const TlonConfigSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  ship: ShipSchema.optional(),
  url: z.string().optional(),
  code: z.string().optional(),
  groupChannels: z.array(ChannelNestSchema).optional(),
  dmAllowlist: z.array(ShipSchema).optional(),
  autoDiscoverChannels: z.boolean().optional(),
  showModelSignature: z.boolean().optional(),
  responsePrefix: z.string().optional(),
  authorization: TlonAuthorizationSchema.optional(),
  defaultAuthorizedShips: z.array(ShipSchema).optional(),
  accounts: z.record(z.string(), TlonAccountSchema).optional()
});
const tlonChannelConfigSchema = buildChannelConfigSchema(TlonConfigSchema);
export {
  TlonAccountSchema,
  TlonAuthorizationSchema,
  TlonChannelRuleSchema,
  TlonConfigSchema,
  tlonChannelConfigSchema
};
