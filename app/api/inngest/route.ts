import { serve } from "inngest/next";
import { inngest } from "@/src/inngest/client";
import { generateAPI, deployAPI, messageCreated, iterateAPI, iterateAPIEnhanced, cloneAndPreviewRepository } from "@/src/inngest/functions";

// Create an API that serves the SmartAPIForge functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    messageCreated,
    generateAPI,
    deployAPI,
    iterateAPI, // Legacy v0-style iteration workflow
    iterateAPIEnhanced, // Enhanced iteration with ContextManager, PlanningAgent, ExecutionAgent, ValidationAgent
    cloneAndPreviewRepository, // GitHub clone and preview workflow
  ],
});
