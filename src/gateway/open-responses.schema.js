/** @module gateway/open-responses.schema -- OpenAI-compatible responses API schema definitions. */
import { z } from 'zod';
const InputTextContentPartSchema = z.object({
  type: z.literal('input_text'),
  text: z.string()
}).strict();
const OutputTextContentPartSchema = z.object({
  type: z.literal('output_text'),
  text: z.string()
}).strict();
const InputImageSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('url'),
    url: z.string().url()
  }),
  z.object({
    type: z.literal('base64'),
    media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    data: z.string().min(1)
    // base64-encoded
  })
]);
const InputImageContentPartSchema = z.object({
  type: z.literal('input_image'),
  source: InputImageSourceSchema
}).strict();
const InputFileSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('url'),
    url: z.string().url()
  }),
  z.object({
    type: z.literal('base64'),
    media_type: z.string().min(1),
    // MIME type
    data: z.string().min(1),
    // base64-encoded
    filename: z.string().optional()
  })
]);
const InputFileContentPartSchema = z.object({
  type: z.literal('input_file'),
  source: InputFileSourceSchema
}).strict();
const ContentPartSchema = z.discriminatedUnion('type', [
  InputTextContentPartSchema,
  OutputTextContentPartSchema,
  InputImageContentPartSchema,
  InputFileContentPartSchema
]);
const MessageItemRoleSchema = z.enum(['system', 'developer', 'user', 'assistant']);
const MessageItemSchema = z.object({
  type: z.literal('message'),
  role: MessageItemRoleSchema,
  content: z.union([z.string(), z.array(ContentPartSchema)])
}).strict();
const FunctionCallItemSchema = z.object({
  type: z.literal('function_call'),
  id: z.string().optional(),
  call_id: z.string().optional(),
  name: z.string(),
  arguments: z.string()
}).strict();
const FunctionCallOutputItemSchema = z.object({
  type: z.literal('function_call_output'),
  call_id: z.string(),
  output: z.string()
}).strict();
const ReasoningItemSchema = z.object({
  type: z.literal('reasoning'),
  content: z.string().optional(),
  encrypted_content: z.string().optional(),
  summary: z.string().optional()
}).strict();
const ItemReferenceItemSchema = z.object({
  type: z.literal('item_reference'),
  id: z.string()
}).strict();
const ItemParamSchema = z.discriminatedUnion('type', [
  MessageItemSchema,
  FunctionCallItemSchema,
  FunctionCallOutputItemSchema,
  ReasoningItemSchema,
  ItemReferenceItemSchema
]);
const FunctionToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1, 'Tool name cannot be empty'),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional()
  })
}).strict();
const ToolDefinitionSchema = FunctionToolDefinitionSchema;
const ToolChoiceSchema = z.union([
  z.literal('auto'),
  z.literal('none'),
  z.literal('required'),
  z.object({
    type: z.literal('function'),
    function: z.object({ name: z.string() })
  })
]);
const CreateResponseBodySchema = z.object({
  model: z.string(),
  input: z.union([z.string(), z.array(ItemParamSchema)]),
  instructions: z.string().optional(),
  tools: z.array(ToolDefinitionSchema).optional(),
  tool_choice: ToolChoiceSchema.optional(),
  stream: z.boolean().optional(),
  max_output_tokens: z.number().int().positive().optional(),
  max_tool_calls: z.number().int().positive().optional(),
  user: z.string().optional(),
  // Phase 1: ignore but accept these fields
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  store: z.boolean().optional(),
  previous_response_id: z.string().optional(),
  reasoning: z.object({
    effort: z.enum(['low', 'medium', 'high']).optional(),
    summary: z.enum(['auto', 'concise', 'detailed']).optional()
  }).optional(),
  truncation: z.enum(['auto', 'disabled']).optional()
}).strict();
const ResponseStatusSchema = z.enum([
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'incomplete'
]);
const OutputItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    id: z.string(),
    role: z.literal('assistant'),
    content: z.array(OutputTextContentPartSchema),
    status: z.enum(['in_progress', 'completed']).optional()
  }).strict(),
  z.object({
    type: z.literal('function_call'),
    id: z.string(),
    call_id: z.string(),
    name: z.string(),
    arguments: z.string(),
    status: z.enum(['in_progress', 'completed']).optional()
  }).strict(),
  z.object({
    type: z.literal('reasoning'),
    id: z.string(),
    content: z.string().optional(),
    summary: z.string().optional()
  }).strict()
]);
const UsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative()
});
const ResponseResourceSchema = z.object({
  id: z.string(),
  object: z.literal('response'),
  created_at: z.number().int(),
  status: ResponseStatusSchema,
  model: z.string(),
  output: z.array(OutputItemSchema),
  usage: UsageSchema,
  // Optional fields for future phases
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional()
});
const ResponseCreatedEventSchema = z.object({
  type: z.literal('response.created'),
  response: ResponseResourceSchema
});
const ResponseInProgressEventSchema = z.object({
  type: z.literal('response.in_progress'),
  response: ResponseResourceSchema
});
const ResponseCompletedEventSchema = z.object({
  type: z.literal('response.completed'),
  response: ResponseResourceSchema
});
const ResponseFailedEventSchema = z.object({
  type: z.literal('response.failed'),
  response: ResponseResourceSchema
});
const OutputItemAddedEventSchema = z.object({
  type: z.literal('response.output_item.added'),
  output_index: z.number().int().nonnegative(),
  item: OutputItemSchema
});
const OutputItemDoneEventSchema = z.object({
  type: z.literal('response.output_item.done'),
  output_index: z.number().int().nonnegative(),
  item: OutputItemSchema
});
const ContentPartAddedEventSchema = z.object({
  type: z.literal('response.content_part.added'),
  item_id: z.string(),
  output_index: z.number().int().nonnegative(),
  content_index: z.number().int().nonnegative(),
  part: OutputTextContentPartSchema
});
const ContentPartDoneEventSchema = z.object({
  type: z.literal('response.content_part.done'),
  item_id: z.string(),
  output_index: z.number().int().nonnegative(),
  content_index: z.number().int().nonnegative(),
  part: OutputTextContentPartSchema
});
const OutputTextDeltaEventSchema = z.object({
  type: z.literal('response.output_text.delta'),
  item_id: z.string(),
  output_index: z.number().int().nonnegative(),
  content_index: z.number().int().nonnegative(),
  delta: z.string()
});
const OutputTextDoneEventSchema = z.object({
  type: z.literal('response.output_text.done'),
  item_id: z.string(),
  output_index: z.number().int().nonnegative(),
  content_index: z.number().int().nonnegative(),
  text: z.string()
});
export {
  ContentPartAddedEventSchema,
  ContentPartDoneEventSchema,
  ContentPartSchema,
  CreateResponseBodySchema,
  FunctionCallItemSchema,
  FunctionCallOutputItemSchema,
  FunctionToolDefinitionSchema,
  InputFileContentPartSchema,
  InputFileSourceSchema,
  InputImageContentPartSchema,
  InputImageSourceSchema,
  InputTextContentPartSchema,
  ItemParamSchema,
  ItemReferenceItemSchema,
  MessageItemRoleSchema,
  MessageItemSchema,
  OutputItemAddedEventSchema,
  OutputItemDoneEventSchema,
  OutputItemSchema,
  OutputTextContentPartSchema,
  OutputTextDeltaEventSchema,
  OutputTextDoneEventSchema,
  ReasoningItemSchema,
  ResponseCompletedEventSchema,
  ResponseCreatedEventSchema,
  ResponseFailedEventSchema,
  ResponseInProgressEventSchema,
  ResponseResourceSchema,
  ResponseStatusSchema,
  ToolChoiceSchema,
  ToolDefinitionSchema,
  UsageSchema
};
