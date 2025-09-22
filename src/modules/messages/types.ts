import { z } from 'zod'

// Enums matching database schema
export const MessageRoleSchema = z.enum(['user', 'assistant'])
export const MessageTypeSchema = z.enum(['result', 'error'])

// Base message schema
export const MessageSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  role: MessageRoleSchema,
  type: MessageTypeSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Input schemas for TRPC procedures
export const CreateMessageSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  role: MessageRoleSchema.optional(),
  type: MessageTypeSchema.optional(),
})

export const UpdateMessageSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1, 'Content is required').optional(),
  role: MessageRoleSchema.optional(),
  type: MessageTypeSchema.optional(),
})

export const GetMessageSchema = z.object({
  id: z.string().uuid(),
})

export const GetMessagesSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  role: MessageRoleSchema.optional(),
  type: MessageTypeSchema.optional(),
})

// TypeScript types
export type MessageRole = z.infer<typeof MessageRoleSchema>
export type MessageType = z.infer<typeof MessageTypeSchema>
export type Message = z.infer<typeof MessageSchema>
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>
export type GetMessageInput = z.infer<typeof GetMessageSchema>
export type GetMessagesInput = z.infer<typeof GetMessagesSchema>