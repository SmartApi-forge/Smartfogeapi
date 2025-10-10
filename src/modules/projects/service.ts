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
}