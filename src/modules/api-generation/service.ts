import { createClient } from '@supabase/supabase-js'
import { TRPCError } from '@trpc/server'
import { inngest } from '../../inngest/client'
import type { 
  GenerateAPIInput, 
  GenerateAPIResponse, 
  Project, 
  JobStatus, 
  Template, 
  DeleteProjectResponse 
} from './types'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class ApiGenerationService {
  /**
   * Generate a new API from prompt
   */
  async generateAPI(input: GenerateAPIInput, userId: string): Promise<GenerateAPIResponse> {
    try {
      // Create project record using Supabase MCP
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: `API from prompt: ${input.prompt.substring(0, 50)}...`,
          description: input.prompt,
          prompt: input.prompt,
          framework: input.framework,
          advanced: input.advanced,
          status: 'generating'
        })
        .select()
        .single()

      if (projectError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create project'
        })
      }

      // Create job record using Supabase MCP
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          project_id: project.id,
          user_id: userId,
          type: 'generate_api',
          status: 'pending',
          payload: {
            prompt: input.prompt,
            framework: input.framework,
            advanced: input.advanced,
            template: input.template
          }
        })
        .select()
        .single()

      if (jobError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create job'
        })
      }

      // Trigger Inngest workflow for API generation
      await inngest.send({
        name: "api/generate",
        data: {
          jobId: job.id,
          projectId: project.id,
          prompt: input.prompt,
          framework: input.framework,
          advanced: input.advanced,
          template: input.template,
          userId: userId
        }
      });
      
      return {
        jobId: job.id,
        projectId: project.id,
        status: 'generating' as const,
        message: 'API generation started',
        estimatedTime: 60, // seconds
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to start API generation',
        cause: error
      })
    }
  }

  /**
   * Get all projects for authenticated user
   */
  async getProjects(userId: string): Promise<Project[]> {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch projects'
        })
      }

      return projects || []
    } catch (error) {
      console.error('Error fetching projects:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch projects'
      })
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string, userId: string): Promise<Project> {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
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
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch project'
      })
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string, userId: string): Promise<DeleteProjectResponse> {
    try {
      // Delete project from database
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId)

      if (error) throw error

      // TODO: Cleanup deployed resources (Vercel deployment, etc.)
      return { success: true, message: 'Project deleted successfully' }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete project',
        cause: error
      })
    }
  }

  /**
   * Get job status for tracking generation progress
   */
  async getJobStatus(jobId: string, userId: string): Promise<JobStatus> {
    try {
      // Get job from database
      const { data: job, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single()

      if (error || !job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' })
      }

      // Calculate progress based on job status and timestamps
      let progress = 0
      let currentStep = 'Initializing'
      let estimatedTimeRemaining = 60

      switch (job.status) {
        case 'pending':
          progress = 10
          currentStep = 'Queued for processing'
          break
        case 'running':
          progress = 50
          currentStep = 'Generating API specification'
          estimatedTimeRemaining = 30
          break
        case 'completed':
          progress = 100
          currentStep = 'Generation completed'
          estimatedTimeRemaining = 0
          break
        case 'failed':
          progress = 0
          currentStep = 'Generation failed'
          estimatedTimeRemaining = 0
          break
      }

      return {
        jobId: jobId,
        status: job.status,
        progress: progress,
        currentStep: currentStep,
        estimatedTimeRemaining: estimatedTimeRemaining,
        error_message: job.error_message,
        result: job.result,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch job status',
        cause: error
      })
    }
  }

  /**
   * Get available templates
   */
  async getTemplates(): Promise<Template[]> {
    try {
      const { data: templates, error } = await supabase
        .from('templates')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch templates'
        })
      }

      return templates || []
    } catch (error) {
      console.error('Error fetching templates:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch templates'
      })
    }
  }

  async cancelJob(jobId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single()

      if (fetchError || !job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Job not found'
        })
      }

      if (job.status === 'completed' || job.status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel a job that is already completed or cancelled'
        })
      }

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel job'
        })
      }

      return {
        success: true,
        message: 'Job cancelled successfully'
      }
    } catch (error) {
      console.error('Error cancelling job:', error)
      if (error instanceof TRPCError) throw error
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to cancel job'
      })
    }
  }

  async retryJob(jobId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single()

      if (fetchError || !job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Job not found'
        })
      }

      if (job.status !== 'failed' && job.status !== 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only retry failed or cancelled jobs'
        })
      }

      // Update job status to pending
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update job status'
        })
      }

      // Trigger the job again via Inngest
      await inngest.send({
        name: `api/${job.type.replace('_', '/')}`,
        data: {
          ...job.payload,
          jobId: job.id,
          projectId: job.project_id,
          userId: job.user_id,
          isRetry: true
        }
      })

      return {
        success: true,
        message: 'Job retry triggered successfully'
      }
    } catch (error) {
      console.error('Error retrying job:', error)
      if (error instanceof TRPCError) throw error
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retry job'
      })
    }
  }
}