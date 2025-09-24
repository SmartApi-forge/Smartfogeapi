import { z } from 'zod'

// Enums
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export const MessageTypeSchema = z.enum(['text', 'image', 'file', 'code', 'result', 'error'])

// Fragment schema (updated to match the correct structure)
export const FragmentSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  sandbox_url: z.string().url(),
  title: z.string(),
  content: z.string(),
  order_index: z.number(),
  files: z.record(z.string(), z.any()), // JSONB field for file paths/content
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Input schemas
export const MessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  type: MessageTypeSchema.default('text'),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Message with optional fragments
export const MessageWithFragmentsSchema = MessageSchema.extend({
  fragments: z.array(FragmentSchema).optional(),
})

export const CreateMessageInputSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1, 'Content is required'),
  type: MessageTypeSchema.default('text'),
  metadata: z.record(z.any()).optional(),
})

// Alias for router compatibility
export const CreateMessageSchema = CreateMessageInputSchema

export const UpdateMessageInputSchema = z.object({
  content: z.string().min(1, 'Content is required').optional(),
  type: MessageTypeSchema.optional(),
  metadata: z.record(z.any()).optional(),
})

// Router compatibility aliases
export const UpdateMessageSchema = z.object({
  id: z.string().uuid(),
}).merge(UpdateMessageInputSchema)

export const GetMessageSchema = z.object({
  id: z.string().uuid(),
})

export const GetMessagesSchema = z.object({
  limit: z.number().min(1).max(100).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
  role: MessageRoleSchema.optional(),
  type: MessageTypeSchema.optional(),
  includeFragment: z.boolean().default(false).optional(),
})

// Fragment schemas
export const CreateFragmentInputSchema = z.object({
  message_id: z.string().uuid(),
  content: z.string().min(1, 'Content is required'),
  fragment_type: z.string().min(1, 'Fragment type is required'),
  order_index: z.number().int().min(0).default(0),
  metadata: z.record(z.any()).optional(),
})

export const UpdateFragmentInputSchema = z.object({
  content: z.string().min(1, 'Content is required').optional(),
  fragment_type: z.string().min(1, 'Fragment type is required').optional(),
  order_index: z.number().int().min(0).optional(),
  metadata: z.record(z.any()).optional(),
})

// TypeScript types
export type MessageRole = z.infer<typeof MessageRoleSchema>
export type MessageType = z.infer<typeof MessageTypeSchema>
export type Message = z.infer<typeof MessageSchema>
export type MessageWithFragments = z.infer<typeof MessageWithFragmentsSchema>
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>
export type UpdateMessageInput = z.infer<typeof UpdateMessageInputSchema>
export type GetMessageInput = z.infer<typeof GetMessageSchema>
export type GetMessagesInput = z.infer<typeof GetMessagesSchema>

export type Fragment = z.infer<typeof FragmentSchema>
export type CreateFragmentInput = z.infer<typeof CreateFragmentInputSchema>
export type UpdateFragmentInput = z.infer<typeof UpdateFragmentInputSchema>

// SaveResult functionality types
export const SaveResultInputSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  role: MessageRoleSchema.default('assistant'),
  type: MessageTypeSchema.default('result'),
  sandboxUrl: z.string().url('Valid sandbox URL is required'),
  title: z.string().min(1, 'Title is required').default('fragment'),
  files: z.record(z.string(), z.any()).default({}),
})

export const SaveResultResponseSchema = z.object({
  message: MessageSchema,
  fragment: z.object({
    id: z.string().uuid(),
    message_id: z.string().uuid(),
    sandbox_url: z.string().url(),
    title: z.string(),
    content: z.string(),
    order_index: z.number(),
    files: z.record(z.string(), z.any()),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  }),
})

export type SaveResultInput = z.infer<typeof SaveResultInputSchema>
export type SaveResultResponse = z.infer<typeof SaveResultResponseSchema>