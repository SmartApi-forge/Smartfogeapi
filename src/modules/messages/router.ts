import { z } from 'zod'
import { createTRPCRouter, baseProcedure } from '../../trpc/init'
import { MessageService } from './service'
import { inngest } from '../../inngest/client'
import { createClient } from '@supabase/supabase-js'
import {
  CreateMessageSchema,
  UpdateMessageSchema,
  GetMessageSchema,
  GetMessagesSchema,
} from './types'

// Initialize Supabase client for direct database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const messagesRouter = createTRPCRouter({
  /**
   * Create a new message
   */
  create: baseProcedure
    .input(CreateMessageSchema)
    .mutation(async ({ input }) => {
      // Destructure the input like in the YouTube tutorial
      const { content, role, type } = input
      
      // Create a new message using Supabase (instead of Prisma)
      const { data: createdMessage, error } = await supabase
        .from('messages')
        .insert({
          content: content,
          role: role || 'user',  // Default to 'user' like in tutorial
          type: type || 'result' // Default to 'result' like in tutorial
        })
        .select()
        .single()
        
      if (error) {
        throw new Error(`Failed to create message: ${error.message}`)
      }
      
      // Invoke background job like in the YouTube tutorial
      await inngest.send({
        name: "message/created",
        data: {
          messageId: createdMessage.id,
          content: createdMessage.content,
          role: createdMessage.role,
          type: createdMessage.type
        }
      })
      
      // Return the created message as API response
      return createdMessage
    }),

  /**
   * Get a message by ID
   */
  getById: baseProcedure
    .input(GetMessageSchema)
    .query(async ({ input }) => {
      return await MessageService.getById(input)
    }),

  /**
   * Get all messages with pagination and filtering
   */
  getAll: baseProcedure
    .input(GetMessagesSchema)
    .query(async ({ input }) => {
      const params = {
        limit: input.limit ?? 10,
        offset: input.offset ?? 0,
        role: input.role,
        type: input.type
      }
      return await MessageService.getAll(params)
    }),

  /**
   * Update a message
   */
  update: baseProcedure
    .input(UpdateMessageSchema)
    .mutation(async ({ input }) => {
      return await MessageService.update(input)
    }),

  /**
   * Delete a message
   */
  delete: baseProcedure
    .input(GetMessageSchema)
    .mutation(async ({ input }) => {
      return await MessageService.delete(input)
    }),

  /**
   * Get message count with optional filtering
   */
  getCount: baseProcedure
    .input(z.object({
      role: z.enum(['user', 'assistant']).optional(),
      type: z.enum(['result', 'error']).optional(),
    }))
    .query(async ({ input }) => {
      return await MessageService.getCount(input)
    }),

  getRecent: baseProcedure
    .input(z.object({
      limit: z.number().optional(),
      offset: z.number().optional()
    }))
    .query(async ({ input }) => {
      const params = {
        limit: input.limit ?? 10,
        offset: input.offset ?? 0
      }
      return await MessageService.getRecent(params)
    }),

  // Get messages by role
  getByRole: baseProcedure
    .input(z.object({
      role: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional()
    }))
    .query(async ({ input }) => {
      const params = {
        role: input.role,
        limit: input.limit ?? 10,
        offset: input.offset ?? 0
      }
      return await MessageService.getByRole(params)
    }),

  // Get messages by type
  getByType: baseProcedure
    .input(z.object({
      type: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional()
    }))
    .query(async ({ input }) => {
      const params = {
        type: input.type,
        limit: input.limit ?? 10,
        offset: input.offset ?? 0
      }
      return await MessageService.getByType(params)
    }),
})