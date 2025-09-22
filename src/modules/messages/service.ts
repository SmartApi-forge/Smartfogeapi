import { TRPCError } from '@trpc/server'
import { messageOperations, fragmentOperations, supabaseAdmin } from '../../../lib/supabase-server'
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
import type { AgentState, AIResult } from '../../inngest/types'

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
      throw new Error(`Failed to get messages: ${errorMessage}`)
    }
  }

  /**
   * Update a message
   */
  static async update(id: string, input: UpdateMessageInput): Promise<Message> {
    try {
      const message = await messageOperations.update(id, input)
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
   * Get messages with their related fragments
   */
  static async getMany(input: { limit?: number; includeFragment?: boolean }): Promise<Message[] | MessageWithFragments[]> {
    try {
      if (input.includeFragment) {
        const messages = await messageOperations.getWithFragments({
          limit: input.limit ?? 50,
          offset: 0
        })
        return messages
      } else {
        const messages = await messageOperations.getAll({
          limit: input.limit ?? 50,
          offset: 0
        })
        return messages
      }
    } catch (error) {
      console.error('Error getting messages:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to get messages: ${errorMessage}`)
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

  /**
   * Save AI assistant result with message and fragment
   * Creates a message and associated fragment in a transaction-like manner
   * Includes error detection for AI results
   */
  static async saveResult(input: SaveResultInput): Promise<SaveResultResponse> {
    try {
      // Create the message first
      const message = await messageOperations.create({
        content: input.content,
        role: input.role,
        type: input.type
      })

      // Create the associated fragment
      const fragment = await fragmentOperations.create({
        message_id: message.id,
        sandbox_url: input.sandboxUrl,
        title: input.title,
        files: input.files
      })

      return {
        message,
        fragment
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

  /**
   * Save AI result with error detection and proper typing
   * Handles AI-generated results from network with error checking
   */
  static async saveAIResult(result: AIResult, jobId?: string): Promise<void> {
    try {
      // Error detection logic
      const isError = !result.state.data.summary || !Object.keys(result.state.data.files ?? {}).length;
      
      if (isError) {
        // Save error message to Supabase without creating fragments
        const { error } = await supabaseAdmin
          .from('messages')
          .insert({
            content: 'Something went wrong. Please try again.',
            role: 'assistant' as const,
            type: 'error' as const
          });
          
        if (error) {
          console.error('Failed to save error message:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to save error message',
            cause: error
          });
        }
        
        return; // Return early - do not create fragments
      }
      
      // If no error, save the AI result with fragments
      const agentState: AgentState = result.state.data;
      
      // Create message for successful AI result
      const { data: message, error: messageError } = await supabaseAdmin
        .from('messages')
        .insert({
          content: agentState.summary,
          role: 'assistant' as const,
          type: 'result' as const
        })
        .select()
        .single();
        
      if (messageError) {
        console.error('Failed to save AI result message:', messageError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save AI result message',
          cause: messageError
        });
      }
      
      // Create fragments for each file
       const fragmentInserts = Object.entries(agentState.files).map(([path, content]) => ({
         message_id: message.id,
         sandbox_url: '',
         title: path,
         files: { [path]: content }
       }));
      
      if (fragmentInserts.length > 0) {
        const { error: fragmentError } = await supabaseAdmin
          .from('fragments')
          .insert(fragmentInserts);
          
        if (fragmentError) {
          console.error('Failed to save fragments:', fragmentError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to save fragments',
            cause: fragmentError
          });
        }
      }
      
    } catch (error) {
      console.error('Error in saveAIResult:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save AI result',
        cause: error
      });
    }
  }
}