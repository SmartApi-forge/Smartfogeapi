import { z } from 'zod'
import { baseProcedure, protectedProcedure, createTRPCRouter } from '../../trpc/init'
import { inngest } from '../../inngest/client'
import { ApiGenerationService } from './service'
import { 
  generateAPISchema, 
  projectIdSchema, 
  jobStatusSchema 
} from './types'

const apiGenerationService = new ApiGenerationService()

export const apiGenerationRouter = createTRPCRouter({
  // Generate a new API from prompt
  generateAPI: protectedProcedure
    .input(generateAPISchema)
    .mutation(async ({ input, ctx }) => {
      return await apiGenerationService.generateAPI(input, ctx.user.id)
    }),

  // Get all projects for authenticated user
  getProjects: protectedProcedure
    .query(async ({ ctx }) => {
      return await apiGenerationService.getProjects(ctx.user.id)
    }),

  // Get project by ID
  getProject: protectedProcedure
    .input(projectIdSchema)
    .query(async ({ input, ctx }) => {
      return await apiGenerationService.getProject(input.id, ctx.user.id)
    }),

  // Delete project
  deleteProject: protectedProcedure
    .input(projectIdSchema)
    .mutation(async ({ input, ctx }) => {
      return await apiGenerationService.deleteProject(input.id, ctx.user.id)
    }),

  // Get job status for tracking generation progress
  getJobStatus: protectedProcedure
    .input(jobStatusSchema)
    .query(async ({ input, ctx }) => {
      return await apiGenerationService.getJobStatus(input.jobId, ctx.user.id)
    }),

  // Get available templates
  getTemplates: baseProcedure
    .query(async () => {
      return await apiGenerationService.getTemplates()
    }),

  // Background job procedures
  triggerBackgroundJob: protectedProcedure
    .input(z.object({
      jobType: z.enum(['generate_api', 'analyze_repo', 'deploy_project']),
      payload: z.record(z.any())
    }))
    .mutation(async ({ input, ctx }) => {
      const eventName = `api/${input.jobType.replace('_', '/')}`
      
      await inngest.send({
        name: eventName,
        data: {
          ...input.payload,
          userId: ctx.user.id,
          triggeredAt: new Date().toISOString()
        }
      })

      return {
        success: true,
        message: `Background job ${input.jobType} triggered successfully`
      }
    }),

  // Cancel background job
  cancelBackgroundJob: protectedProcedure
    .input(z.object({
      jobId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      // Update job status to cancelled in database
      return await apiGenerationService.cancelJob(input.jobId, ctx.user.id)
    }),

  // Retry failed job
  retryBackgroundJob: protectedProcedure
    .input(z.object({
      jobId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      return await apiGenerationService.retryJob(input.jobId, ctx.user.id)
    }),
})

export type ApiGenerationRouter = typeof apiGenerationRouter