import { createTRPCRouter } from '../init';

// Import modular routers (following YouTube tutorial pattern)
import { messagesRouter } from '../../modules/messages/router';
import { fragmentsRouter } from '../../modules/fragments/router';
import { authRouter } from '../../modules/auth/router';
import { apiGenerationRouter } from '../../modules/api-generation/router';
import { projectsRouter } from '../../modules/projects/router';
import { generationEventsRouter } from '../../modules/generation-events/router';
import { versionsRouter } from '../../modules/versions/router';
import { githubRouter } from './github';

export const appRouter = createTRPCRouter({
  // Modular routers - each module controls its own procedures
  messages: messagesRouter,
  fragments: fragmentsRouter,
  auth: authRouter,
  apiGeneration: apiGenerationRouter,
  projects: projectsRouter,
  generationEvents: generationEventsRouter,
  versions: versionsRouter,
  github: githubRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;