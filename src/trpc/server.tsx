import "server-only"; // <-- ensure this file cannot be imported from the client
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter, type AppRouter } from "./routers/_app";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

// Create a caller for server-side operations (detached from query client)
export const caller = async () => {
  const ctx = await createTRPCContext();
  return appRouter.createCaller(ctx);
};

export const createCaller = caller;

// Export trpc utilities for server-side usage
export const trpc = {
  apiGeneration: {
    getTemplates: {
      queryOptions: () => ({
        queryKey: ["apiGeneration.getTemplates"],
        queryFn: async () => {
          const c = await caller();
          return c.apiGeneration.getTemplates();
        },
      }),
    },
  },
};
