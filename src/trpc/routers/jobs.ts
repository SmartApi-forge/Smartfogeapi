import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

// Job event emitter for real-time updates
const jobEvents = new EventEmitter();

// Job status types
const jobStatusSchema = z.enum(['pending', 'generating', 'testing', 'deploying', 'deployed', 'failed']);

const jobSchema = z.object({
  id: z.string(),
  userId: z.string(),
  prompt: z.string(),
  status: jobStatusSchema,
  progress: z.number().min(0).max(100),
  currentStep: z.string(),
  estimatedTimeRemaining: z.number().optional(),
  logs: z.array(z.string()),
  result: z.object({
    projectId: z.string().optional(),
    deployUrl: z.string().optional(),
    swaggerUrl: z.string().optional(),
    error: z.string().optional(),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const jobsRouter = createTRPCRouter({
  // Subscribe to job updates for real-time progress
  onJobUpdate: baseProcedure
    .input(z.object({ jobId: z.string() }))
    .subscription(({ input }) => {
      return observable<z.infer<typeof jobSchema>>((emit) => {
        const onUpdate = (data: z.infer<typeof jobSchema>) => {
          if (data.id === input.jobId) {
            emit.next(data);
          }
        };

        jobEvents.on('jobUpdate', onUpdate);

        return () => {
          jobEvents.off('jobUpdate', onUpdate);
        };
      });
    }),

  // Get job by ID
  getJob: baseProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      // TODO: Fetch from Supabase jobs table
      // Mock implementation
      return {
        id: input.jobId,
        userId: 'user_123',
        prompt: 'Create a REST API for e-commerce',
        status: 'generating' as const,
        progress: 65,
        currentStep: 'Running tests and validation',
        estimatedTimeRemaining: 25,
        logs: [
          'Started API generation',
          'Parsing prompt and extracting requirements',
          'Generated OpenAPI 3.1 specification',
          'Scaffolding FastAPI application',
          'Installing dependencies in sandbox',
          'Running unit tests',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  // Get all jobs for user
  getUserJobs: baseProcedure
    .query(async ({ ctx }) => {
      // TODO: Fetch from Supabase with user filter
      return [
        {
          id: 'job_1',
          userId: 'user_123',
          prompt: 'E-commerce API with products and orders',
          status: 'deployed' as const,
          progress: 100,
          currentStep: 'Completed',
          logs: ['Generation completed successfully'],
          result: {
            projectId: 'proj_1',
            deployUrl: 'https://ecommerce-api.vercel.app',
            swaggerUrl: 'https://ecommerce-api.vercel.app/docs',
          },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          id: 'job_2',
          userId: 'user_123',
          prompt: 'Blog API with posts and comments',
          status: 'generating' as const,
          progress: 45,
          currentStep: 'Generating code scaffolding',
          estimatedTimeRemaining: 30,
          logs: [
            'Started API generation',
            'Parsed requirements successfully',
            'Generated OpenAPI specification',
          ],
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
          updatedAt: new Date(Date.now() - 1 * 60 * 1000),
        },
      ];
    }),

  // Cancel a running job
  cancelJob: baseProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Cancel Inngest workflow and update status
      
      const cancelledJob = {
        id: input.jobId,
        userId: 'user_123',
        prompt: 'Cancelled job',
        status: 'failed' as const,
        progress: 0,
        currentStep: 'Cancelled by user',
        logs: ['Job cancelled by user'],
        result: {
          error: 'Job was cancelled by user',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Emit update event
      jobEvents.emit('jobUpdate', cancelledJob);

      return { success: true, message: 'Job cancelled successfully' };
    }),
});

// Helper function to simulate job progress updates
export const simulateJobProgress = (jobId: string) => {
  const steps = [
    { progress: 10, step: 'Parsing prompt and extracting requirements' },
    { progress: 25, step: 'Generating OpenAPI 3.1 specification' },
    { progress: 40, step: 'Scaffolding application structure' },
    { progress: 55, step: 'Installing dependencies in sandbox' },
    { progress: 70, step: 'Running unit tests' },
    { progress: 85, step: 'Building deployment package' },
    { progress: 95, step: 'Deploying to Vercel' },
    { progress: 100, step: 'Deployment completed successfully' },
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep >= steps.length) {
      clearInterval(interval);
      return;
    }

    const step = steps[currentStep];
    const jobUpdate = {
      id: jobId,
      userId: 'user_123',
      prompt: 'API generation in progress',
      status: currentStep === steps.length - 1 ? 'deployed' as const : 'generating' as const,
      progress: step.progress,
      currentStep: step.step,
      estimatedTimeRemaining: Math.max(0, (steps.length - currentStep - 1) * 5),
      logs: steps.slice(0, currentStep + 1).map(s => s.step),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jobEvents.emit('jobUpdate', jobUpdate);
    currentStep++;
  }, 3000); // Update every 3 seconds
};

export type JobsRouter = typeof jobsRouter;
