import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { generateAPI, deployAPI, messageCreated, iterateAPI } from "../../../inngest/functions";

// Create the handler and serve it
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    messageCreated,
    generateAPI,
    deployAPI,
    iterateAPI, // Added for v0-style iteration workflow
  ],
});