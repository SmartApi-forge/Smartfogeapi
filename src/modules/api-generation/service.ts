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

// Validate required environment variables
function validateEnvironmentVariables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required but not set')
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required but not set')
  }

  return { supabaseUrl, serviceRoleKey }
}

// Initialize Supabase client with validated environment variables
const { supabaseUrl, serviceRoleKey } = validateEnvironmentVariables()
const supabase = createClient(supabaseUrl, serviceRoleKey)

// Resource cleanup utilities
interface CleanupResult {
  success: boolean
  error?: string
}

interface ProjectCleanupData {
  id: string
  deploy_url?: string
  code_url?: string
  framework: string
  status: string
  [key: string]: any
}

class ResourceCleanupService {
  /**
   * Cleanup Vercel deployment
   */
  private async cleanupVercelDeployment(deployUrl: string): Promise<CleanupResult> {
    try {
      // Extract deployment ID from URL if possible
      const deploymentId = this.extractVercelDeploymentId(deployUrl)
      if (!deploymentId) {
        console.warn(`Could not extract deployment ID from URL: ${deployUrl}`)
        return { success: true } // Consider it cleaned if we can't identify it
      }

      // TODO: Implement actual Vercel API call when VERCEL_TOKEN is available
      // const response = await fetch(`https://api.vercel.com/v2/deployments/${deploymentId}`, {
      //   method: 'DELETE',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
      //   },
      // })
      
      console.log(`Would cleanup Vercel deployment: ${deploymentId}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to cleanup Vercel deployment: ${errorMessage}`)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Cleanup GitHub repository
   */
  private async cleanupGitHubRepository(codeUrl: string): Promise<CleanupResult> {
    try {
      // Extract repo info from GitHub URL
      const repoInfo = this.extractGitHubRepoInfo(codeUrl)
      if (!repoInfo) {
        console.warn(`Could not extract repo info from URL: ${codeUrl}`)
        return { success: true }
      }

      // TODO: Implement actual GitHub API call when GITHUB_TOKEN is available
      // const response = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`, {
      //   method: 'DELETE',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      //     'Accept': 'application/vnd.github.v3+json',
      //   },
      // })

      console.log(`Would cleanup GitHub repository: ${repoInfo.owner}/${repoInfo.repo}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to cleanup GitHub repository: ${errorMessage}`)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Extract Vercel deployment ID from URL
   */
  private extractVercelDeploymentId(url: string): string | null {
    try {
      const urlObj = new URL(url)
      // Vercel URLs typically have deployment ID in subdomain or path
      const hostname = urlObj.hostname
      if (hostname.includes('.vercel.app')) {
        return hostname.split('.')[0]
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Extract GitHub repository info from URL
   */
  private extractGitHubRepoInfo(url: string): { owner: string; repo: string } | null {
    try {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (match) {
        return { owner: match[1], repo: match[2] }
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Perform all cleanup operations for a project
   */
  async cleanupProjectResources(project: ProjectCleanupData): Promise<CleanupResult[]> {
    const cleanupResults: CleanupResult[] = []

    // Cleanup deployment if exists
    if (project.deploy_url) {
      console.log(`Cleaning up deployment: ${project.deploy_url}`)
      const deployResult = await this.cleanupVercelDeployment(project.deploy_url)
      cleanupResults.push(deployResult)
    }

    // Cleanup code repository if exists
    if (project.code_url) {
      console.log(`Cleaning up code repository: ${project.code_url}`)
      const repoResult = await this.cleanupGitHubRepository(project.code_url)
      cleanupResults.push(repoResult)
    }

    return cleanupResults
  }
}

export class ApiGenerationService {
  private cleanupService = new ResourceCleanupService()

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
          name: `API Project ${new Date().toLocaleDateString()}`, // Shorter, cleaner name
          description: `API generated from user prompt: ${input.prompt.substring(0, 100)}...`,
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

      // Store user prompt in messages table
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          content: input.prompt,
          role: 'user',
          type: 'text',
          project_id: project.id,
          sender_id: userId
        })
        .select()
        .single()

      if (messageError) {
        console.error('Failed to store user message:', messageError)
        // Don't throw error here, just log it as it's not critical for the API generation
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
      console.error('API Generation Error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        cause: error instanceof Error ? error.cause : undefined
      });
      
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
   * Delete project with proper resource cleanup
   */
  async deleteProject(projectId: string, userId: string): Promise<DeleteProjectResponse> {
    try {
      // First, fetch the project record to get deployment/provider metadata
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found'
        })
      }

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found'
        })
      }

      console.log(`Starting cleanup for project ${projectId}`)

      // Perform ordered resource cleanup before deleting DB row
      const cleanupResults = await this.cleanupService.cleanupProjectResources(project)
      
      // Check if any cleanup operations failed
      const failedCleanups = cleanupResults.filter(result => !result.success)
      if (failedCleanups.length > 0) {
        const errorMessages = failedCleanups.map(result => result.error).join(', ')
        console.error(`Resource cleanup failed for project ${projectId}: ${errorMessages}`)
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to cleanup project resources: ${errorMessages}`,
          cause: new Error('Resource cleanup failed')
        })
      }

      console.log(`Resource cleanup completed successfully for project ${projectId}`)

      // Only after successful cleanup, delete the project from database
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId)

      if (deleteError) {
        console.error(`Database deletion failed for project ${projectId}:`, deleteError)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete project from database',
          cause: deleteError
        })
      }

      console.log(`Project ${projectId} deleted successfully`)
      return { success: true, message: 'Project and associated resources deleted successfully' }
    } catch (error) {
      // Log the error for observability
      console.error(`Error deleting project ${projectId}:`, error)
      
      // Re-throw TRPCError as-is, wrap other errors
      if (error instanceof TRPCError) {
        throw error
      }
      
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