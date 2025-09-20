import { inngest } from "./client";
import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateAPI = inngest.createFunction(
  { id: "generate-api" },
  { event: "api/generate" },
  async ({ event, step }: { event: any; step: any }) => {
    const { prompt, userId, projectId } = event.data;

    // Update job status to processing
    await step.run("update-job-status-processing", async () => {
      // TODO: Update job status in database to "processing"
      console.log(`Starting API generation for project ${projectId}`);
    });

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Generate the API using OpenAI directly
    const apiResult = await step.run("generate-api-code", async () => {
      try {
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert API developer specializing in creating production-ready REST APIs.
              
              Your task is to:
              1. Analyze the user's requirements and generate a comprehensive OpenAPI 3.1 specification
              2. Create FastAPI or Express.js scaffolding code with proper structure
              3. Include authentication, validation, error handling, and testing setup
              4. Ensure the API follows REST best practices and includes proper documentation
              
              Always respond with structured JSON containing:
              - openapi_spec: Complete OpenAPI 3.1 specification
              - server_code: Main application code
              - requirements: Dependencies and setup instructions
              - tests: Basic test suite
              - deployment: Deployment configuration`
            },
            {
              role: "user",
              content: `Generate a production-ready REST API based on this requirement: ${prompt}`
            }
          ],
          temperature: 0.7,
          max_tokens: 4000
        });

        const output = completion.choices[0]?.message?.content;
        if (!output) {
          throw new Error('No response from OpenAI');
        }

        console.log('OpenAI API generation successful');
        return output;
      } catch (error) {
        console.error('OpenAI API generation failed:', error);
        throw new Error(`API generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Process and structure the generated API
    const processedResult = await step.run("process-api-result", async () => {
      try {
        // Clean and parse the AI output
        let cleanedOutput = apiResult;
        if (typeof apiResult === 'string') {
          // Remove only outer code fence wrappers (handle various language tags)
          const codeFencePattern = /^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```\s*$/;
          const match = apiResult.trim().match(codeFencePattern);
          
          if (match) {
            cleanedOutput = match[1].trim();
            console.log('Removed code fence wrapper');
          } else {
            cleanedOutput = apiResult.trim();
          }
          
          // Validate that cleaned output looks like JSON
          if (!cleanedOutput.startsWith('{') && !cleanedOutput.startsWith('[')) {
            console.warn('Cleaned output does not start with { or [:', cleanedOutput.substring(0, 100));
          }
        }
        
        let parsedOutput;
        try {
          parsedOutput = typeof cleanedOutput === 'string' ? JSON.parse(cleanedOutput) : cleanedOutput;
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Offending cleaned output:', cleanedOutput);
          // Return safe fallback structure
          parsedOutput = {
            openapi_spec: {},
            server_code: "// Error: Failed to parse AI response",
            requirements: [],
            tests: "// Error: Failed to parse AI response",
            deployment: {}
          };
        }
        
        return {
          openapi_spec: parsedOutput.openapi_spec || {},
          server_code: parsedOutput.server_code || "",
          requirements: parsedOutput.requirements || [],
          tests: parsedOutput.tests || "",
          deployment: parsedOutput.deployment || {},
          generated_at: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error parsing API generation output:", error);
        throw new Error("Failed to parse generated API code");
      }
    });

    // Save the generated API to database
    await step.run("save-generated-api", async () => {
      // TODO: Save the generated API to Supabase
      console.log(`Saving generated API for project ${projectId}`);
      console.log("Generated API structure:", Object.keys(apiResult));
    });

    // Update job status to completed
    await step.run("update-job-status-completed", async () => {
      // TODO: Update job status in database to "completed"
      console.log(`API generation completed for project ${projectId}`);
    });

    return {
      success: true,
      projectId,
      generatedApi: processedResult,
      message: "API generated successfully"
    };
  }
);

export const deployAPI = inngest.createFunction(
  { id: "deploy-api" },
  { event: "api/deploy" },
  async ({ event, step }: { event: any; step: any }) => {
    const { projectId, deploymentTarget } = event.data;

    await step.run("deploy-to-platform", async () => {
      // TODO: Implement deployment logic for Vercel/Fly.io
      console.log(`Deploying project ${projectId} to ${deploymentTarget}`);
    });

    return {
      success: true,
      projectId,
      deploymentUrl: `https://${projectId}.vercel.app`, // Placeholder
      message: "API deployed successfully"
    };
  }
);
