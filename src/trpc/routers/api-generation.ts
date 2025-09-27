import { z } from 'zod';
import { baseProcedure, protectedProcedure, createTRPCRouter } from '../init';
import { projectService, jobService, templateService } from '../../services/database';
import { TRPCError } from '@trpc/server';

// Input schemas for API generation
const generateAPISchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  framework: z.enum(['fastapi', 'express']).default('fastapi'),
  advanced: z.boolean().default(false),
  template: z.string().optional(),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  framework: z.enum(['fastapi', 'express']),
  status: z.enum(['generating', 'testing', 'deploying', 'deployed', 'failed']),
  created_at: z.date(),
  updated_at: z.date(),
  deploy_url: z.string().optional(),
  swagger_url: z.string().optional(),
});

export const apiGenerationRouter = createTRPCRouter({
  // Generate a new API from prompt
  generateAPI: protectedProcedure
    .input(generateAPISchema)
    .mutation(async ({ input, ctx }) => {

      try {
        // Create project record (with prompt included)
        const project = await projectService.createProject({
          user_id: ctx.user.id,
          name: `API from prompt: ${input.prompt.substring(0, 50)}...`,
          description: `API generated from user prompt`,
          prompt: input.prompt,
          framework: input.framework,
          advanced: input.advanced,
          status: 'generating'
        });

        // Store the user prompt in the messages table using the service operations
        const { messageOperations, fragmentOperations } = await import('../../../lib/supabase-server');
        
        const message = await messageOperations.create({
          content: input.prompt,
          role: 'user',
          type: 'text',
          sender_id: ctx.user.id,
          receiver_id: null, // User messages don't have a receiver
          project_id: project.id
        });

        // Create corresponding fragment for the user message
        try {
          const fragment = await fragmentOperations.create({
            message_id: message.id,
            content: input.prompt,
            fragment_type: 'text',
            order_index: 0,
            title: 'User API Request',
            sandbox_url: '',
            files: {},
            metadata: {
              framework: input.framework,
              advanced: input.advanced,
              request_type: 'api_generation'
            }
          });
        } catch (fragmentError) {
          console.error('Failed to create fragment for user message:', fragmentError);
          // Don't throw error here - message creation succeeded, fragment is optional
        }

        // Create job record
        const job = await jobService.createJob({
          project_id: project.id,
          user_id: ctx.user.id,
          type: 'generate_api',
          status: 'pending',
          payload: {
            prompt: input.prompt,
            framework: input.framework,
            advanced: input.advanced,
            template: input.template
          }
        });

        // TODO: Trigger Inngest workflow for API generation
        
        return {
          jobId: job.id,
          projectId: project.id,
          status: 'generating' as const,
          message: 'API generation started',
          estimatedTime: 60, // seconds
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to start API generation',
          cause: error
        });
      }
    }),

  // Get all projects for authenticated user
  getProjects: protectedProcedure
    .query(async ({ ctx }) => {

      try {
        const projects = await projectService.getProjects(ctx.user.id);
        return projects.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description,
          framework: project.framework,
          status: project.status,
          created_at: new Date(project.created_at),
          updated_at: new Date(project.updated_at),
          deploy_url: project.deploy_url,
          swagger_url: project.swagger_url,
        }));
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch projects',
          cause: error
        });
      }
    }),

  // Get project by ID
  getProject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {

      try {
        const project = await projectService.getProject(input.id, ctx.user.id);
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          framework: project.framework,
          status: project.status,
          created_at: new Date(project.created_at),
          updated_at: new Date(project.updated_at),
          deploy_url: project.deploy_url,
          swagger_url: project.swagger_url,
          openapi_spec: project.openapi_spec,
          code_url: project.code_url,
          prompt: project.prompt,
          advanced: project.advanced
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch project',
          cause: error
        });
      }
    }),

  // Delete project
  deleteProject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {

      try {
        await projectService.deleteProject(input.id, ctx.user.id);
        // TODO: Cleanup deployed resources (Vercel deployment, etc.)
        return { success: true, message: 'Project deleted successfully' };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete project',
          cause: error
        });
      }
    }),

  // Get job status for tracking generation progress
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {

      try {
        const job = await jobService.getJob(input.jobId, ctx.user.id);
        if (!job) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }

        // Calculate progress based on job status and timestamps
        let progress = 0;
        let currentStep = 'Initializing';
        let estimatedTimeRemaining = 60;

        switch (job.status) {
          case 'pending':
            progress = 10;
            currentStep = 'Queued for processing';
            break;
          case 'running':
            progress = 50;
            currentStep = 'Generating API specification';
            estimatedTimeRemaining = 30;
            break;
          case 'completed':
            progress = 100;
            currentStep = 'Generation completed';
            estimatedTimeRemaining = 0;
            break;
          case 'failed':
            progress = 0;
            currentStep = 'Generation failed';
            estimatedTimeRemaining = 0;
            break;
        }

        return {
          jobId: job.id,
          status: job.status,
          progress,
          currentStep,
          estimatedTimeRemaining,
          error_message: job.error_message,
          result: job.result,
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch job status',
          cause: error
        });
      }
    }),

  // Get available templates
  getTemplates: baseProcedure
    .query(async ({ ctx }) => {
      try {
        const templates = await templateService.getTemplates();
        return templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          framework: template.framework,
          tags: template.tags || [],
          prompt_template: template.prompt_template,
          estimatedTime: 40, // Default estimation
        }));
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch templates',
          cause: error
        });
      }
    }),
});

export type ApiGenerationRouter = typeof apiGenerationRouter;
