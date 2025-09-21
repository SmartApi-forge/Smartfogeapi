import { fragmentOperations } from '../../../lib/supabase-server'
import type { 
  CreateFragmentInput, 
  UpdateFragmentInput, 
  GetFragmentInput, 
  GetFragmentsByMessageInput,
  GetFragmentsInput,
  UpdateFragmentFilesInput,
  Fragment 
} from './types'

export class FragmentService {
  /**
   * Create a new fragment
   */
  static async create(input: CreateFragmentInput): Promise<Fragment> {
    try {
      const fragment = await fragmentOperations.create(input)
      return fragment
    } catch (error) {
      console.error('Error creating fragment:', error)
      throw new Error('Failed to create fragment')
    }
  }

  /**
   * Get a fragment by ID
   */
  static async getById(input: GetFragmentInput): Promise<Fragment> {
    try {
      const fragment = await fragmentOperations.getById(input.id)
      return fragment
    } catch (error) {
      console.error('Error getting fragment:', error)
      throw new Error('Fragment not found')
    }
  }

  /**
   * Get fragments by message ID
   */
  static async getByMessageId(input: GetFragmentsByMessageInput): Promise<Fragment[]> {
    try {
      const allFragments = await fragmentOperations.getByMessageId(input.message_id)
      
      // Apply pagination
      const startIndex = input.offset || 0
      const endIndex = startIndex + (input.limit || 20)
      
      return allFragments.slice(startIndex, endIndex)
    } catch (error) {
      console.error('Error getting fragments by message ID:', error)
      throw new Error('Failed to get fragments')
    }
  }

  /**
   * Get all fragments with optional filtering and pagination
   */
  static async getAll(input: GetFragmentsInput): Promise<Fragment[]> {
    try {
      let fragments: Fragment[]

      if (input.message_id) {
        // Get fragments for specific message
        fragments = await fragmentOperations.getByMessageId(input.message_id)
      } else {
        // This would require a new method in fragmentOperations to get all fragments
        // For now, we'll throw an error as the current implementation doesn't support this
        throw new Error('Getting all fragments without message_id is not currently supported')
      }

      // Apply pagination
      const startIndex = input.offset || 0
      const endIndex = startIndex + (input.limit || 20)
      
      return fragments.slice(startIndex, endIndex)
    } catch (error) {
      console.error('Error getting fragments:', error)
      throw new Error('Failed to get fragments')
    }
  }

  /**
   * Update a fragment
   */
  static async update(input: UpdateFragmentInput): Promise<Fragment> {
    try {
      const { id, ...updateData } = input
      const fragment = await fragmentOperations.update(id, updateData)
      return fragment
    } catch (error) {
      console.error('Error updating fragment:', error)
      throw new Error('Failed to update fragment')
    }
  }

  /**
   * Update fragment files specifically
   */
  static async updateFiles(input: UpdateFragmentFilesInput): Promise<Fragment> {
    try {
      const fragment = await fragmentOperations.update(input.id, { files: input.files })
      return fragment
    } catch (error) {
      console.error('Error updating fragment files:', error)
      throw new Error('Failed to update fragment files')
    }
  }

  /**
   * Delete a fragment
   */
  static async delete(input: GetFragmentInput): Promise<void> {
    try {
      await fragmentOperations.delete(input.id)
    } catch (error) {
      console.error('Error deleting fragment:', error)
      throw new Error('Failed to delete fragment')
    }
  }

  /**
   * Get fragment count for a message
   */
  static async getCountByMessage(messageId: string): Promise<number> {
    try {
      const fragments = await fragmentOperations.getByMessageId(messageId)
      return fragments.length
    } catch (error) {
      console.error('Error getting fragment count:', error)
      throw new Error('Failed to get fragment count')
    }
  }

  /**
   * Get the latest fragment for a message
   */
  static async getLatestByMessage(messageId: string): Promise<Fragment | null> {
    try {
      const fragments = await fragmentOperations.getByMessageId(messageId)
      return fragments.length > 0 ? fragments[0] : null // Already sorted by created_at desc
    } catch (error) {
      console.error('Error getting latest fragment:', error)
      throw new Error('Failed to get latest fragment')
    }
  }

  /**
   * Check if a fragment exists
   */
  static async exists(fragmentId: string): Promise<boolean> {
    try {
      await fragmentOperations.getById(fragmentId)
      return true
    } catch (error) {
      return false
    }
  }
}