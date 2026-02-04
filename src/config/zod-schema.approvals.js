/**
 * Exec approval forwarding Zod validation schema.
 *
 * Validates the approvals.exec configuration section that controls
 * forwarding of command execution approval requests to specified
 * channel targets.
 *
 * SECURITY: Gates code execution by routing approval requests to
 * authorized reviewers via configured channel targets.
 */
import { z } from 'zod';

const ExecApprovalForwardTargetSchema = z
  .object({
    channel: z.string().min(1),
    to: z.string().min(1),
    accountId: z.string().optional(),
    threadId: z.union([z.string(), z.number()]).optional()
  })
  .strict();

const ExecApprovalForwardingSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.union([z.literal('session'), z.literal('targets'), z.literal('both')]).optional(),
    agentFilter: z.array(z.string()).optional(),
    sessionFilter: z.array(z.string()).optional(),
    targets: z.array(ExecApprovalForwardTargetSchema).optional()
  })
  .strict()
  .optional();

export const ApprovalsSchema = z
  .object({
    exec: ExecApprovalForwardingSchema
  })
  .strict()
  .optional();
