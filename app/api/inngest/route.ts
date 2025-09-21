import { serve } from "inngest/next";
import { inngest } from "@/src/inngest/client";
import { generateAPI, deployAPI, messageCreated } from "@/src/inngest/functions";

// Create an API that serves the SmartAPIForge functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    messageCreated,
    generateAPI,
    deployAPI
  ],
});
