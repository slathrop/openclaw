/**
 * Channel heartbeat visibility Zod validation schema.
 *
 * Validates per-channel heartbeat display settings: whether to show
 * OK status, show alerts, and whether to use a status indicator.
 */
import { z } from 'zod';

export const ChannelHeartbeatVisibilitySchema = z
  .object({
    showOk: z.boolean().optional(),
    showAlerts: z.boolean().optional(),
    useIndicator: z.boolean().optional()
  })
  .strict()
  .optional();
