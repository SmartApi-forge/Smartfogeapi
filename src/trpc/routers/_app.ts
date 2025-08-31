import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { inngest } from '@/src/inngest/client';

export const appRouter = createTRPCRouter({
  apiGeneration: createTRPCRouter({
    invoke: baseProcedure
      .input(z.object({
        text: z.string(),
      }))
      .mutation(async ({ input }) => {
        await inngest.send({
          name: "api/generate",
          data: { 
            prompt: input.text,
            userId: "user-1", // TODO: Get from auth context
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