import { messageOperations, fragmentOperations } from '../../../lib/supabase-server'
import { TRPCError } from '@trpc/server'
import type { 
  CreateMessageInput, 
  UpdateMessageInput, 
  GetMessageInput, 
  GetMessagesInput,
  Message,
  MessageWithFragments,
  MessageRole,
  MessageType,
  SaveResultInput,
  SaveResultResponse
} from './types'

export class MessageService {
  /**
   * Create a new message
   */
  static async create(input: CreateMessageInput): Promise<Message> {
    try {
      // Apply defaults for role and type like the original router
      const messageData = {
        content: input.content,
        role: input.role || 'user' as const,
        type: input.type || 'result' as const
      }
      const message = await messageOperations.create(messageData)
      return message
    } catch (error) {
      console.error('Error creating message:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to create message: ${errorMessage}`,
        cause: error
      })
    }
  }

  /**
   * Get a message by ID
   */
  static async getById(input: GetMessageInput): Promise<Message> {
    try {
      const message = await messageOperations.getById(input.id)
      return message
    } catch (error) {
      console.error('Error getting message:', error)
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Message not found',
        cause: error
      })
    }
  }

  /**
   * Get all messages with optional filtering and pagination
   */
  static async getAll(input: GetMessagesInput): Promise<Message[] | MessageWithFragments[]> {
    try {
      // Use server-side filtering and pagination
      const messages = await messageOperations.getAll({
        role: input.role,
        type: input.type,
        limit: input.limit,
        offset: input.offset,
        includeFragment: input.includeFragment
      })
      
      return messages
    } catch (error) {
      console.error('Error getting messages:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to get messages: ${errorMessage}`,
        cause: error
      })
    }
  }

  /**
   * Update a message
   */
  static async update(input: UpdateMessageInput & { id: string }): Promise<Message> {
    try {
      const { id, ...updateData } = input
      const message = await messageOperations.update(id, updateData)
      return message
    } catch (error) {
      console.error('Error updating message:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update message',
        cause: error
      })
    }
  }

  /**
   * Delete a message
   */
  static async delete(input: GetMessageInput): Promise<void> {
    try {
      await messageOperations.delete(input.id)
    } catch (error) {
      console.error('Error deleting message:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete message',
        cause: error
      })
    }
  }

  /**
   * Get count of messages with optional filtering
   */
  static async getCount(filters?: { role?: string; type?: string }): Promise<number> {
    try {
      return await messageOperations.getCount(filters as { role?: 'user' | 'assistant'; type?: 'result' | 'error' })
    } catch (error) {
      console.error('Error getting message count:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to get message count: ${errorMessage}`,
        cause: error
      })
    }
  }

  /**
   * Get messages with their related fragments
   */
  static async getMany(input: { limit?: number }): Promise<(Message & { fragments: any[] })[]> {
    try {
      const messages = await messageOperations.getWithFragments({
        limit: input.limit ?? 50,
        offset: 0
      })
      
      return messages
    } catch (error) {
      console.error('Error getting messages with fragments:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to get messages: ${errorMessage}`,
        cause: error
      })
    }
  }

  /**
   * Get recent messages with pagination
   */
  static async getRecent(input: { limit: number; offset: number }): Promise<Message[]> {
    try {
      return await messageOperations.getRecent(input.limit, input.offset)
    } catch (error) {
      console.error('Error getting recent messages:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to get recent messages: ${errorMessage}`,
        cause: error
      })
    }
  }

  /**
   * Get messages by role with pagination
   */
  static async getByRole(input: { role: MessageRole; limit: number; offset: number }): Promise<Message[]> {
    try {
      const result = await this.getAll({
        role: input.role,
        limit: input.limit,
        offset: input.offset,
        includeFragment: false // Explicitly set to false to ensure Message[] return type
      })
      // Type assertion is safe because includeFragment is false
      return result as Message[]
    } catch (error) {
      console.error('Error getting messages by role:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to get messages by role: ${errorMessage}`,
        cause: error
      })
    }
  }

  /**
   * Get messages by type with pagination
   */
  static async getByType(input: { type: MessageType; limit: number; offset: number }): Promise<Message[]> {
    try {
      const result = await this.getAll({
        type: input.type,
        limit: input.limit,
        offset: input.offset,
        includeFragment: false // Explicitly set to false to ensure Message[] return type
      })
      // Type assertion is safe because includeFragment is false
      return result as Message[]
    } catch (error) {
      console.error('Error getting messages by type:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to get messages by type: ${errorMessage}`,
        cause: error
      })
    }
  }

  /**
   * Save AI assistant result with message and fragment
   * Creates a message and associated fragment with proper error handling and cleanup
   * Ensures atomicity by rolling back message creation if fragment creation fails
   */
  static async saveResult(input: SaveResultInput): Promise<SaveResultResponse> {
    let createdMessage: Message | null = null
    
    try {
      // Create the message first
      createdMessage = await messageOperations.create({
        content: input.content,
        role: input.role,
        type: input.type
      })

      // Create the associated fragment
      const fragment = await fragmentOperations.create({
        message_id: createdMessage.id,
        sandbox_url: input.sandboxUrl,
        title: input.title,
        content: input.content,
        order_index: 0,
        files: input.files
      })

      return {
        message: createdMessage,
        fragment
      }
    } catch (error) {
      console.error('Error saving result:', error)
      
      // Cleanup: If message was created but fragment creation failed, delete the message
      if (createdMessage) {
        try {
          await messageOperations.delete(createdMessage.id)
          console.log(`Cleaned up orphaned message with ID: ${createdMessage.id}`)
        } catch (cleanupError) {
          console.error('Failed to cleanup orphaned message:', cleanupError)
          // Continue with original error - cleanup failure shouldn't mask the original issue
        }
      }
      
      // Throw TRPCError for proper error handling in tRPC context
      if (error instanceof Error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save result: ${error.message}`,
          cause: error
        })
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save result: Unknown error occurred'
      })
    }
  }
}