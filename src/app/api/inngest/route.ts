import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { generateAPI, deployAPI, messageCreated, iterateAPI, iterateAPIEnhanced } from "../../../inngest/functions";

// Create the handler and serve it
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    messageCreated,
    generateAPI,
    deployAPI,
    iterateAPI, // Legacy v0-style iteration workflow
    iterateAPIEnhanced, // Enhanced iteration with ContextManager, PlanningAgent, ExecutionAgent, ValidationAgent
  ],
});