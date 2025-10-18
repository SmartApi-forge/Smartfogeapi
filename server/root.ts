import { createTRPCRouter } from "../lib/trpc";
import { apiRouter } from "./routers/api";
import { authRouter } from "./routers/auth";

/**
 * This is the primary router for your server.
 *
 * All routers added in /server/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  api: apiRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
