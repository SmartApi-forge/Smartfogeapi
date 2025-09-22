import { messageOperations } from '../../../lib/supabase-server'
import type { 
  CreateMessageInput, 
  UpdateMessageInput, 
  GetMessageInput, 
  GetMessagesInput,
  Message,
  MessageRole,
  MessageType
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
      throw new Error(`Failed to create message: ${errorMessage}`)
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
      throw new Error('Message not found')
    }
  }

  /**
   * Get all messages with optional filtering and pagination
   */
  static async getAll(input: GetMessagesInput): Promise<Message[]> {
    try {
      // Use server-side filtering and pagination
      const messages = await messageOperations.getAll({
        role: input.role,
        type: input.type,
        limit: input.limit,
        offset: input.offset
      })
      
      return messages
    } catch (error) {
      console.error('Error getting messages:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to get messages: ${errorMessage}`)
    }
  }

  /**
   * Update a message
   */
  static async update(input: UpdateMessageInput): Promise<Message> {
    try {
      const { id, ...updateData } = input
      const message = await messageOperations.update(id, updateData)
      return message
    } catch (error) {
      console.error('Error updating message:', error)
      throw new Error('Failed to update message')
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
      throw new Error('Failed to delete message')
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
      throw new Error(`Failed to get message count: ${errorMessage}`)
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
      throw new Error(`Failed to get recent messages: ${errorMessage}`)
    }
  }

  /**
   * Get messages by role with pagination
   */
  static async getByRole(input: { role: MessageRole; limit: number; offset: number }): Promise<Message[]> {
    try {
      return await this.getAll({
        role: input.role,
        limit: input.limit,
        offset: input.offset
      })
    } catch (error) {
      console.error('Error getting messages by role:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to get messages by role: ${errorMessage}`)
    }
  }

  /**
   * Get messages by type with pagination
   */
  static async getByType(input: { type: MessageType; limit: number; offset: number }): Promise<Message[]> {
    try {
      return await this.getAll({
        type: input.type,
        limit: input.limit,
        offset: input.offset
      })
    } catch (error) {
      console.error('Error getting messages by type:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to get messages by type: ${errorMessage}`)
    }
  }
}