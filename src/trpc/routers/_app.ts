import { createTRPCRouter } from '../init';

// Import modular routers (following YouTube tutorial pattern)
import { messagesRouter } from '../../modules/messages/router';
import { fragmentsRouter } from '../../modules/fragments/router';
import { authRouter } from '../../modules/auth/router';
import { apiGenerationRouter } from '../../modules/api-generation/router';
import { projectsRouter } from '../../modules/projects/router';

export const appRouter = createTRPCRouter({
  // Modular routers - each module controls its own procedures
  messages: messagesRouter,
  fragments: fragmentsRouter,
  auth: authRouter,
  apiGeneration: apiGenerationRouter,
  projects: projectsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;