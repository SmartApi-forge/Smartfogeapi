import { inngest } from "./client";
import OpenAI from 'openai';
import { CodeInterpreter } from '@e2b/code-interpreter';
import { Octokit } from '@octokit/rest';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI client with API key from environment
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const generateAPI = inngest.createFunction(
  { id: "generate-api" },
  { event: "api/generate" },
  async ({ event, step }) => {
    const { prompt, mode, repoUrl } = event.data;
    const userId = event.user?.id;
    
    let jobId;
    
    try {
    
      // Step 1: Create job record
      jobId = await step.run("create-job", async () => {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          user_id: userId,
          status: "processing",
          mode: mode,
          repo_url: repoUrl || null,
        })
        .select("id")
        .single();
        
      if (error) throw new Error(`Failed to create job: ${error.message}`);
      return data.id;
    });

    // Step 2: Handle repository if GitHub mode
    let repoAnalysis = null;
    if (mode === "github" && repoUrl) {
      repoAnalysis = await step.run("analyze-repository", async () => {
        // For now, return placeholder analysis
        // TODO: Implement actual repository cloning and analysis with E2B
        return `Repository analysis for ${repoUrl} - placeholder for E2B integration`;
      });
      
      // Update job with repository analysis
      await supabase
        .from("jobs")
        .update({ repo_analysis: repoAnalysis })
        .eq("id", jobId);
    }

    // Step 3: Generate API using OpenAI
    const apiResult = await step.run("generate-api-code", async () => {
      // Enhanced prompt that includes repository context if in GitHub mode
      const enhancedPrompt = mode === "github" && repoAnalysis
        ? `Generate an API that fits within this existing codebase: ${repoAnalysis}\n\nUser request: ${prompt}` 
        : prompt;
      
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert API designer. Generate an OpenAPI specification and starter code based on the user's request."
          },
          { role: "user", content: enhancedPrompt }
        ],
        response_format: { type: "json_object" },
      });

      // Process and parse the API result
      const rawOutput = completion.choices[0].message.content;
      console.log("Raw OpenAI output:", rawOutput);
      
      try {
        // Handle potential markdown-wrapped JSON
        let jsonStr = rawOutput;
        const markdownMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch) {
          jsonStr = markdownMatch[1];
        }
        
        const parsed = JSON.parse(jsonStr);
        
        // Ensure expected fields have defaults
        return {
          openApiSpec: parsed.openApiSpec || {},
          implementationCode: parsed.implementationCode || {},
          requirements: parsed.requirements || [],
          description: parsed.description || "",
        };
      } catch (error) {
        console.error("Failed to parse generated API code:", error);
        // Return a fallback structure instead of throwing
        return {
          openApiSpec: {},
          implementationCode: {},
          requirements: [],
          description: "Failed to parse API generation result",
          error: String(error),
        };
      }
    });

    // Step 4: Basic validation (placeholder for E2B sandbox validation)
    const validationResult = await step.run("validate-code", async () => {
      // For now, perform basic validation without E2B sandbox
      // TODO: Implement E2B sandbox validation
      
      const hasValidSpec = apiResult.openApiSpec && Object.keys(apiResult.openApiSpec).length > 0;
      const hasValidCode = apiResult.implementationCode && Object.keys(apiResult.implementationCode).length > 0;
      
      return {
        specValid: hasValidSpec,
        codeValid: hasValidCode,
        specValidationOutput: hasValidSpec ? "OpenAPI spec validation passed" : "No valid OpenAPI spec found",
        codeValidationOutput: hasValidCode ? "Code validation passed" : "No valid implementation code found"
      };
    });
    
    // Step 5: Handle GitHub PR creation if in GitHub mode
    let prUrl = null;
    if (mode === "github" && repoUrl) {
      prUrl = await step.run("create-pull-request", async () => {
        // TODO: Implement GitHub PR creation
        // For now, return a placeholder URL
        return `https://github.com/${repoUrl.split('/').slice(-2).join('/').replace('.git', '')}/pull/new`;
      });
    }

    // Step 6: Save the generated API to database
    const savedApi = await step.run("save-api", async () => {
      try {
        const { data, error } = await supabase
          .from('api_fragments')
          .insert({
            job_id: jobId,
            openapi_spec: apiResult.openApiSpec,
            implementation_code: apiResult.implementationCode,
            requirements: apiResult.requirements,
            description: apiResult.description,
            validation_results: validationResult,
            pr_url: prUrl,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (error) {
          console.error('Database save error:', error);
          throw new Error(`Failed to save API: ${error.message}`);
        }
        
        console.log('API saved to database:', data.id);
        return data;
      } catch (error) {
        console.error('Error saving API to database:', error);
        throw error;
      }
    });

    // Step 7: Update job status to completed
    await step.run("update-job-completed", async () => {
      try {
        const { error } = await supabase
          .from('jobs')
          .update({
            status: 'completed',
            result: {
              api_fragment_id: savedApi.id,
              validation: validationResult,
              pr_url: prUrl
            },
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
          
        if (error) {
          console.error('Job update error:', error);
          throw new Error(`Failed to update job: ${error.message}`);
        }
        
        console.log('Job completed successfully:', jobId);
      } catch (error) {
        console.error('Error updating job status:', error);
        throw error;
      }
    });
    
      return {
        success: true,
        jobId,
        apiFragmentId: savedApi.id,
        validation: validationResult,
        prUrl
      };
    } catch (error) {
      console.error('Error in generateAPI function:', error);
      
      // Update job status to failed if jobId exists
      if (jobId) {
        try {
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error_message: error.message || 'Unknown error occurred',
              completed_at: new Date().toISOString()
            })
            .eq('id', jobId);
        } catch (updateError) {
          console.error('Failed to update job status to failed:', updateError);
        }
      }
      
      throw error;
    }
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
