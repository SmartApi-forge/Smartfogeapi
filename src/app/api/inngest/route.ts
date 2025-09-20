import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { generateAPI, deployAPI } from "../../../inngest/functions";

// Create the handler and serve it
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateAPI,
    deployAPI,
    // Add other functions here as they're created
  ],
});