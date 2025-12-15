import { z } from 'zod'
import { baseProcedure, protectedProcedure, createTRPCRouter } from '../../trpc/init'
import { ApiGenerationService } from './service'
import { 
  generateAPISchema, 
  projectIdSchema, 
  jobStatusSchema 
} from './types'
import { classifyCommandSchema } from '../versions/types'
import { conversationContextService } from '../../services/conversation-context-service'

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
  // Note: Inngest removed - use direct streaming APIs instead
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
      // Note: Inngest removed - use direct streaming APIs instead
      // For generate_api: use /api/generate with SSE streaming
      // For analyze_repo: use /api/github/clone with SSE streaming
      // For deploy_project: use /api/deploy/vercel with SSE streaming

      return {
        success: true,
        message: `Use direct streaming API for ${input.jobType} - Inngest removed`,
        hint: input.jobType === 'generate_api' ? '/api/generate' : 
              input.jobType === 'analyze_repo' ? '/api/github/clone' : '/api/deploy/vercel'
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

  // Command classification (simplified - uses direct streaming API)
  // Note: DecisionAgent removed - use /api/generate with SSE streaming instead
  classify: baseProcedure
    .input(classifyCommandSchema)
    .mutation(async ({ input }) => {
      // Simplified classification - the /api/generate route handles intent detection
      // Return a basic classification that indicates code generation mode
      const isQuestion = input.prompt.trim().endsWith('?') || 
        input.prompt.toLowerCase().startsWith('what') ||
        input.prompt.toLowerCase().startsWith('how') ||
        input.prompt.toLowerCase().startsWith('why') ||
        input.prompt.toLowerCase().startsWith('can you explain');
      
      const classification = {
        type: isQuestion ? 'QUESTION' : 'MODIFY',
        confidence: 0.8,
        shouldCreateNewVersion: !isQuestion,
        entities: [],
        reasoning: 'Simplified classification - use /api/generate for full processing',
      };
      
      return classification;
    }),

  // Build context for iteration
  // Note: ContextBuilder removed - use conversationContextService instead
  buildContext: baseProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      messageLimit: z.number().int().positive().default(20),
    }))
    .query(async ({ input }) => {
      // Use new conversationContextService for context building
      const messages = await conversationContextService.loadMessages(input.projectId);
      const snapshot = await conversationContextService.loadLatestSnapshot(input.projectId);
      
      // Build conversation history array
      const conversationHistory = messages.map((msg) => ({
        role: 'user' as const,
        content: msg.user_message,
      })).concat(messages.filter(m => m.assistant_response).map((msg) => ({
        role: 'assistant' as const,
        content: msg.assistant_response!,
      })));
      
      // Extract files from snapshot
      const previousFiles = snapshot?.files_jsonb || {};
      
      return {
        conversationHistory,
        previousFiles,
        previousVersion: null,
        projectId: input.projectId,
        summary: `Context: ${messages.length} messages, ${Object.keys(previousFiles).length} files`,
        truncated: false,
      };
    }),

  // Trigger iteration workflow
  // Note: Inngest removed - use /api/generate with SSE streaming instead
  triggerIteration: baseProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      messageId: z.string().uuid(),
      prompt: z.string().min(1),
      // DecisionAgent intent types (new AI-powered classification)
      commandType: z.enum([
        'CREATE',
        'MODIFY',
        'CREATE_AND_LINK',
        'FIX_ERROR',
        'QUESTION'
      ]),
      shouldCreateNewVersion: z.boolean(),
      parentVersionId: z.string().uuid().optional(),
      conversationHistory: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      // Note: Inngest removed - use /api/generate with SSE streaming instead
      // The frontend should call /api/generate directly with the projectId and prompt

      return {
        success: true,
        message: 'Use /api/generate with SSE streaming for iteration - Inngest removed',
        hint: '/api/generate',
        projectId: input.projectId,
      };
    }),
})

export type ApiGenerationRouter = typeof apiGenerationRouter