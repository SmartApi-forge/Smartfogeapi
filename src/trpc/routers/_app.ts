import { createTRPCRouter } from '../init';

// Import modular routers (following YouTube tutorial pattern)
import { messagesRouter } from '../../modules/messages';
import { fragmentsRouter } from '../../modules/fragments';
import { authRouter } from '../../modules/auth';
import { apiGenerationRouter } from '../../modules/api-generation';

export const appRouter = createTRPCRouter({
  // Modular routers - each module controls its own procedures
  messages: messagesRouter,
  fragments: fragmentsRouter,
  auth: authRouter,
  apiGeneration: apiGenerationRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;