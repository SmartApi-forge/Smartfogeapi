import { createClient } from '@supabase/supabase-js'
import { TRPCError } from '@trpc/server'
import type { 
  Project,
  GetProjectInput,
  GetProjectsInput
} from './types'

// Environment validation
function validateEnvironmentVariables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  return { supabaseUrl, serviceRoleKey }
}

const { supabaseUrl, serviceRoleKey } = validateEnvironmentVariables()
const supabase = createClient(supabaseUrl, serviceRoleKey)

export class ProjectService {
  /**
   * Get project by ID using findUnique pattern
   * Includes automatic status correction for completed workflows
   */
  static async getOne(input: GetProjectInput, userId: string): Promise<Project> {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', input.id)
        .eq('user_id', userId)
        .single()

      if (error || !project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found'
        })
      }

      // FALLBACK FIX: If project status is 'generating' but workflow completed, fix it
      if (project.status === 'generating' && project.github_mode) {
        const { data: completeEvent } = await supabase
          .from('generation_events')
          .select('id, event_type, message')
          .eq('project_id', input.id)
          .eq('event_type', 'complete')
          .maybeSingle()

        if (completeEvent) {
          console.log(`[ProjectService] Detected completed workflow for stuck project ${input.id}, fixing status...`)
          
          // Update project status to deployed
          const { error: updateError } = await supabase
            .from('projects')
            .update({ 
              status: 'deployed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', input.id)

          if (!updateError) {
            project.status = 'deployed'
            console.log(`[ProjectService] ✅ Fixed project ${input.id} status to deployed`)
          } else {
            console.error(`[ProjectService] ❌ Failed to fix project status:`, updateError)
          }
        }
      }

      return project
    } catch (error) {
      console.error('Error fetching project:', error)
      
      // Re-throw TRPCError if it's already a TRPCError
      if (error instanceof TRPCError) {
        throw error
      }
      
      // Otherwise wrap in TRPCError
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch project'
      })
    }
  }

  /**
   * Get all projects for authenticated user
   */
  static async getMany(input: GetProjectsInput, userId: string): Promise<Project[]> {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 20) - 1)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch projects'
        })
      }

      return projects || []
    } catch (error) {
      console.error('Error fetching projects:', error)
      
      // Re-throw TRPCError if it's already a TRPCError
      if (error instanceof TRPCError) {
        throw error
      }
      
      // Otherwise wrap in TRPCError
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch projects'
      })
    }
  }

  /**
   * Update project fields (for GitHub integration)
   */
  static async update(
    projectId: string, 
    userId: string,
    updates: Record<string, any>
  ): Promise<Project> {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', userId)
        .select('*')
        .single()

      if (error || !project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or update failed'
        })
      }

      return project
    } catch (error) {
      console.error('Error updating project:', error)
      
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update project'
      })
    }
  }
}