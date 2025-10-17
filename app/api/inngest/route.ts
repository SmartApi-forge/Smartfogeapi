import { serve } from "inngest/next";
import { inngest } from "@/src/inngest/client";
import { generateAPI, deployAPI, messageCreated, iterateAPI } from "@/src/inngest/functions";

// Create an API that serves the SmartAPIForge functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    messageCreated,
    generateAPI,
    deployAPI,
    iterateAPI, // Added for v0-style iteration workflow
  ],
});
