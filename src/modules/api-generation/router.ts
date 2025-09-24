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
  // Invoke procedure for client compatibility
  invoke: protectedProcedure
    .input(z.object({
      text: z.string().min(1, "Text is required"),
      mode: z.enum(['direct', 'repo']).default('direct'),
      repoUrl: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // Convert the invoke input to generateAPI format
      const generateInput = {
        prompt: input.text,
        framework: 'fastapi' as const,
        advanced: false
      }
      return await apiGenerationService.generateAPI(generateInput, ctx.user.id)
    }),

  // Generate a new API from prompt
  generateAPI: protectedProcedure
    .input(generateAPISchema)
    .mutation(async ({ input, ctx }) => {
      return await apiGenerationService.generateAPI(input, ctx.user.id)
    }),

  // Create API procedure for client compatibility
  createApi: protectedProcedure
    .query(async ({ ctx }) => {
      // Return a simple response for now
      return {
        success: true,
        message: "API creation endpoint available",
        userId: ctx.user.id
      }
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
    .input(z.discriminatedUnion('jobType', [
      z.object({
        jobType: z.literal('generate_api'),
        payload: z.object({
          prompt: z.string().min(10, "Prompt must be at least 10 characters"),
          framework: z.enum(['fastapi', 'express']).default('fastapi'),
          advanced: z.boolean().default(false),
          template: z.string().optional(),
          mode: z.enum(['direct', 'github']).optional(),
          repoUrl: z.string().optional()
        })
      }),
      z.object({
        jobType: z.literal('analyze_repo'),
        payload: z.object({
          repoUrl: z.string().url("Must be a valid URL")
        })
      }),
      z.object({
        jobType: z.literal('deploy_project'),
        payload: z.object({
          projectId: z.string().min(1, "Project ID is required"),
          deploymentTarget: z.enum(['vercel', 'fly', 'railway']).default('vercel')
        })
      })
    ]))
    .mutation(async ({ input, ctx }) => {
      const eventName = `api/${input.jobType.replaceAll('_', '/')}`
      
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