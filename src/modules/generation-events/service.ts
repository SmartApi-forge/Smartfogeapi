import { supabaseServer } from '../../../lib/supabase-server'
import { TRPCError } from '@trpc/server'
import type { CreateGenerationEventInput, GetGenerationEventsInput } from './types'

export class GenerationEventService {
  /**
   * Create a new generation event
   */
  static async create(input: CreateGenerationEventInput) {
    const { data, error } = await supabaseServer
      .from('generation_events')
      .insert({
        project_id: input.project_id,
        event_type: input.event_type,
        filename: input.filename,
        message: input.message,
        icon: input.icon,
        timestamp: input.timestamp || new Date().toISOString(),
        metadata: input.metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating generation event:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create generation event',
        cause: error
      })
    }

    return data
  }

  /**
   * Get all generation events for a project
   */
  static async getMany(input: GetGenerationEventsInput) {
    const { projectId, limit = 50 } = input

    const { data, error } = await supabaseServer
      .from('generation_events')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching generation events:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch generation events',
        cause: error
      })
    }

    return data || []
  }

  /**
   * Delete all generation events for a project
   */
  static async deleteByProject(projectId: string) {
    const { error } = await supabaseServer
      .from('generation_events')
      .delete()
      .eq('project_id', projectId)

    if (error) {
      console.error('Error deleting generation events:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete generation events',
        cause: error
      })
    }

    return { success: true }
  }
}

