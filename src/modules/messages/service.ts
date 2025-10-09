import { messageOperations, fragmentOperations } from '../../../lib/supabase-server'
import { projectService } from '../../services/database'
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
   * Create a new message and optionally create a project if it's a user message without project_id
   */
  static async create(input: CreateMessageInput, userId?: string): Promise<Message> {
    try {
      let projectId = input.project_id

      // If no project_id provided and this is a user message, create a new project
       if (!projectId && input.role === 'user' && userId) {
         const newProject = await projectService.createProject({
           name: `Project ${new Date().toISOString()}`,
           description: input.content.substring(0, 100) + '...',
           prompt: input.content,
           status: 'generating',
           framework: 'fastapi',
           user_id: userId
         })
         projectId = newProject.id
       }

      const messageData = {
        ...input,
        project_id: projectId
      }

      const message = await messageOperations.create(messageData)
      return message
    } catch (error) {
      console.error('Error creating message:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create message',
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
  static async getMany(input: { projectId: string; limit?: number; includeFragment?: boolean }): Promise<(Message & { fragments: any[] })[]> {
    try {
      const messages = await messageOperations.getWithFragments({
        projectId: input.projectId,
        limit: input.limit ?? 50,
        offset: 0,
        includeFragment: input.includeFragment
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
   * Save AI assistant result as a message
   * Creates a message with proper error handling and optionally creates a fragment
   */
  /**
   * Save a result message with optional fragment and project association
   */
  static async saveResult(input: SaveResultInput & {
    user_id?: string;
    fragment?: {
      title?: string
      sandbox_url?: string
      files?: Record<string, any>
      fragment_type?: string
      content?: string
      metadata?: Record<string, any>
    }
  }): Promise<SaveResultResponse & { fragment?: any }> {
    try {
      let projectId = input.project_id

      // If this is a user message without a project_id, create a new project
      if (input.role === 'user' && !projectId && input.user_id) {
        try {
          const project = await projectService.createProject({
            user_id: input.user_id,
            name: `Project: ${input.content.substring(0, 50)}${input.content.length > 50 ? '...' : ''}`,
            description: `Project created from user message: ${input.content.substring(0, 100)}${input.content.length > 100 ? '...' : ''}`,
            prompt: input.content,
            status: 'generating',
            framework: 'fastapi', // Default framework
            advanced: false
          })
          projectId = project.id
        } catch (projectError) {
          console.error('Error creating project for message:', projectError)
          // Continue without project_id if project creation fails
        }
      }

      // Create the message
      const createdMessage = await messageOperations.create({
        content: input.content,
        role: input.role,
        type: input.type,
        sender_id: input.sender_id,
        receiver_id: input.receiver_id,
        project_id: projectId
      })

      let createdFragment = undefined

      // Create fragment if fragment data is provided
      if (input.fragment) {
        try {
          createdFragment = await fragmentOperations.create({
            message_id: createdMessage.id,
            content: input.content, // Use message content for fragment content
            sandbox_url: input.fragment.sandbox_url || 'https://example.com/sandbox',
            title: input.fragment.title || 'AI Generated Response',
            files: input.fragment.files || {},
            order_index: input.fragment.order_index || 0,
            project_id: projectId
          })
        } catch (fragmentError) {
          console.error('Error creating fragment:', fragmentError)
          // Don't throw error here - message creation succeeded, fragment is optional
          // But log the error for debugging
        }
      }

      return {
        message: createdMessage,
        fragment: createdFragment
      }
    } catch (error) {
      console.error('Error saving result:', error)
      
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