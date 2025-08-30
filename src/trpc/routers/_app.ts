import { createTRPCRouter } from '../init';
import { apiGenerationRouter } from './api-generation';
import { authRouter } from './auth';
import { jobsRouter } from './jobs';

export const appRouter = createTRPCRouter({
  apiGeneration: apiGenerationRouter,
  auth: authRouter,
  jobs: jobsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;