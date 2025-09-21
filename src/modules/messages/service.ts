import { messageOperations } from '../../../lib/supabase-server'
import type { 
  CreateMessageInput, 
  UpdateMessageInput, 
  GetMessageInput, 
  GetMessagesInput,
  Message 
} from './types'

export class MessageService {
  /**
   * Create a new message
   */
  static async create(input: CreateMessageInput): Promise<Message> {
    try {
      const message = await messageOperations.create(input)
      return message
    } catch (error) {
      console.error('Error creating message:', error)
      throw new Error('Failed to create message')
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
      // For now, get all messages and apply client-side filtering
      // In production, you'd want to implement server-side filtering in Supabase
      const allMessages = await messageOperations.getAll()
      
      let filteredMessages = allMessages

      // Apply role filter if provided
      if (input.role) {
        filteredMessages = filteredMessages.filter(msg => msg.role === input.role)
      }

      // Apply type filter if provided
      if (input.type) {
        filteredMessages = filteredMessages.filter(msg => msg.type === input.type)
      }

      // Apply pagination
      const startIndex = input.offset || 0
      const endIndex = startIndex + (input.limit || 20)
      
      return filteredMessages.slice(startIndex, endIndex)
    } catch (error) {
      console.error('Error getting messages:', error)
      throw new Error('Failed to get messages')
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
      const allMessages = await messageOperations.getAll()
      
      let filteredMessages = allMessages
      
      if (filters?.role) {
        filteredMessages = filteredMessages.filter(msg => msg.role === filters.role)
      }
      
      if (filters?.type) {
        filteredMessages = filteredMessages.filter(msg => msg.type === filters.type)
      }
      
      return filteredMessages.length
    } catch (error) {
      console.error('Error getting message count:', error)
      throw new Error('Failed to get message count')
    }
  }

  /**
   * Get recent messages with pagination
   */
  static async getRecent(input: { limit: number; offset: number }): Promise<Message[]> {
    try {
      const allMessages = await messageOperations.getAll()
      // Sort by created_at descending (most recent first)
      const sortedMessages = allMessages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      
      return sortedMessages.slice(input.offset, input.offset + input.limit)
    } catch (error) {
      console.error('Error getting recent messages:', error)
      throw new Error('Failed to get recent messages')
    }
  }

  /**
   * Get messages by role with pagination
   */
  static async getByRole(input: { role: string; limit: number; offset: number }): Promise<Message[]> {
    try {
      const allMessages = await messageOperations.getAll()
      const filteredMessages = allMessages.filter(msg => msg.role === input.role)
      
      return filteredMessages.slice(input.offset, input.offset + input.limit)
    } catch (error) {
      console.error('Error getting messages by role:', error)
      throw new Error('Failed to get messages by role')
    }
  }

  /**
   * Get messages by type with pagination
   */
  static async getByType(input: { type: string; limit: number; offset: number }): Promise<Message[]> {
    try {
      const allMessages = await messageOperations.getAll()
      const filteredMessages = allMessages.filter(msg => msg.type === input.type)
      
      return filteredMessages.slice(input.offset, input.offset + input.limit)
    } catch (error) {
      console.error('Error getting messages by type:', error)
      throw new Error('Failed to get messages by type')
    }
  }
}