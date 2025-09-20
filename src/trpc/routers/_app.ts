import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { inngest } from '@/src/inngest/client';

export const appRouter = createTRPCRouter({
  apiGeneration: createTRPCRouter({
    invoke: baseProcedure
      .input(z.object({
        text: z.string(),
        mode: z.enum(['direct', 'github']).default('direct'),
        repoUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get user ID from context - this should be set by your auth middleware
        const userId = ctx.user?.id;
        
        if (!userId || !ctx.user) {
          throw new Error('User not authenticated - please log in with a valid Supabase account');
        }
        
        // Validate that userId is a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
          throw new Error(`Invalid user ID format: ${userId}. Expected UUID format.`);
        }
        
        await inngest.send({
          name: "api/generate",
          data: { 
            prompt: input.text,
            mode: input.mode,
            repoUrl: input.repoUrl,
            userId: userId,
            projectId: `project-${Date.now()}`
          }
        });
        return { success: true, message: "API generation started" };
      }),
    
    createApi: baseProcedure
      .input(z.object({
        text: z.string(),
      }))
      .query((opts) => {
        return {
          greeting: `hello ${opts.input.text}`,
        };
      }),
    
    getTemplates: baseProcedure
      .query(() => {
        return [
          { id: 1, name: "REST API", description: "Basic REST API template" },
          { id: 2, name: "GraphQL API", description: "GraphQL API template" },
          { id: 3, name: "Auth API", description: "Authentication API template" }
        ];
      }),
    
    getProjects: baseProcedure
      .query(() => {
        return [
          { id: 1, name: "E-commerce API", status: "deployed" as const, createdAt: new Date() },
          { id: 2, name: "Blog API", status: "building" as const, createdAt: new Date() },
          { id: 3, name: "Task Manager API", status: "deployed" as const, createdAt: new Date() }
        ];
      })
  })
});
// export type definition of API
export type AppRouter = typeof appRouter;