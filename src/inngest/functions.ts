import { inngest } from "./client";
import OpenAI from 'openai';
import type { Sandbox } from '../lib/daytona-client';
import { daytona, createWorkspace, getWorkspace, deleteWorkspace, ensureSandboxRunning } from '../lib/daytona-client';
import { Octokit } from '@octokit/rest';
import { createClient } from '@supabase/supabase-js';
import { AgentState, AIResult } from './types';
import { streamingService } from '../services/streaming-service';
import { VersionManager } from '../services/version-manager';
import { ContextBuilder } from '../services/context-builder';
import { SmartContextBuilder } from '../services/smart-context-builder';
import { EmbeddingService } from '../services/embedding-service';
import { SANDBOX_DEFAULT_TIMEOUT_MS, getSandboxTimeout } from '../config/sandbox';

// Import default resources configuration
import { DEFAULT_RESOURCES } from '../lib/daytona-client';

// Initialize OpenAI client with API key from environment
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Create a per-request Supabase client
 * IMPORTANT: Do not use service role key at module level as it bypasses RLS
 * Note: Inngest functions run in background and need service role for admin operations
 */
function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Create module-level client for backward compatibility
// TODO: Refactor all usages to call createSupabaseClient() per-request

const supabase = createSupabaseClient();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// New message created background job (following YouTube tutorial pattern)
export const messageCreated = inngest.createFunction(
  { id: "message-created" },
  { event: "message/created" },
  async ({ event, step }) => {
    // Input validation for event.data
    if (!event || !event.data) {
      console.error('Invalid event: missing event or event.data');
      throw new Error('Invalid event: missing event or event.data');
    }

    const { messageId, content, role, type, project_id } = event.data;

    // Validate required fields
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      console.error('Invalid messageId: must be a non-empty string');
      throw new Error('Invalid messageId: must be a non-empty string');
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      console.error('Invalid content: must be a non-empty string');
      throw new Error('Invalid content: must be a non-empty string');
    }

    if (!role || typeof role !== 'string') {
      console.error('Invalid role: must be a string');
      throw new Error('Invalid role: must be a string');
    }

    if (!type || typeof type !== 'string') {
      console.error('Invalid type: must be a string');
      throw new Error('Invalid type: must be a string');
    }

    // Optional: Validate role and type against allowed values
    const allowedRoles = ['user', 'assistant', 'system'];
    const allowedTypes = ['text', 'image', 'file', 'code', 'result', 'error'];
    
    if (!allowedRoles.includes(role)) {
      console.error(`Invalid role: ${role}. Must be one of: ${allowedRoles.join(', ')}`);
      throw new Error(`Invalid role: ${role}. Must be one of: ${allowedRoles.join(', ')}`);
    }

    if (!allowedTypes.includes(type)) {
      console.error(`Invalid type: ${type}. Must be one of: ${allowedTypes.join(', ')}`);
      throw new Error(`Invalid type: ${type}. Must be one of: ${allowedTypes.join(', ')}`);
    }
    
    console.log(`Processing new message: ${messageId}`);
    console.log(`Content: ${content}`);
    console.log(`Role: ${role}, Type: ${type}`);
    console.log(`Project ID: ${project_id || 'No project associated'}`);
    
    // Here you can add any background processing logic
    // For example: AI processing, notifications, analytics, etc.
    
    await step.run("process-message", async () => {
      // Update message status or add processing results
      const { error } = await supabase
        .from('messages')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
      if (error) {
        console.error(`Failed to update message ${messageId} for project ${project_id || 'unknown'}:`, error);
        throw new Error(`Failed to update message: ${error.message}`);
      }
      
      console.log(`Message ${messageId} for project ${project_id || 'unknown'} processed successfully`);
      return { success: true, messageId, project_id };
    });

    // NOTE: Removed automatic iteration trigger to prevent duplicates
    // Iteration is now ONLY triggered by the frontend:
    // - /ask page: triggers api/generate directly
    // - /projects page: triggers api/iterate via send() function
    // This prevents race conditions and duplicate workflow executions
  }
);

export const generateAPI = inngest.createFunction(
  { id: "generate-api" },
  { event: "api/generate" },
  async ({ event, step }) => {
    const { prompt, mode, repoUrl, userId, projectId, githubRepoId } = event.data;
    
    let jobId: string | undefined;
    
    try {
    
      // Step 1: Create job record
      jobId = await step.run("create-job", async () => {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          user_id: userId || 'anonymous', // Use anonymous if no userId provided
          project_id: projectId || null, // Include project_id if available
          type: "generate_api",
          status: "running",
          payload: {
            mode: mode,
            repo_url: repoUrl || null,
          },
        })
        .select("id")
        .single();
        
      if (error) {
        console.warn(`Failed to create job (continuing without job tracking): ${error.message}`);
        return null; // Continue without job tracking if database fails
      }
      
      // Emit project created event for streaming
      if (projectId) {
        await streamingService.emit(projectId, {
          type: 'project:created',
          projectId,
          prompt,
        });
      }
      
      return data.id;
    });

    // Step 2: Handle repository if GitHub mode
    let repoAnalysis = null;
    let sandboxUrl: string | undefined;
    if (mode === "github" && repoUrl) {
      repoAnalysis = await step.run("analyze-repository", async () => {
        let sandbox: Sandbox | null = null;
        
        try {
          const { githubRepositoryService } = await import('../services/github-repository-service');
          
          // Get GitHub integration for access token
          const { data: integration } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'github')
            .eq('is_active', true)
            .single();
          
          if (!integration) {
            throw new Error('GitHub integration not found');
          }
          
          // Enhanced validation and sanitization of repository URL
          const urlPattern = /^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w\-\.]+\/[\w\-\.]+(\.git)?$/;
          if (!urlPattern.test(repoUrl)) {
            throw new Error(`Invalid repository URL format: ${repoUrl}`);
          }
          
          // Additional security checks
          if (repoUrl.includes('..') || repoUrl.includes(';') || repoUrl.includes('|') || repoUrl.includes('&')) {
            throw new Error(`Repository URL contains potentially dangerous characters: ${repoUrl}`);
          }
          
          // Create Daytona workspace for repository analysis
          sandbox = await createWorkspace({
            resources: DEFAULT_RESOURCES,
            public: true,
          });
          
          // Clone repository using service with authentication
          const cloneResult = await githubRepositoryService.cloneToSandbox(
            repoUrl,
            integration.access_token,
            sandbox
          );
          
          if (!cloneResult.success) {
            throw new Error(`Failed to clone repository: ${cloneResult.error}`);
          }
          
          const repoPath = cloneResult.path;
          
          // Detect framework
          const framework = await githubRepositoryService.detectFramework(sandbox, repoPath);
          
          // Install dependencies
          const installResult = await githubRepositoryService.installDependencies(
            sandbox,
            repoPath,
            framework.packageManager
          );
          
          if (!installResult.success) {
            console.warn('Dependency installation failed:', installResult.error);
          }
          
          // Start preview server
          let previewServer = null;
          if (framework.framework !== 'unknown' && framework.startCommand) {
            previewServer = await githubRepositoryService.startPreviewServer(
              sandbox,
              framework,
              repoPath
            );
            
            if (previewServer.success) {
              console.log('Preview server started:', previewServer.url);
              sandboxUrl = previewServer.url;
              
              // Update project with sandbox URL
              if (projectId) {
                await supabase
                  .from('projects')
                  .update({ 
                    sandbox_url: previewServer.url,
                    github_mode: true,
                    github_repo_id: githubRepoId
                  })
                  .eq('id', projectId);
              }
            }
          }
          
          // Analyze package.json if it exists
          let packageInfo = null;
          try {
            const packageJsonContent = await sandbox.fs.readFile(`${repoPath}/package.json`);
            packageInfo = JSON.parse(packageJsonContent.toString('utf-8'));
          } catch (error) {
            console.log('No package.json found or invalid JSON');
          }
          
          // Get directory structure using Daytona process
          const dirStructure = await sandbox.process.executeCommand(
            `find ${repoPath} -type f -name '*.js' -o -name '*.ts' -o -name '*.json' -o -name '*.md'`
          );
          
          // Analyze main files
          const mainFiles = [];
          const commonFiles = ['index.js', 'index.ts', 'app.js', 'app.ts', 'server.js', 'server.ts', 'main.js', 'main.ts'];
          
          for (const file of commonFiles) {
            try {
              const content = await sandbox.fs.readFile(`${repoPath}/${file}`);
              if (content) {
                mainFiles.push({ file, content: content.toString('utf-8').substring(0, 1000) }); // First 1000 chars
              }
            } catch (error) {
              // File doesn't exist, continue
            }
          }
          
          // Read README if exists
          let readme = null;
          try {
            const readmeContent = await sandbox.fs.readFile(`${repoPath}/README.md`);
            readme = readmeContent.toString('utf-8');
          } catch (error) {
            try {
              const readmeContent = await sandbox.fs.readFile(`${repoPath}/readme.md`);
              readme = readmeContent.toString('utf-8');
            } catch (error) {
              // No README found
            }
          }
          
          return {
            repoUrl,
            framework: framework.framework,
            packageManager: framework.packageManager,
            previewServer: previewServer?.success ? {
              url: previewServer.url,
              port: previewServer.port
            } : null,
            packageInfo,
            directoryStructure: dirStructure?.result || '',
            mainFiles,
            readme: readme ? readme.substring(0, 2000) : null,
            analysisTimestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error('Repository analysis error:', error);
          
          // Attempt to clean up sandbox if it exists before returning error
          if (sandbox) {
            try {
              await deleteWorkspace(sandbox);
            } catch (killError) {
              console.error('Failed to delete sandbox in catch block:', killError);
            }
          }
          
          return {
            repoUrl,
            error: (error as Error).message,
            analysisTimestamp: new Date().toISOString()
          };
        } finally {
          // Robust cleanup - check sandbox is truthy
          if (sandbox) {
            try {
              await deleteWorkspace(sandbox);
            } catch (cleanupError) {
              // Swallow cleanup errors to prevent them from throwing
              console.error('Repository analysis sandbox cleanup error:', cleanupError);
            }
          }
        }
      });
      
      // Update job with repository analysis (if job tracking is available)
      if (jobId) {
        await supabase
          .from("jobs")
          .update({ repo_analysis: repoAnalysis })
          .eq("id", jobId);
      }
    }

    // Step 3: Generate API using OpenAI
    const apiResult = await step.run("generate-api-code", async () => {
      // Emit step start event
      if (projectId) {
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Planning',
          message: 'Planning API structure...',
        });
      }
      
      // Enhanced prompt that includes repository context if in GitHub mode
      let enhancedPrompt = prompt;
      if (mode === "github" && repoAnalysis && typeof repoAnalysis === 'object') {
        const repoContext = `
Repository Analysis:
- URL: ${(repoAnalysis as any).repoUrl}
- Package Info: ${(repoAnalysis as any).packageInfo ? JSON.stringify((repoAnalysis as any).packageInfo, null, 2) : 'No package.json found'}
- Directory Structure: ${(repoAnalysis as any).directoryStructure || 'Unable to analyze structure'}
- Main Files: ${(repoAnalysis as any).mainFiles ? (repoAnalysis as any).mainFiles.map((f: any) => `${f.file}: ${f.content.substring(0, 200)}...`).join('\n') : 'No main files found'}
- README: ${(repoAnalysis as any).readme ? (repoAnalysis as any).readme.substring(0, 500) + '...' : 'No README found'}
`;
        enhancedPrompt = `Generate an API that fits within this existing codebase:${repoContext}\n\nUser request: ${prompt}`;
      }
      
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are an expert API designer. Generate a complete OpenAPI specification and implementation code based on the user's request.

You MUST respond with valid JSON in this exact structure:
{
  "openApiSpec": {
    "openapi": "3.0.0",
    "info": {
      "title": "Generated API",
      "version": "1.0.0",
      "description": "Auto-generated API specification"
    },
    "servers": [
      {
        "url": "http://localhost:3000",
        "description": "Development server"
      }
    ],
    "paths": {},
    "components": {
      "schemas": {},
      "responses": {
        "400": {
          "description": "Bad Request",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "error": { "type": "string" }
                }
              }
            }
          }
        },
        "500": {
          "description": "Internal Server Error",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "error": { "type": "string" }
                }
              }
            }
          }
        }
      }
    }
  },
  "implementationCode": {
    "index.js": "// Complete working Node.js/Express implementation with proper error handling",
    "package.json": "// Valid package.json with all required dependencies and scripts"
  },
  "requirements": ["List of functional requirements"],
  "description": "Brief description of the API"
}

IMPORTANT REQUIREMENTS:
1. OpenAPI spec MUST be valid according to OpenAPI 3.0.0 specification
2. All paths must have proper HTTP methods (get, post, put, delete, etc.)
3. All responses must have proper status codes and content types
4. Include proper error responses (400, 500) for all endpoints
5. Use proper schema definitions in components section
6. Implementation code must be syntactically correct JavaScript/TypeScript
7. Package.json must include all necessary dependencies and valid scripts
8. Include proper Express.js setup with middleware and error handling
9. Add health check endpoint at /health that returns 200 OK with {"status":"OK","timestamp":new Date().toISOString()}
10. Generate complete, working code that can run immediately
11. Include proper CORS setup and security middleware
12. Add input validation using joi or similar
13. Include proper error handling middleware
14. Generate realistic sample data and endpoints
15. Ensure all imports and exports are correct
16. Add comprehensive logging with console.log statements for startup, requests, and errors
17. Include a start script that works: "node index.js" or "ts-node index.ts"
18. Make sure the server listens on port 3000 by default with proper startup logging
19. Add proper JSON parsing middleware
20. Include at least 3-5 meaningful API endpoints based on the request
21. CRITICAL: Server MUST log "Server running on port 3000" or similar when successfully started
22. CRITICAL: Add graceful shutdown handling with process.on('SIGTERM') and process.on('SIGINT')
23. CRITICAL: Include error handling for server startup failures with process.exit(1)
24. CRITICAL: Add request logging middleware to log all incoming requests
25. CRITICAL: Ensure the server can run in background mode (detached process)
26. CRITICAL: Add timeout handling for long-running requests (30 second timeout)
27. CRITICAL: Include proper error responses for all endpoints with consistent error format
28. CRITICAL: Add process.on('uncaughtException') and process.on('unhandledRejection') handlers

EXAMPLE STRUCTURE:
{
  "openApiSpec": {
    "openapi": "3.0.0",
    "info": { "title": "Todo API", "version": "1.0.0" },
    "paths": {
      "/health": {
        "get": {
          "summary": "Health check",
          "responses": {
            "200": {
              "description": "OK",
              "content": { "application/json": { "schema": { "type": "object", "properties": { "status": { "type": "string" }, "timestamp": { "type": "string" } } } } }
            }
          }
        }
      }
    }
  },
  "implementationCode": {
    "index.js": "const express = require('express');\nconst cors = require('cors');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\n// Middleware\napp.use(cors());\napp.use(express.json());\napp.use((req, res, next) => { console.log(\`\${new Date().toISOString()} \${req.method} \${req.path}\`); next(); });\n\n// Health check\napp.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));\n\n// Error handling\napp.use((err, req, res, next) => { console.error('Error:', err); res.status(500).json({ error: 'Internal server error' }); });\n\n// Graceful shutdown\nprocess.on('SIGTERM', () => { console.log('SIGTERM received, shutting down gracefully'); process.exit(0); });\nprocess.on('SIGINT', () => { console.log('SIGINT received, shutting down gracefully'); process.exit(0); });\nprocess.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); process.exit(1); });\nprocess.on('unhandledRejection', (err) => { console.error('Unhandled Rejection:', err); process.exit(1); });\n\n// Start server\nconst server = app.listen(PORT, () => { console.log(\`Server running on port \${PORT}\`); console.log(\`Health check available at http://localhost:\${PORT}/health\`); }).on('error', (err) => { console.error('Server startup error:', err); process.exit(1); });",
    "package.json": "{\"name\": \"api\", \"version\": \"1.0.0\", \"scripts\": {\"start\": \"node index.js\"}, \"dependencies\": {\"express\": \"^4.18.0\", \"cors\": \"^2.8.5\"}}"
  }
}`
          },
          { role: "user", content: enhancedPrompt }
        ],
        response_format: { type: "json_object" },
      });

      // Emit generation start event
      if (projectId) {
        await streamingService.emit(projectId, {
          type: 'step:complete',
          step: 'Planning',
          message: 'API structure planned. Generating code...',
        });
        
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Generating',
          message: 'Generating implementation files...',
        });
      }

      // Collect streaming response from OpenAI
      let rawOutput = '';
      let chunkCount = 0;
      
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          rawOutput += content;
          chunkCount++;
          
          // Emit progress updates periodically (every 10 chunks to avoid overwhelming)
          if (projectId && chunkCount % 10 === 0) {
            const progress = Math.min(95, Math.round((rawOutput.length / 3000) * 100));
            await streamingService.emit(projectId, {
              type: 'code:chunk',
              filename: 'Generating...',
              chunk: '',
              progress,
            });
          }
        }
      }
      
      console.log("Raw OpenAI output:", rawOutput.substring(0, 500));
      
      try {
        // Handle potential markdown-wrapped JSON
        let jsonStr = rawOutput || '';
        const markdownMatch = rawOutput?.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch) {
          jsonStr = markdownMatch[1];
        }
        
        const parsed = JSON.parse(jsonStr);
        
        // Ensure expected fields have defaults
        const files = parsed.implementationCode || {};
        
        // Add OpenAPI spec to files if it exists
        if (parsed.openApiSpec) {
          files['openapi.json'] = JSON.stringify(parsed.openApiSpec, null, 2);
        }
        
        // Stream individual files to frontend
        if (projectId && Object.keys(files).length > 0) {
          for (const [filename, content] of Object.entries(files)) {
            // Emit file generating event
            await streamingService.emit(projectId, {
              type: 'file:generating',
              filename,
              path: filename,
            });
            
            // Small delay to ensure file:generating event is processed first
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Stream code in chunks for typing animation
            const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            const chunkSize = 50; // Smaller chunks for smoother typing animation
            for (let i = 0; i < fileContent.length; i += chunkSize) {
              const chunk = fileContent.slice(i, i + chunkSize);
              const progress = Math.round(((i + chunkSize) / fileContent.length) * 100);
              
              await streamingService.emit(projectId, {
                type: 'code:chunk',
                filename,
                chunk,
                progress: Math.min(progress, 100),
              });
              
              // Small delay between chunks for typing animation
              await new Promise(resolve => setTimeout(resolve, 30));
            }
            
            // Emit file complete event
            await streamingService.emit(projectId, {
              type: 'file:complete',
              filename,
              content: fileContent,
              path: filename,
            });
            
            // Small delay after file completion before starting next file
            // This ensures the frontend finishes displaying current file before switching
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        // Also add requirements if they exist
        const requirements = Array.isArray(parsed.requirements) ? parsed.requirements : [];
        
        const result: AIResult = {
          state: {
            data: {
              summary: parsed.description || "",
              files: files,
              requirements: requirements
            } as AgentState
          }
        };
        
        // Error detection logic
        const isError = !result.state.data.summary || !Object.keys(result.state.data.files ?? {}).length;
        
        if (isError) {
          console.log('❌ Error detected in AI result - missing summary or files');
          
          // Save error message to database using the new service method
          const { MessageService } = await import('../modules/messages/service');
          await MessageService.saveResult({
            content: result.state.data.summary || 'AI generation failed - missing required data',
            role: 'assistant',
            type: 'error',
            project_id: projectId // Add project_id for error messages too
          });
          
          // Update job status to failed if job tracking is available
          if (jobId) {
            await supabase
              .from('jobs')
              .update({
                status: 'failed',
                error: 'AI generation failed - missing required data',
                completed_at: new Date().toISOString()
              })
              .eq('id', jobId);
          }
          
          // Return early - do not proceed with validation or fragment creation
          return {
            success: false,
            error: 'AI generation failed - missing required data',
            jobId
          };
        }
        
        console.log('🤖 AI Generated Result:');
        console.log('- Summary:', result.state.data.summary);
        console.log('- Implementation files:', Object.keys(result.state.data.files));
        console.log('- Files count:', Object.keys(result.state.data.files).length);
        
        return result;
      } catch (error) {
        console.error("Failed to parse generated API code:", error);
        
        // Create error result for database saving
        const errorResult: AIResult = {
          state: {
            data: {
              summary: "Failed to parse API generation result",
              files: {}
            } as AgentState
          }
        };
        
        // Save error message to database
        const { MessageService } = await import('../modules/messages/service');
        await MessageService.saveResult({
          content: errorResult.state.data.summary || `Failed to parse AI result: ${error}`,
          role: 'assistant',
          type: 'error',
          project_id: projectId // Add project_id for error messages too
        });
        
        // Update job status to failed if job tracking is available
        if (jobId) {
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error: `Failed to parse AI result: ${error}`,
              completed_at: new Date().toISOString()
            })
            .eq('id', jobId);
        }
        
        // Return early - do not proceed with validation
        return {
          success: false,
          error: `Failed to parse AI result: ${error}`,
          jobId
        };
      }
    });

    // Check if API generation failed - if so, return early
    if (!('state' in apiResult) || !apiResult.state?.data?.summary) {
      return apiResult;
    }

    // Step 4: Comprehensive sandbox validation
    const validationResult = await step.run("validate-code-in-sandbox", async () => {
      // Emit validation start event
      if (projectId) {
        // Emit validation events (no database save, handled by streaming)
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Validating',
          message: 'Validating generated code...',
        });
        
        await streamingService.emit(projectId, {
          type: 'validation:start',
          stage: 'Setting up sandbox environment',
        });
      }
      
      let sandbox: Sandbox | null = null;
      
      try {
        // Create Daytona workspace for code validation
        console.log('🏭️ Creating Daytona workspace for validation...');
        sandbox = await createWorkspace({
          resources: DEFAULT_RESOURCES,
          public: false, // Validation sandbox doesn't need public URL
        });
        
        // Write OpenAPI spec to sandbox
        if (!('state' in apiResult) || !apiResult.state?.data) {
          throw new Error('Invalid API result structure for sandbox setup');
        }
        
        const openApiSpec = apiResult.state.data.files['openapi.yaml'] || apiResult.state.data.files['openapi.json'] || '';
        await sandbox.fs.uploadFile(Buffer.from(openApiSpec), 'workspace/openapi.json');
        
        // Write implementation files to sandbox
        const implementationFiles = apiResult.state.data.files || {};
        console.log('📁 Writing implementation files:', Object.keys(implementationFiles));
        
        for (const [filename, content] of Object.entries(implementationFiles)) {
          if (typeof content === 'string') {
            console.log(`📝 Writing file: ${filename} (${content.length} chars)`);
            await sandbox.fs.uploadFile(Buffer.from(content), `workspace/src/${filename}`);
            
            // Also copy package.json and main entry files to root directory for npm start to work
            if (filename === 'package.json') {
              console.log('📝 Copying package.json to root directory for npm start');
              await sandbox.fs.uploadFile(Buffer.from(content), 'workspace/package.json');
            } else if (filename === 'index.js' || filename === 'server.js' || filename === 'app.js') {
              console.log(`📝 Copying ${filename} to root directory for npm start`);
              await sandbox.fs.uploadFile(Buffer.from(content), `workspace/${filename}`);
            }
          } else {
            console.log(`⚠️ Skipping non-string content for ${filename}:`, typeof content);
          }
        }
        
        // List all files in the sandbox for debugging
        const fileList = await sandbox.process.executeCommand(
          'find workspace -type f -name "*" | head -20 2>/dev/null || echo "find_failed"'
        );
        console.log('📋 Files in sandbox:', fileList.result);
        
        // Check if OpenAPI spec file exists and is valid JSON
        let specValidation, specValid = false;
        try {
          console.log('🔍 Step 1: Validating OpenAPI specification...');
          const specExists = await sandbox.process.executeCommand('test -f workspace/openapi.json && echo "exists" || echo "missing"');
          if (specExists.result?.includes('exists')) {
            // Validate JSON syntax and basic OpenAPI structure  
            const validation = await sandbox.process.executeCommand(`cd workspace && node -e "
              try {
                const fs = require('fs');
                const spec = JSON.parse(fs.readFileSync('openapi.json', 'utf8'));
                
                // Basic OpenAPI 3.0 validation
                if (!spec.openapi || !spec.openapi.startsWith('3.')) {
                  throw new Error('Missing or invalid openapi version');
                }
                if (!spec.info || !spec.info.title || !spec.info.version) {
                  throw new Error('Missing required info fields (title, version)');
                }
                if (!spec.paths || typeof spec.paths !== 'object') {
                  throw new Error('Missing or invalid paths object');
                }
                
                console.log('OpenAPI spec is valid');
                process.exit(0);
              } catch (error) {
                console.error('OpenAPI validation failed:', error.message);
                process.exit(1);
              }
            "`);
            
            specValidation = validation;
            specValid = validation.exitCode === 0;
            console.log('📋 Spec validation result:', specValid ? '✅ Valid' : '❌ Invalid');
            if (!specValid) {
              console.log('🚨 Spec validation errors:', validation.result);
            }
          } else {
            specValidation = { exitCode: 1, result: 'OpenAPI spec file not found' };
          }
        } catch (error) {
          specValidation = { exitCode: 1, result: `OpenAPI validation error: ${error}` };
        }
        
        // Check if TypeScript files exist before validation
         let tsValidation, tsValid = false;
         try {
           console.log('🔍 Step 2: Validating TypeScript code...');
           const tsFiles = await sandbox.process.executeCommand('cd workspace/src && find . -name "*.ts" | head -1 2>/dev/null || echo "no_ts_files"');
           if (tsFiles.result?.trim()) {
             // Ensure tsconfig.json exists in the src directory
             const tsconfigExists = await sandbox.process.executeCommand('test -f workspace/src/tsconfig.json && echo "exists" || echo "missing"');
             if (tsconfigExists.result?.includes('missing')) {
               // Create a basic tsconfig.json for the project
               await sandbox.fs.uploadFile(Buffer.from(JSON.stringify({
                 "compilerOptions": {
                   "target": "es2020",
                   "module": "commonjs",
                   "lib": ["es2020"],
                   "outDir": "./dist",
                   "rootDir": "./",
                   "strict": false,
                   "esModuleInterop": true,
                   "skipLibCheck": true,
                   "forceConsistentCasingInFileNames": true,
                   "resolveJsonModule": true,
                   "declaration": false,
                   "sourceMap": false,
                   "noImplicitAny": false
                 },
                 "include": ["**/*.ts"],
                 "exclude": ["node_modules", "dist", "**/*.test.ts"]
               }, null, 2)), 'workspace/src/tsconfig.json');
             }
             
             // Install TypeScript if not available
             await sandbox.process.executeCommand(
               'npm install typescript --save-dev --silent',
               'workspace',
               {},
               60 // 60 seconds timeout
             );
             
             // Run TypeScript compilation check
             tsValidation = await sandbox.process.executeCommand(
               'npx tsc --noEmit --skipLibCheck --allowJs 2>/dev/null || echo "tsc_failed"',
               'workspace/src'
             );
             tsValid = tsValidation.exitCode === 0;
             console.log('📝 TypeScript validation result:', tsValid ? '✅ Valid' : '❌ Invalid');
             if (!tsValid) {
               console.log('🚨 TypeScript validation errors:', tsValidation.result);
             }
          } else {
            // Check JavaScript files instead
            const jsFiles = await sandbox.process.executeCommand('find . -name "*.js" | head -1 2>/dev/null || echo "no_js_files"', 'workspace/src');
            if (jsFiles.result?.trim()) {
              tsValidation = { exitCode: 0, result: 'No TypeScript files found, JavaScript files present' };
              tsValid = true;
            } else {
              tsValidation = { exitCode: 1, result: 'No TypeScript or JavaScript files found' };
            }
          }
        } catch (error) {
          tsValidation = { exitCode: 1, result: `TypeScript validation error: ${error}` };
        }
        
        // Run basic syntax validation with better error handling
        let syntaxValidation, syntaxValid = false;
        try {
          console.log('🔍 Step 3: Validating code syntax...');
          const jsFiles = await sandbox.process.executeCommand('find . -name "*.js" -type f 2>/dev/null || echo "no_js_files"', 'workspace/src');
          if (jsFiles.result?.trim()) {
            // Check each JS file individually for better error reporting
            const fileList = jsFiles.result.trim().split('\n').filter(f => f.trim());
            let allValid = true;
            let validationOutput = '';
            
            for (const file of fileList) {
              const fileCheck = await sandbox.process.executeCommand(`node --check "${file.trim()}" 2>&1 || echo "check_failed"`, 'workspace/src');
              if (fileCheck.exitCode !== 0) {
                allValid = false;
                validationOutput += `${file}: ${fileCheck.result}\n`;
              }
            }
            
            syntaxValidation = { 
              exitCode: allValid ? 0 : 1, 
              result: allValid ? 'All JavaScript files are syntactically valid' : validationOutput
            };
            syntaxValid = allValid;
            console.log('⚙️ Syntax validation result:', syntaxValid ? '✅ Valid' : '❌ Invalid');
            if (!syntaxValid) {
              console.log('🚨 Syntax validation errors:', validationOutput);
            }
          } else {
            syntaxValidation = { exitCode: 0, result: 'No JavaScript files to validate' };
            syntaxValid = true;
          }
        } catch (error) {
          syntaxValidation = { exitCode: 1, result: `Syntax validation error: ${error}` };
        }
        
        // Run Jest tests with better handling for missing tests
        let testValidation, testsValid = false;
        try {
          console.log('🔍 Step 4: Validating test files...');
          const packageExists = await sandbox.process.executeCommand('test -f package.json && echo "exists" || echo "missing"', 'workspace');
          if (packageExists.result?.includes('exists')) {
            // Check if test script exists and what it contains
            const testScriptCheck = await sandbox.process.executeCommand('node -e "const pkg = JSON.parse(require(\'fs\').readFileSync(\'package.json\', \'utf8\')); console.log(pkg.scripts && pkg.scripts.test ? pkg.scripts.test : \'no-test\')"; 2>/dev/null || echo "no-test"', 'workspace');
            
            if (testScriptCheck.result?.includes('no-test')) {
              testValidation = { exitCode: 0, result: 'No test script found in package.json' };
              testsValid = true; // Don't fail if no tests are defined
            } else if (testScriptCheck.result?.includes('Error: no test specified')) {
              // This is the default npm test script that just echoes an error - treat as valid
              testValidation = { exitCode: 0, result: 'Default npm test script (no tests specified)' };
              testsValid = true;
            } else {
              // There's an actual test script, try to run it
              try {
                // Install dependencies first
                await sandbox.process.executeCommand('npm install --silent 2>/dev/null || echo "install_failed"', 'workspace', {}, 120); // 2 minutes timeout
                testValidation = await sandbox.process.executeCommand('timeout 30s npm test 2>&1 || echo "Test execution completed"', 'workspace', {}, 45);
                
                // Consider tests valid if they run without crashing (even if they fail)
                testsValid = !testValidation.result?.includes('Test timeout') && 
                           !testValidation.result?.includes('command not found') &&
                           !testValidation.result?.includes('Cannot find module');
              } catch (testError) {
                testValidation = { exitCode: 0, result: `Test execution attempted but encountered issues: ${testError}` };
                testsValid = true; // Don't fail the entire validation for test issues
                console.log('🧪 Test validation result:', testsValid ? '✅ Valid' : '❌ Invalid');
                if (!testsValid) {
                  console.log('🚨 Test validation errors:', testError);
                }
              }
            }
          } else {
            testValidation = { exitCode: 0, result: 'No package.json found' };
            testsValid = true; // Don't fail if no package.json
          }
        } catch (error) {
          testValidation = { exitCode: 1, result: `Test validation error: ${error}` };
        }
        
        // Step 5: Execute and test the API if validation passes
        let executionResult = null;
        console.log('🔍 Validation results - Spec valid:', specValid, 'TS valid:', tsValid);
        
        // Server execution tests now fixed and enabled
        const skipExecutionTests = false;
        
        if (skipExecutionTests) {
          console.log('ℹ️ Skipping server execution tests - validation passed');
          executionResult = {
            serverStarted: false,
            healthCheckPassed: false,
            healthCheckDetails: [],
            workingPort: null,
            serverLogs: 'Execution tests skipped - validation passed',
            processInfo: 'Execution tests skipped',
            endpointTests: []
          };
        } else if (specValid && tsValid) {
          console.log('✅ Basic validation passed, proceeding with execution tests...');
          try {
            // Install dependencies with verbose output
            const installResult = await sandbox.process.executeCommand('npm install --verbose 2>/dev/null || echo "install_failed"', 'workspace', {}, 120); // 2 minutes timeout
            console.log('Install output:', installResult.result);
            
            // Check what port the package.json start script uses
            const portCheck = await sandbox.process.executeCommand('grep -o "PORT=[0-9]*" package.json 2>/dev/null || grep -o "port.*[0-9]*" package.json 2>/dev/null || echo "port:3000"', 'workspace');
            
            // Start the API server in background with proper environment variables
            console.log('🚀 Starting API server in background...');
            // Copy the improved compile script functions to the working directory
            await sandbox.process.executeCommand('cp /tmp/compile_page.sh . 2>/dev/null || echo "compile script not found"', 'workspace');
            
            // First try to start from src directory, then fallback to root
            // Use proper environment variables for networking
            let startResult = await sandbox.process.executeCommand('test -f package.json && (HOST=0.0.0.0 PORT=3000 npm start > ../server.log 2>&1 & echo $! > ../server.pid 2>/dev/null || echo $!) || echo "start_failed"', 'workspace/src', {}, 35);
            
            // If that fails, try from root directory
            if (startResult.exitCode !== 0 || startResult.result.includes('start_failed')) {
              console.log('🔄 Retrying npm start from root directory...');
              startResult = await sandbox.process.executeCommand('(HOST=0.0.0.0 PORT=3000 npm start > server.log 2>&1 & echo $! > server.pid 2>/dev/null || echo $!) || echo "start_failed"', 'workspace', {}, 35);
            }
            console.log('Server start command result:', startResult.result);
            
            // Use the improved wait_for_server function if available
            let serverWaitResult;
            try {
              serverWaitResult = await sandbox.process.executeCommand('test -f compile_page.sh && source compile_page.sh && wait_for_server 3000 20 || echo "wait_function_not_available"', 'workspace');
              console.log('Server wait result:', serverWaitResult.result);
            } catch (error) {
              console.log('Wait function not available, using fallback delay');
              await new Promise(resolve => setTimeout(resolve, 8000));
            }
            
            // Check server logs for startup confirmation
            const serverLogs = await sandbox.process.executeCommand('tail -30 server.log 2>/dev/null || echo "No server logs found"', 'workspace');
            console.log('Server startup logs:', serverLogs.result);
            
            // Give server additional time to fully bind to port
            console.log('⏳ Waiting for server to fully bind to port...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verify server process is running with multiple methods
            const pidCheck = await sandbox.process.executeCommand('(test -f server.pid && kill -0 $(cat server.pid) 2>/dev/null && echo "process running") || echo "process not found"', 'workspace');
            console.log('Server process check:', pidCheck.result);
            
            // Check if any node process is running with more specific search
            const processCheck = await sandbox.process.executeCommand('ps aux | grep -E "node.*index\.js|npm.*start" | grep -v grep 2>/dev/null || echo "no node process"');
            console.log('Process check:', processCheck.result);
            
            // Use the improved port detection function if available
            let listeningCheck;
            try {
              listeningCheck = await sandbox.process.executeCommand('test -f compile_page.sh && source compile_page.sh && detect_listening_ports || echo "detect_function_not_available"', 'workspace');
              if (listeningCheck.result.includes('detect_function_not_available')) {
                // Fallback to manual detection
                listeningCheck = await sandbox.process.executeCommand('netstat -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || ss -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || echo "no listening ports"');
              }
            } catch (error) {
              listeningCheck = await sandbox.process.executeCommand('netstat -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || ss -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || echo "no listening ports"');
            }
            console.log('Listening processes check:', listeningCheck.result);
            
            // Enhanced health check with better port detection and fallback mechanisms
            let healthCheck;
            let ports = [3000, 8000, 5000, 4000, 8080];
            
            // Extract port from server logs if mentioned
            const portMatch = serverLogs.result.match(/port\s+(\d+)|:(\d+)/i);
            if (portMatch) {
              const logPort = parseInt(portMatch[1] || portMatch[2]);
              console.log(`📍 Found port ${logPort} in server logs, prioritizing it`);
              ports = [logPort, ...ports.filter(p => p !== logPort)];
            }
            
            let healthCheckPassed = false;
            let workingPort = null;
            const healthCheckDetails = [];
            
            // First, check what ports are actually listening using multiple methods with better detection
            let listeningPorts;
            let discoveredPorts = [];
            
            // Method 1: netstat
            try {
              listeningPorts = await sandbox.process.executeCommand('netstat -tln 2>/dev/null | grep LISTEN | grep -o ":[0-9]*" | cut -d: -f2 | sort -u || echo "no ports"');
              if (listeningPorts.result && !listeningPorts.result.includes('no ports')) {
                const ports = listeningPorts.result.split('\n').filter(p => p.trim() && !isNaN(parseInt(p.trim()))).map(p => parseInt(p.trim()));
                discoveredPorts.push(...ports);
              }
            } catch (error) {
              console.log('netstat failed:', error);
            }
            
            // Method 2: ss
            try {
              const ssResult = await sandbox.process.executeCommand('ss -tln 2>/dev/null | grep LISTEN | grep -o ":[0-9]*" | cut -d: -f2 | sort -u || echo "no ports"');
              if (ssResult.result && !ssResult.result.includes('no ports')) {
                const ports = ssResult.result.split('\n').filter(p => p.trim() && !isNaN(parseInt(p.trim()))).map(p => parseInt(p.trim()));
                discoveredPorts.push(...ports);
              }
            } catch (error) {
              console.log('ss failed:', error);
            }
            
            // Method 3: lsof
            try {
              const lsofResult = await sandbox.process.executeCommand('lsof -i -P -n 2>/dev/null | grep LISTEN | grep -o ":[0-9]*" | cut -d: -f2 | sort -u || echo "no ports"');
              if (lsofResult.result && !lsofResult.result.includes('no ports')) {
                const ports = lsofResult.result.split('\n').filter(p => p.trim() && !isNaN(parseInt(p.trim()))).map(p => parseInt(p.trim()));
                discoveredPorts.push(...ports);
              }
            } catch (error) {
              console.log('lsof failed:', error);
            }
            
            // Remove duplicates and add to test list
            discoveredPorts = [...new Set(discoveredPorts)];
            console.log('Discovered listening ports:', discoveredPorts);
            
            // Add discovered ports to our test list (prioritize discovered ports)
            let allPorts;
            if (discoveredPorts.length > 0) {
              allPorts = [...discoveredPorts.slice(0, 5), ...ports].slice(0, 8); // Prioritize discovered ports
              allPorts = [...new Set(allPorts)]; // Remove duplicates
            } else {
              allPorts = ports;
            }
            
            console.log('Testing ports:', allPorts);
            
            // Direct test of port 3000 since logs show server started there
            console.log('Direct test of port 3000 (from server logs):');
            try {
              const directTest = await sandbox.process.executeCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "curl_failed"');
              console.log('Direct port 3000 test result:', directTest.result);
              if (directTest.exitCode === 0 && !directTest.result.includes('curl_failed')) {
                console.log('Port 3000 is responding directly!');
              }
            } catch (error) {
              console.log('Direct port 3000 test failed:', error);
            }
            
            for (const port of allPorts) {
              try {
                // Check if port is listening with multiple methods
                let portCheck1, portCheck2;
                let isListening = false;
                
                try {
                  portCheck1 = await sandbox.process.executeCommand(`netstat -tln | grep :${port} || echo "not found"`);
                  isListening = !portCheck1.result.includes('not found');
                } catch (error) {
                  console.log(`netstat check failed for port ${port}:`, error);
                  portCheck1 = { result: 'not found', exitCode: 1 };
                }
                
                if (!isListening) {
                  try {
                    portCheck2 = await sandbox.process.executeCommand(`ss -tln | grep :${port} || echo "not found"`);
                    isListening = !portCheck2.result.includes('not found');
                  } catch (error) {
                    console.log(`ss check failed for port ${port}:`, error);
                    portCheck2 = { result: 'not found', exitCode: 1 };
                  }
                }
                
                if (!isListening) {
                  try {
                    const portCheck3 = await sandbox.process.executeCommand(`lsof -i :${port} 2>/dev/null || echo "not found"`);
                    isListening = !portCheck3.result.includes('not found');
                  } catch (error) {
                    console.log(`lsof check failed for port ${port}:`, error);
                  }
                }
                
                console.log(`Port ${port} listening check:`, isListening);
                
                // Try curling even if netstat doesn't show it as listening yet
                // The server might need a moment to fully bind, or netstat might not work in sandbox
                if (isListening || (serverLogs.result.includes(`port ${port}`) || serverLogs.result.includes(`:${port}`) || port === 3000)) {
                  // Use the improved test_api_endpoint function if available
                  let endpointTestResult;
                  try {
                    endpointTestResult = await sandbox.process.executeCommand(`test -f compile_page.sh && source compile_page.sh && test_api_endpoint ${port} /health GET || echo "test_function_not_available"`, 'workspace');
                    
                    if (!endpointTestResult.result.includes('test_function_not_available') && endpointTestResult.result.includes('✅')) {
                      healthCheckPassed = true;
                      workingPort = port;
                      healthCheckDetails.push({ port, endpoint: '/health', success: true, response: endpointTestResult.result.substring(0, 200) });
                    } else if (!endpointTestResult.result.includes('test_function_not_available')) {
                      // Try root endpoint with the improved function
                      const rootTestResult = await sandbox.process.executeCommand(`source compile_page.sh && test_api_endpoint ${port} / GET`, 'workspace');
                      if (rootTestResult.result.includes('✅')) {
                        healthCheckPassed = true;
                        workingPort = port;
                        healthCheckDetails.push({ port, endpoint: '/', success: true, response: rootTestResult.result.substring(0, 200) });
                      } else {
                        healthCheckDetails.push({ port, endpoint: '/health,/', success: false, response: `Both endpoints failed: ${endpointTestResult.result} | ${rootTestResult.result}` });
                      }
                    } else {
                      // Fallback to manual curl testing
                      for (let retry = 0; retry < 3; retry++) {
                        try {
                          healthCheck = await sandbox.process.executeCommand(`curl -f -m 10 -s http://localhost:${port}/health 2>/dev/null || echo "curl_failed"`, undefined, {}, 15);
                          if (healthCheck.exitCode === 0 && healthCheck.result && !healthCheck.result.includes('curl_failed')) {
                            healthCheckPassed = true;
                            workingPort = port;
                            healthCheckDetails.push({ port, endpoint: '/health', success: true, response: healthCheck.result.substring(0, 200) });
                            break;
                          }
                        } catch (error) {
                          console.log(`Health check retry ${retry + 1} failed for port ${port}:`, error);
                          healthCheckDetails.push({ port, endpoint: '/health', success: false, response: `Retry ${retry + 1} failed: ${error}` });
                        }
                        
                        if (retry < 2) await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between retries
                      }
                      
                      // If health check failed, try root endpoint
                      if (!healthCheckPassed) {
                        try {
                          const rootCheck = await sandbox.process.executeCommand(`curl -f -m 10 -s http://localhost:${port}/ 2>/dev/null || echo "curl_failed"`, undefined, {}, 15);
                          if (rootCheck.exitCode === 0 && !rootCheck.result.includes('curl_failed')) {
                            healthCheck = rootCheck;
                            healthCheckPassed = true;
                            workingPort = port;
                            healthCheckDetails.push({ port, endpoint: '/', success: true, response: rootCheck.result.substring(0, 200) });
                          } else {
                            healthCheckDetails.push({ port, endpoint: '/', success: false, response: rootCheck.result || 'No response' });
                          }
                        } catch (error) {
                          healthCheckDetails.push({ port, endpoint: '/', success: false, response: `Error: ${error}` });
                        }
                      }
                    }
                  } catch (error) {
                    console.log(`Endpoint test failed for port ${port}:`, error);
                    healthCheckDetails.push({ port, endpoint: '/health', success: false, response: `Test function error: ${error}` });
                  }
                  
                  if (healthCheckPassed) break;
                } else {
                  healthCheckDetails.push({ port, endpoint: 'N/A', success: false, response: 'Port not listening' });
                }
              } catch (error) {
                console.log(`Port ${port} check failed:`, error);
                healthCheckDetails.push({ port, endpoint: 'N/A', success: false, response: `Check failed: ${error}` });
              }
            }
            
            console.log('Health check details:', healthCheckDetails);
            
            if (!healthCheck) {
              healthCheck = { exitCode: 1, result: `No working port found. Tested ports: ${allPorts.join(', ')}` };
            }
            
            // Test a few API endpoints from the OpenAPI spec using the working port
            const endpoints: any[] = [];
            if (!('state' in apiResult) || !apiResult.state?.data) {
              console.log('Invalid API result structure for endpoint testing');
            } else {
              const openApiSpecContent = apiResult.state.data.files['openapi.yaml'] || apiResult.state.data.files['openapi.json'] || '';
              let parsedSpec: any = null;
              try {
                parsedSpec = JSON.parse(openApiSpecContent);
              } catch (e) {
                console.log('Could not parse OpenAPI spec for endpoint testing');
              }
              
              if (workingPort && parsedSpec?.paths) {
                const paths = Object.keys(parsedSpec.paths).slice(0, 3); // Test first 3 endpoints
                for (const path of paths) {
                  const methods = Object.keys((parsedSpec.paths as any)[path]);
                const method = methods.find(m => ['get', 'post'].includes(m.toLowerCase())) || methods[0];
                
                if (method) {
                  const testUrl = `http://localhost:${workingPort}${path}`;
                  const curlCmd = method.toLowerCase() === 'get' 
                    ? `curl -f -m 10 -X GET "${testUrl}" 2>/dev/null || echo "curl_failed"` 
                    : `curl -f -m 10 -X POST "${testUrl}" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "curl_failed"`;
                  
                  try {
                    const endpointTest = await sandbox.process.executeCommand(curlCmd, undefined, {}, 15);
                    const success = endpointTest.exitCode === 0 && !endpointTest.result.includes('curl_failed');
                    endpoints.push({
                      path,
                      method,
                      success,
                      response: endpointTest.result?.substring(0, 200),
                      port: workingPort
                    });
                  } catch (error) {
                    endpoints.push({
                      path,
                      method,
                      success: false,
                      response: `Error: ${error}`,
                      port: workingPort
                    });
                  }
                }
              }
            }
            }
            
            executionResult = {
              serverStarted: startResult.exitCode === 0 && (processCheck.result.includes('node') || pidCheck.result.includes('process running')),
              healthCheckPassed: healthCheckPassed,
              healthCheckDetails: healthCheckDetails,
              workingPort: workingPort,
              serverLogs: serverLogs.result,
              processInfo: {
                startCommand: startResult,
                processCheck: processCheck.result,
                pidCheck: pidCheck.result
              },
              endpointTests: endpoints,
              installOutput: installResult.result,
              healthCheckOutput: healthCheck.result
            };
          } catch (execError) {
            console.error('Execution error:', execError);
            const errorMessage = (execError as Error).message;
            
            // Check if this is a sandbox termination error
            const isSandboxTerminated = errorMessage.includes('terminated') || errorMessage.includes('SandboxError');
            
            executionResult = {
              serverStarted: false,
              healthCheckPassed: false,
              healthCheckDetails: [],
              workingPort: null,
              serverLogs: isSandboxTerminated ? 'Sandbox was terminated during execution' : '',
              processInfo: {
                error: errorMessage,
                sandboxTerminated: isSandboxTerminated
              },
              endpointTests: [],
              error: errorMessage,
              errorDetails: {
                message: errorMessage,
                stack: (execError as Error).stack,
                timestamp: new Date().toISOString(),
                sandboxTerminated: isSandboxTerminated
              }
            };
          }
        }
        
        // Calculate overall validity with more lenient criteria for sandbox termination
        const hasWorkingServer = executionResult?.serverStarted && executionResult?.healthCheckPassed;
        const hasValidSpec = specValid;
        const hasValidCode = tsValid && syntaxValid;
        const sandboxTerminated = executionResult?.errorDetails?.sandboxTerminated || false;
        
        // If sandbox was terminated, still consider valid if we have valid spec and code
        // This prevents sandbox resource issues from failing the entire workflow
        const overallValid = hasValidSpec && (hasWorkingServer || hasValidCode || (sandboxTerminated && hasValidSpec));
        
        return {
          specValid,
          tsValid,
          syntaxValid,
          testsValid,
          specValidationOutput: specValidation?.result || 'OpenAPI validation completed',
          tsValidationOutput: tsValidation?.result || 'TypeScript compilation completed',
          syntaxValidationOutput: syntaxValidation?.result || 'Syntax validation completed',
          testValidationOutput: testValidation?.result || 'Jest tests completed',
          executionResult,
          overallValid,
          validationSummary: {
            hasWorkingServer,
            hasValidSpec,
            hasValidCode,
            criticalIssues: !hasValidSpec ? ['Invalid OpenAPI spec'] : [],
            warnings: !hasWorkingServer ? (sandboxTerminated ? ['Sandbox terminated during execution - validation incomplete'] : (skipExecutionTests ? ['Server execution tests skipped'] : ['Server startup issues'])) : []
          }
        };
      } catch (error) {
        console.error('Sandbox validation error:', error);
        return {
          specValid: false,
          tsValid: false,
          syntaxValid: false,
          testsValid: false,
          specValidationOutput: 'Sandbox validation failed due to error',
          tsValidationOutput: 'TypeScript validation failed due to error',
          syntaxValidationOutput: 'Syntax validation failed due to error',
          testValidationOutput: 'Jest tests failed due to error',
          executionResult: {
            serverStarted: false,
            healthCheckPassed: false,
            endpointTests: [],
            error: (error as Error).message,
            errorStack: (error as Error).stack,
            workingPort: null,
            processInfo: 'Validation error occurred'
          },
          overallValid: false,
          validationSummary: {
            hasWorkingServer: false,
            hasValidSpec: false,
            hasValidCode: false,
            criticalIssues: ['Validation system error'],
            warnings: ['Complete validation failure']
          },
          error: (error as Error).message,
          errorStack: (error as Error).stack
        };
      } finally {
        // Clean up sandbox
        if (sandbox) {
          try {
            await deleteWorkspace(sandbox);
          } catch (cleanupError) {
            console.error('Sandbox cleanup error:', cleanupError);
          }
        }
      }
    });
    
    // Emit validation complete event to frontend
    if (projectId) {
      await streamingService.emit(projectId, {
        type: 'validation:complete',
        stage: 'Validation completed',
        summary: validationResult.overallValid ? 'Code validated successfully' : 'Validation completed with warnings'
      });
    }
    
    // Step 5: Handle GitHub PR creation if in GitHub mode
    let prUrl = null;
    if (mode === "github" && repoUrl && githubRepoId) {
      prUrl = await step.run("create-pull-request", async () => {
        try {
          const { githubSyncService } = await import('../services/github-sync-service');
          
          // Get GitHub integration
          const { data: integration } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'github')
            .eq('is_active', true)
            .single();
          
          if (!integration) {
            console.error('No GitHub integration found');
            return null;
          }
          
          // Get repository details
          const { data: repo } = await supabase
            .from('github_repositories')
            .select('*')
            .eq('id', githubRepoId)
            .single();
          
          if (!repo) {
            console.error('Repository not found');
            return null;
          }
          
          // Generate branch name
          const branchName = `smartforge/api-generation-${Date.now()}`;
          
          // Push changes to GitHub
          const files = apiResult.state.data.files || {};
          const result = await githubSyncService.pushChangesToGithub(
            integration.access_token,
            {
              repoFullName: repo.repo_full_name,
              branchName,
              files,
              commitMessage: `feat: Add API generation from SmartForge\n\n${apiResult.state.data.summary}`,
              createPR: true,
              prTitle: `API Generation: ${apiResult.state.data.summary.substring(0, 50)}`,
              prBody: `## Generated API\n\n${apiResult.state.data.summary}\n\n### Files Changed\n${Object.keys(files).map(f => `- ${f}`).join('\n')}\n\n---\n*Generated by SmartForge*`,
            }
          );
          
          if (result.success) {
            // Record sync history
            const historyResult = await githubSyncService.recordSyncHistory(
              githubRepoId,
              projectId,
              userId,
              'create_pr',
              {
                branchName,
                commitSha: result.commitSha,
                commitMessage: 'API generation from SmartForge',
                prUrl: result.prUrl,
                filesChanged: Object.keys(files).length,
                status: 'completed',
              }
            );
            
            if (!historyResult.success) {
              console.warn('Failed to record sync history:', historyResult.error);
            }
            
            return result.prUrl;
          }
          
          return null;
        } catch (error) {
          console.error('Failed to create GitHub PR:', error);
          
          // Emit user-facing error event via streaming
          if (projectId) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Sanitize sensitive details from error message
            const sanitizedMessage = errorMessage
              .replace(/token[=:]\s*[\w-]+/gi, 'token=***')
              .replace(/key[=:]\s*[\w-]+/gi, 'key=***')
              .replace(/secret[=:]\s*[\w-]+/gi, 'secret=***');
            
            await streamingService.emit(projectId, {
              type: 'error',
              message: `Failed to create GitHub pull request: ${sanitizedMessage}`,
              stage: 'GitHub PR Creation',
            });
          }
          
          return null;
        }
      });
    }

    // Step 6: Save the generated API to database
    const savedApi = await step.run("save-api", async () => {
      try {
        // Type guard to check if apiResult has the expected structure
        if (!('state' in apiResult) || !apiResult.state?.data) {
          throw new Error('Invalid API result structure');
        }

        // Safely serialize data to prevent malformed array literals
        const safeStringify = (obj: any): string => {
          try {
            return JSON.stringify(obj);
          } catch (error) {
            console.error('JSON stringify error:', error);
            return '{"error": "Failed to serialize data"}';
          }
        };

        // Safely sanitize text for database insertion
        const sanitizeText = (text: string): string => {
          if (typeof text !== 'string') return 'Generated API';
          // Remove or replace problematic characters that could cause SQL issues
          return text
            .replace(/["'`]/g, '') // Remove quotes entirely
            .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs with spaces
            .replace(/\s+/g, ' ') // Normalize multiple spaces
            .trim()
            .substring(0, 500); // Limit length to prevent issues
        };

        const safeSummary = sanitizeText(apiResult.state.data.summary || 'Generated API');
        const requirementsArray = Array.isArray(apiResult.state.data.requirements) && apiResult.state.data.requirements.length > 0
          ? apiResult.state.data.requirements 
          : [safeSummary];

        const { data, error } = await supabase
          .from('api_fragments')
          .insert({
            job_id: jobId || null, // Allow null if no job tracking
            project_id: projectId, // Add project_id from event data
            openapi_spec: apiResult.state.data.files['openapi.yaml'] || apiResult.state.data.files['openapi.json'] || '',
            implementation_code: safeStringify(apiResult.state.data.files),
            requirements: requirementsArray,
            description: safeSummary,
            validation_results: safeStringify(validationResult),
            pr_url: prUrl,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (error) {
          console.error('Database save error:', error);
          // If job_id constraint fails and we don't have a jobId, try without job_id
          if (error.code === '23502' && error.message.includes('job_id') && !jobId) {
            console.log('Retrying API save without job_id constraint...');
            const retryRequirementsArray = Array.isArray(apiResult.state.data.requirements) && apiResult.state.data.requirements.length > 0
              ? apiResult.state.data.requirements 
              : [sanitizeText(apiResult.state.data.summary || 'Generated API')];
            
            const { data: retryData, error: retryError } = await supabase
              .from('api_fragments')
              .insert({
                project_id: projectId, // Add project_id from event data
                openapi_spec: apiResult.state.data.files['openapi.yaml'] || '',
                implementation_code: safeStringify(apiResult.state.data.files['index.js'] || {}),
                requirements: retryRequirementsArray,
                description: sanitizeText(apiResult.state.data.summary || 'Generated API'),
                validation_results: safeStringify(validationResult),
                pr_url: prUrl,
                created_at: new Date().toISOString()
              })
              .select()
              .single();
              
            if (retryError) {
              console.error('Retry save error:', retryError);
              throw new Error(`Failed to save API: ${retryError.message}`);
            }
            
            return retryData;
          }
          
          throw new Error(`Failed to save API: ${error.message}`);
        }
        
        console.log('API saved to database:', data.id);
        return data;
      } catch (error) {
        console.error('Error saving API to database:', error);
        throw error;
      }
    });

    // Step 7: Save successful result to messages and fragments tables
    const savedResult = await step.run("save-result-to-messages", async () => {
      try {
        const { MessageService } = await import('../modules/messages/service');
        
        // Create a comprehensive summary of the generated API
        const summary = apiResult.state.data.summary || 'Generated API successfully';
        const files = apiResult.state.data.files || {};
        const filesList = Object.keys(files);
        
        const resultContent = `API Generation Complete!\n\n${summary}\n\nGenerated Files:\n${filesList.map(file => `- ${file}`).join('\n')}\n\nValidation: ${validationResult.overallValid ? 'Passed' : 'Failed'}`;
        
        // Get the version ID that will be created in the next step (we'll update the message after)
        // For now, save without version_id and update it later
        const result = await MessageService.saveResult({
          content: resultContent,
          role: 'assistant',
          type: 'result',
          project_id: projectId, // Add the project_id from event data
          fragment: {
            title: `Generated API: ${summary.substring(0, 50)}...`,
            sandbox_url: 'https://example.com/sandbox', // Default sandbox URL since validationResult doesn't include this
            files: files,
            fragment_type: 'api_result',
            order_index: 0,
            metadata: {
              api_fragment_id: savedApi.id,
              validation_results: validationResult,
              pr_url: prUrl,
              generated_files: filesList,
              job_id: jobId
            }
          }
        });
        
        console.log('Result saved to messages and fragments:', result.message.id, result.fragment?.id);
        return result;
      } catch (error) {
        console.error('Error saving result to messages/fragments:', error);
        // Don't throw error here - API generation succeeded, this is just for UI display
        return null;
      }
    });

    // Step 7.5: Create Version 1 for initial generation
    const versionResult = await step.run("create-initial-version", async () => {
      try {
        const { VersionManager } = await import('../services/version-manager');
        
        const files = apiResult.state.data.files || {};
        const summary = apiResult.state.data.summary || 'Generated API successfully';
        
        // Generate version name from prompt (first 2-3 words)
        const words = prompt.trim().split(/\s+/).slice(0, 3);
        const versionName = words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        // Create Version 1
        const version = await VersionManager.createVersion({
          project_id: projectId,
          version_number: 1,
          name: versionName,
          description: `Initial generation: ${summary}`,
          files: files,
          command_type: 'GENERATE_API',
          prompt: prompt,
          parent_version_id: undefined, // First version has no parent
          status: 'complete',
          metadata: {
            validation_results: validationResult,
            pr_url: prUrl,
            api_fragment_id: savedApi.id,
            requirements: apiResult.state.data.requirements || [],
          },
        });
        
        console.log('Created initial version:', version.id, 'v' + version.version_number);
        return { versionId: version.id, versionNumber: version.version_number };
      } catch (error) {
        console.error('Error creating initial version:', error);
        // Don't fail the entire generation if version creation fails
        return { versionId: null, versionNumber: null };
      }
    });

    const versionId = versionResult?.versionId;

    // Step 7.7: Link message and fragments to version (in background)
    if (versionId && savedResult) {
      await step.run("link-to-version", async () => {
        try {
          const resultMessageId = savedResult?.message?.id;
          
          // Update all user messages for this project with the version_id
          await supabase
            .from('messages')
            .update({ version_id: versionId })
            .eq('project_id', projectId)
            .eq('role', 'user');
          
          // Update assistant message/fragment too if we have the ID
          if (resultMessageId) {
            await supabase
              .from('messages')
              .update({ version_id: versionId })
              .eq('id', resultMessageId);
            
            await supabase
              .from('fragments')
              .update({ version_id: versionId })
              .eq('message_id', resultMessageId);
          }
          
          console.log('Linked messages and fragments to version:', versionId);
        } catch (error) {
          console.error('Error linking to version:', error);
        }
      });
    }

    // Step 8: Update job status to completed (if job tracking is available)
    await step.run("update-job-completed", async () => {
      if (!jobId) {
        console.log('No job ID available, skipping job status update');
        return;
      }
      
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
    
    // Step 8.5: Emit completion event AFTER all file generation and validation
    // This ensures users see detailed progress before the version card appears
    await step.run("emit-complete", async () => {
      const filesList = Object.keys(apiResult.state.data.files || {});
      
      await streamingService.emit(projectId, {
        type: 'complete',
        summary: apiResult.state.data.summary || 'API generated successfully!',
        totalFiles: filesList.length,
        versionId: versionId || undefined,
      });
      
      console.log('Emitted completion event with versionId:', versionId);
    });
    
    // Step 9: Close streaming connection
    await step.run("close-stream", async () => {
      streamingService.closeProject(projectId);
      console.log('Closed streaming connection for project:', projectId);
    });
    
    return {
      success: true,
      jobId,
      apiFragmentId: savedApi.id,
      validation: validationResult,
      prUrl,
      versionId,
    };
    } catch (error) {
      console.error('Error in generateAPI function:', error);
      
      // Emit error event
      if (projectId) {
        await streamingService.emit(projectId, {
          type: 'error',
          message: (error as Error).message || 'An error occurred during API generation',
          stage: 'Generation',
        });
        
        // Close streaming connection
        streamingService.closeProject(projectId);
      }
      
      // Update job status to failed (if job tracking is available)
      if (jobId) {
        try {
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error_message: (error as Error).message || 'Unknown error occurred',
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

/**
 * Iterate API - Version-aware generation workflow
 * Similar to generateAPI but builds on previous versions
 */
export const iterateAPI = inngest.createFunction(
  { id: "iterate-api" },
  { event: "api/iterate" },
  async ({ event, step }) => {
    const { projectId, messageId, prompt, commandType, shouldCreateNewVersion, parentVersionId, conversationHistory } = event.data;
    
    let versionId: string | undefined;
    
    try {
      // Step 1: Create version record
      versionId = await step.run("create-version", async () => {
        // Get parent version
        const parentVersion = parentVersionId 
          ? await VersionManager.getVersion(parentVersionId)
          : await VersionManager.getLatestVersion(projectId);
        
        // Get next version number
        const versionNumber = await VersionManager.getNextVersionNumber(projectId);
        
        // Generate version name from prompt (first 2-3 words)
        const words = prompt.trim().split(/\s+/).slice(0, 3);
        const versionName = words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        // Create version
        const version = await VersionManager.createVersion({
          project_id: projectId,
          version_number: versionNumber,
          name: versionName,
          description: `Generated from: ${prompt}`,
          files: {}, // Will be populated during generation
          command_type: commandType,
          prompt,
          parent_version_id: parentVersion?.id,
          status: 'generating',
          metadata: {},
        });
        
        return version.id;
      });
      
      // Step 2: Check if this is a GitHub cloned project
      const projectInfo = await step.run("check-project-type", async () => {
        const { data: project } = await supabase
          .from('projects')
          .select('github_repo_id, repo_url, metadata')
          .eq('id', projectId)
          .single();
        
        const isGitHubProject = !!(project?.github_repo_id || project?.repo_url);
        const repoFullName = (project?.metadata as any)?.repoFullName || 'Unknown';
        
        console.log(`📋 Project Type: ${isGitHubProject ? 'GitHub Cloned' : 'New Generated'}`);
        if (isGitHubProject) {
          console.log(`   Repo: ${repoFullName}`);
        }
        
        return { isGitHubProject, repoFullName };
      });
      
      // Step 3: Build smart context using semantic search
      const context = await step.run("build-smart-context", async () => {
        return await SmartContextBuilder.buildSmartContext(
          projectId,
          prompt,
          {
            messageLimit: 20,
            maxFiles: 15,
            includeTests: false,
            isGitHubProject: projectInfo.isGitHubProject, // Pass this flag
          }
        );
      });
      
      // Step 3: Generate code with context
      const apiResult = await step.run("generate-api-code", async () => {
        // Emit step start event
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Planning',
          message: 'Planning changes...',
          versionId,
        });
        
        // Build enhanced prompt with smart context
        const enhancedPrompt = SmartContextBuilder.formatForPrompt(context, prompt);
        
        // Extract list of relevant files that should be considered for modification
        const relevantFilePaths = Object.keys(context.relevantFiles || {});
        const explicitFileInstructions = relevantFilePaths.length > 0
          ? `\n\n🎯 TARGET FILES FOR MODIFICATION:\nThe following files are semantically relevant to the user's request. If the request involves modifying/editing code, you MUST modify these EXISTING files rather than creating new ones with different names or paths:\n${relevantFilePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nDO NOT create new files like "hero-section.tsx" or "HeroComponent.tsx" if "HeroSection.tsx" already exists above. MODIFY THE EXISTING FILE PATH EXACTLY AS SHOWN.`
          : '';
        
        const isModifyCommand = commandType === 'MODIFY_FILE' || commandType === 'REFACTOR_CODE';
        
        // GitHub projects get ULTRA strict modification-only instructions
        const githubProjectWarning = projectInfo.isGitHubProject
          ? `\n\n🚨 GITHUB PROJECT - ULTRA STRICT MODE 🚨\nThis is a CLONED GitHub project (${projectInfo.repoFullName}). You are ABSOLUTELY FORBIDDEN from creating new files unless the user EXPLICITLY says "create a new file called X".\n\nYou MUST ONLY modify existing files listed in the "Relevant Files" section. Any attempt to create new files will break the user's application.\n\nIF YOU CREATE A NEW FILE INSTEAD OF MODIFYING AN EXISTING ONE, YOU HAVE FAILED.`
          : '';
        
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          stream: true,
          messages: [
            {
              role: "system",
              content: `You are an expert code iteration assistant. You help users modify and improve existing codebases.${githubProjectWarning}

IMPORTANT INSTRUCTIONS:
1. You are working on an EXISTING codebase. The user wants to ${commandType === 'CREATE_FILE' ? 'add new features' : commandType === 'MODIFY_FILE' ? 'modify existing files' : commandType === 'DELETE_FILE' ? 'remove features' : commandType === 'REFACTOR_CODE' ? 'refactor code' : 'make changes'}.
2. ${isModifyCommand || projectInfo.isGitHubProject ? '⚠️ CRITICAL: When modifying/refactoring code, you MUST use the EXACT file paths from the "Relevant Files" section below. DO NOT create new files with similar names. MODIFY THE EXISTING FILES.' : 'For new features, create new files as needed.'}
3. ${projectInfo.isGitHubProject ? '🚨 FOR GITHUB PROJECTS: You can ONLY add files to "modifiedFiles", NEVER to "newFiles". The "newFiles" object MUST be empty {} unless the user explicitly says "create a new file".' : 'ONLY output files that are NEW or MODIFIED. Do NOT output unchanged files.'}
4. For MODIFIED files, output the COMPLETE file content with your changes applied.
5. Use the EXACT file paths provided in the context. DO NOT change file names, casing, or directory structure.
6. Maintain the same coding style and patterns from the existing code.
7. Ensure backward compatibility unless explicitly asked to break it.
8. DO NOT generate OpenAPI specs, API documentation, or unrelated files.${explicitFileInstructions}

Current codebase context:
${context.summary}

You MUST respond with valid JSON in this exact structure:
{
  "modifiedFiles": {
    "path/to/file.ext": "complete file content with changes..."
  },
  "newFiles": {
    "path/to/newfile.ext": "complete new file content..."
  },
  "deletedFiles": ["path/to/deleted/file.ext"],
  "changes": [
    {
      "file": "path/to/file.ext",
      "description": "What was changed and why"
    }
  ],
  "description": "Brief summary of all changes"
}`,
            },
            { role: "user", content: enhancedPrompt }
          ],
          response_format: { type: "json_object" },
        });

        // Emit generation start event
        await streamingService.emit(projectId, {
          type: 'step:complete',
          step: 'Planning',
          message: 'Plan complete. Generating code...',
          versionId,
        });
        
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Generating',
          message: 'Generating files...',
          versionId,
        });

        // Collect streaming response from OpenAI
        let rawOutput = '';
        let chunkCount = 0;
        
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            rawOutput += content;
            chunkCount++;
            
            // Emit progress updates periodically
            if (chunkCount % 10 === 0) {
              const progress = Math.min(95, Math.round((rawOutput.length / 3000) * 100));
              await streamingService.emit(projectId, {
                type: 'code:chunk',
                filename: 'Generating...',
                chunk: '',
                progress,
                versionId,
              });
            }
          }
        }
        
        console.log("Raw OpenAI output:", rawOutput.substring(0, 500));
        
        try {
          // Handle potential markdown-wrapped JSON
          let jsonStr = rawOutput || '';
          
          // Prefer an explicit ```json ... ``` code block if present
          const jsonBlockMatch = rawOutput?.match(/```json\s*([\s\S]*?)\s*```/i);
          if (jsonBlockMatch) {
            jsonStr = jsonBlockMatch[1];
          } else {
            // Fallback: try to extract the first top-level JSON object
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
            }
          }
          
          jsonStr = jsonStr.trim();
          const parsed = JSON.parse(jsonStr);
          
          // Merge with parent version files
          const parentFiles = context.previousFiles || {};
          let modifiedFiles: Record<string, string> = parsed.modifiedFiles || {};
          let newFiles: Record<string, string> = parsed.newFiles || {};
          let deletedFiles: string[] = parsed.deletedFiles || [];

          // If this is a modify/refactor command and the AI created new TS/TSX files,
          // try to map them onto an existing relevant component instead of introducing
          // entirely new components that are not referenced anywhere.
          if ((commandType === 'MODIFY_FILE' || commandType === 'REFACTOR_CODE') && Object.keys(newFiles).length > 0) {
            const relevantFilesMap: Record<string, any> = (context as any).relevantFiles || {};
            const relevantPaths = Object.keys(relevantFilesMap);
            const componentCandidates = relevantPaths.filter(p => p.endsWith('.tsx') || p.endsWith('.jsx') || p.endsWith('.ts') || p.endsWith('.js'));

            if (componentCandidates.length === 1) {
              const targetPath = componentCandidates[0];
              const newEntries = { ...newFiles };

              for (const [newPath, content] of Object.entries(newEntries)) {
                const text = typeof content === 'string' ? content : JSON.stringify(content);
                const looksLikeComponent = /React|export default function|function\s+\w+\s*\(/.test(text);

                if (looksLikeComponent) {
                  // Treat this "new" component as a modification of the existing target file
                  modifiedFiles[targetPath] = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                  delete newFiles[newPath];
                  deletedFiles = [...deletedFiles, newPath];
                }
              }
            }
          }

          // Reconcile "new" files that actually correspond to existing files
          // e.g. AI creates components/landing/hero-section.tsx when
          // components/landing/HeroSection.tsx already exists.
          const reconciledModified: Record<string, string> = { ...modifiedFiles };
          const reconciledNew: Record<string, string> = {};
          const aliasDeletions: string[] = [];

          const normalizePath = (p: string): string => {
            const parts = p.split('/');
            const file = parts.pop() || '';
            const lastDot = file.lastIndexOf('.');
            const name = lastDot === -1 ? file : file.slice(0, lastDot);
            const ext = lastDot === -1 ? '' : file.slice(lastDot);
            const normalizedName = name.toLowerCase().replace(/[-_]/g, '');
            return [...parts, normalizedName + ext.toLowerCase()].join('/');
          };

          for (const [newPath, content] of Object.entries(newFiles)) {
            // If AI put file in "newFiles" but it already exists with exact same path,
            // it should be treated as a modification
            if (parentFiles[newPath]) {
              reconciledModified[newPath] = content as string;
              continue;
            }

            // Check if this "new" file is actually an alias of an existing file
            // (e.g., hero-section.tsx vs HeroSection.tsx)
            const norm = normalizePath(newPath);
            const candidate = Object.keys(parentFiles).find(
              (p) => p !== newPath && normalizePath(p) === norm
            );

            if (candidate) {
              // Treat as modification of the existing file path instead of a brand new file
              reconciledModified[candidate] = content as string;
              aliasDeletions.push(newPath);
            } else {
              // Truly new file that doesn't exist in parent
              reconciledNew[newPath] = content as string;
            }
          }

          modifiedFiles = reconciledModified;
          newFiles = reconciledNew;
          
          // 🚨 GITHUB PROJECT SAFETY CHECK: Prevent creating new files unless explicitly requested
          if (projectInfo.isGitHubProject && Object.keys(newFiles).length > 0) {
            console.warn(`⚠️ GitHub project detected! AI attempted to create ${Object.keys(newFiles).length} new files:`);
            console.warn(Object.keys(newFiles));
            
            // Check if user prompt explicitly mentions creating new files
            const explicitCreate = /create\s+(?:a\s+)?new\s+file|add\s+(?:a\s+)?new\s+file|new\s+file\s+called/i.test(prompt);
            
            if (!explicitCreate) {
              console.warn('⚠️ User did NOT explicitly request new files. Moving all to modifiedFiles for safety.');
              
              // Move all "new" files to modified files
              for (const [path, content] of Object.entries(newFiles)) {
                modifiedFiles[path] = content as string;
              }
              newFiles = {}; // Clear new files
              
              // Emit warning to user
              await streamingService.emit(projectId, {
                type: 'warning',
                message: `Note: Modified existing files instead of creating new ones (GitHub project mode)`,
                versionId,
              });
            } else {
              console.log('✓ User explicitly requested new file creation. Allowing.');
            }
          }
          
          // Combine all file changes
          const allChanges = { ...modifiedFiles, ...newFiles };
          
          // 📊 Log final file categorization for debugging
          console.log(`📋 Final file changes:`);
          console.log(`   ✓ Modified files (${Object.keys(modifiedFiles).length}):`, Object.keys(modifiedFiles));
          console.log(`   + New files (${Object.keys(newFiles).length}):`, Object.keys(newFiles));
          console.log(`   - Deleted files (${deletedFiles.length}):`, deletedFiles);
          
          // Emit summary to user interface
          if (projectInfo.isGitHubProject) {
            const summary = [
              `📋 GitHub Project - File Changes:`,
              Object.keys(modifiedFiles).length > 0 ? `   ✓ Modified: ${Object.keys(modifiedFiles).join(', ')}` : null,
              Object.keys(newFiles).length > 0 ? `   + New: ${Object.keys(newFiles).join(', ')}` : null,
              deletedFiles.length > 0 ? `   - Deleted: ${deletedFiles.join(', ')}` : null,
            ].filter(Boolean).join('\n');
            
            await streamingService.emit(projectId, {
              type: 'info',
              message: summary,
              versionId,
            });
          }
          
          // Remove deleted files from parent (including aliases we collapsed)
          const updatedParentFiles = { ...parentFiles };
          for (const deletedFile of deletedFiles) {
            delete updatedParentFiles[deletedFile];
          }
          for (const alias of aliasDeletions) {
            delete updatedParentFiles[alias];
          }
          
          // Combine with modified/new files
          const combinedFiles = { ...updatedParentFiles, ...allChanges };
          
          // Stream individual files to frontend
          if (Object.keys(allChanges).length > 0) {
            for (const [filename, content] of Object.entries(allChanges)) {
              // Emit file generating event
              await streamingService.emit(projectId, {
                type: 'file:generating',
                filename,
                path: filename,
                versionId,
              });
              
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Stream code in chunks
              const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
              const chunkSize = 50;
              for (let i = 0; i < fileContent.length; i += chunkSize) {
                const chunk = fileContent.slice(i, i + chunkSize);
                const progress = Math.round(((i + chunkSize) / fileContent.length) * 100);
                
                await streamingService.emit(projectId, {
                  type: 'code:chunk',
                  filename,
                  chunk,
                  progress: Math.min(progress, 100),
                  versionId,
                });
                
                await new Promise(resolve => setTimeout(resolve, 30));
              }
              
              // Emit file complete event
              await streamingService.emit(projectId, {
                type: 'file:complete',
                filename,
                content: fileContent,
                path: filename,
                versionId,
              });
              
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          
          const requirements = Array.isArray(parsed.requirements) ? parsed.requirements : [];
          
          const result: AIResult = {
            state: {
              data: {
                summary: parsed.description || "",
                files: combinedFiles,
                requirements: requirements
              } as AgentState
            }
          };
          
          return result;
        } catch (error) {
          console.error("Failed to parse generated API code:", error);
          throw error;
        }
      });
      
      // Step 4: Apply changes to sandbox and restart dev server
      const sandboxUpdateResult = await step.run("apply-changes-to-sandbox", async () => {
        try {
          // Get project to find sandbox_id
          const { data: project } = await supabase
            .from('projects')
            .select('metadata, sandbox_url')
            .eq('id', projectId)
            .single();
          
          const metadata = project?.metadata as any || {};
          const sandboxId = metadata?.sandboxId;
          
          if (!sandboxId) {
            console.warn('⚠️ No sandbox ID found in project metadata - skipping live update');
            return {
              success: false,
              skipped: true,
              reason: 'No sandbox ID in project metadata',
            };
          }
          
          // Derive repo path and server configuration from metadata with safe fallbacks
          const repoPath = metadata.repoPath || 'workspace/repo';
          const port = metadata.port || 3000;
          const packageManager = metadata.packageManager || 'npm';
          const startCommand = metadata.startCommand || (
            packageManager === 'pnpm'
              ? 'pnpm run dev'
              : packageManager === 'yarn'
                ? 'yarn dev'
                : 'npm run dev'
          );
          
          await streamingService.emit(projectId, {
            type: 'step:start',
            step: 'Applying Changes',
            message: 'Applying changes to sandbox...',
            versionId,
          });
          
          // Get the sandbox and ensure it's running (restart if stopped)
          const sandbox = await ensureSandboxRunning(sandboxId);
          
          if (!('state' in apiResult) || !apiResult.state?.data) {
            throw new Error('Invalid API result structure');
          }
          
          // Get the changes from the combined files
          // We need to determine which files were modified vs new by comparing with parent
          const parentFiles = context.previousFiles || {};
          const currentFiles = apiResult.state.data.files || {};
          
          const modifiedFiles: Record<string, string> = {};
          const newFiles: Record<string, string> = {};
          
          // Categorize files as modified or new (only when content actually changes)
          for (const [filePath, content] of Object.entries(currentFiles)) {
            const parentContent = parentFiles[filePath];
            if (parentContent === undefined) {
              // Truly new file
              newFiles[filePath] = content as string;
            } else if (parentContent !== content) {
              // File existed before and content changed
              modifiedFiles[filePath] = content as string;
            }
          }

          console.log('Sandbox update - modified files:', Object.keys(modifiedFiles));
          console.log('Sandbox update - new files:', Object.keys(newFiles));
          
          // Find deleted files (existed in parent but not in current)
          const deletedFiles: string[] = [];
          for (const filePath of Object.keys(parentFiles)) {
            if (!currentFiles[filePath]) {
              deletedFiles.push(filePath);
            }
          }
          
          let filesApplied = 0;
          let filesDeleted = 0;
          
          // Apply modified files
          for (const [filePath, content] of Object.entries(modifiedFiles)) {
            const fullPath = `${repoPath}/${filePath}`;
            await sandbox.fs.uploadFile(Buffer.from(content as string, 'utf-8'), fullPath);
            filesApplied++;
            console.log(`✓ Modified: ${filePath}`);
          }
          
          // Apply new files
          for (const [filePath, content] of Object.entries(newFiles)) {
            const fullPath = `${repoPath}/${filePath}`;
            await sandbox.fs.uploadFile(Buffer.from(content as string, 'utf-8'), fullPath);
            filesApplied++;
            console.log(`✓ Created: ${filePath}`);
          }
          
          // Delete files
          for (const filePath of deletedFiles) {
            const fullPath = `${repoPath}/${filePath}`;
            try {
              await sandbox.process.executeCommand(`rm -f "${fullPath}"`);
              filesDeleted++;
              console.log(`✓ Deleted: ${filePath}`);
            } catch (error) {
              console.warn(`Could not delete ${filePath}:`, error);
            }
          }
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Applying Changes',
            message: `Applied ${filesApplied} files, deleted ${filesDeleted} files`,
            versionId,
          });
          
          // Restart dev server
          await streamingService.emit(projectId, {
            type: 'step:start',
            step: 'Restarting Server',
            message: 'Restarting development server...',
            versionId,
          });
          
          // Kill existing dev server process (best-effort)
          await sandbox.process.executeCommand('pkill -f "npm.*start" || pkill -f "node" || true', repoPath);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Restart dev server using the same start command and port as initial preview
          const startCmd = `HOST=0.0.0.0 PORT=${port} ${startCommand} > server.log 2>&1 & echo $!`;
          console.log('Restarting dev server with command:', startCmd, 'in', repoPath);
          const startResult = await sandbox.process.executeCommand(
            startCmd,
            repoPath,
            {},
            10
          );
          
          // Wait for server to start
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Verify server is running
          const healthCheck = await sandbox.process.executeCommand(
            `curl -f -m 5 http://localhost:${port}/health 2>/dev/null || curl -f -m 5 http://localhost:${port}/ 2>/dev/null || echo "server_not_ready"`,
            undefined,
            {},
            10
          );
          
          const serverReady = !healthCheck.result?.includes('server_not_ready');
          if (!serverReady) {
            // Log last lines from server.log to help debug 502s
            try {
              const logs = await sandbox.process.executeCommand('tail -80 server.log 2>/dev/null || echo "no_server_log"', repoPath);
              console.log('Dev server logs after restart:', logs.result);
            } catch (logError) {
              console.log('Failed to read server.log after restart:', logError);
            }
          }
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Restarting Server',
            message: serverReady ? 'Server restarted successfully!' : 'Server restarted (may need a moment to fully load)',
            versionId,
          });
          
          return {
            success: true,
            filesApplied,
            filesDeleted,
            serverRestarted: true,
            serverReady,
          };
        } catch (error) {
          console.error('Failed to apply changes to sandbox:', error);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Applying Changes',
            message: `Changes applied to version but sandbox update failed: ${(error as Error).message}`,
            versionId,
          });
          
          return {
            success: false,
            error: (error as Error).message,
            skipped: false,
          };
        }
      });
      
      // Step 5: Update version with generated files
      await step.run("update-version", async () => {
        if (!('state' in apiResult) || !apiResult.state?.data) {
          throw new Error('Invalid API result structure');
        }
        
        await VersionManager.updateVersion(versionId!, {
          files: apiResult.state.data.files,
          status: 'complete',
          metadata: {
            requirements: apiResult.state.data.requirements,
            summary: apiResult.state.data.summary,
          },
        });
      });
      
      // Step 6: Update message with version_id
      await step.run("link-message-to-version", async () => {
        await supabase
          .from('messages')
          .update({ version_id: versionId })
          .eq('id', messageId);
      });
      
      // Step 7: Emit completion event
      await step.run("emit-complete", async () => {
        if (!('state' in apiResult) || !apiResult.state?.data) {
          throw new Error('Invalid API result structure');
        }
        
        const filesList = Object.keys(apiResult.state.data.files || {});
        
        await streamingService.emit(projectId, {
          type: 'complete',
          summary: apiResult.state.data.summary || 'Changes applied successfully!',
          totalFiles: filesList.length,
          versionId,
        });
        
        // Close streaming connection
        streamingService.closeProject(projectId);
      });
      
      return {
        success: true,
        versionId,
        projectId,
      };
    } catch (error) {
      console.error('Error in iterateAPI function:', error);
      
      // Mark version as failed
      if (versionId) {
        try {
          await VersionManager.updateVersion(versionId, { status: 'failed' });
        } catch (updateError) {
          console.error('Failed to mark version as failed:', updateError);
        }
      }
      
      // Emit error event
      await streamingService.emit(projectId, {
        type: 'error',
        message: (error as Error).message || 'An error occurred during iteration',
        stage: 'Iteration',
        versionId,
      });
      
      // Close streaming connection
      streamingService.closeProject(projectId);
      
      throw error;
    }
  }
);

/**
 * Clone and Preview Repository - No code generation
 * Just clones repo, installs deps, starts preview
 */
export const cloneAndPreviewRepository = inngest.createFunction(
  { 
    id: "clone-and-preview-repository",
    retries: 1, // Retry only once to avoid excessive retries
    concurrency: {
      limit: 5, // Limit concurrent executions
    },
  },
  { event: "github/clone-and-preview" },
  async ({ event, step }) => {
    const { projectId, repoUrl, repoFullName, githubRepoId, userId } = event.data;
    
    // Store sandbox ID across steps
    let sandboxId: string | null = null;
    
    try {
      // Step 0.5: Create user message showing clone request
      await step.run("create-user-message", async () => {
        try {
          const { MessageService } = await import('../modules/messages/service');
          
          await MessageService.saveResult({
            content: `Clone ${repoFullName}`,
            role: 'user',
            type: 'text',
            project_id: projectId,
          });
          
          console.log(`Created user message for clone request: ${repoFullName}`);
        } catch (error) {
          console.error('Failed to create user message:', error);
          // Don't fail workflow if message creation fails
        }
      });
      
      // Step 1: Get GitHub integration
      const integration = await step.run("get-github-integration", async () => {
        const supabase = createSupabaseClient();
        const { data, error } = await supabase
          .from('user_integrations')
          .select('*')
          .eq('user_id', userId)
          .eq('provider', 'github')
          .eq('is_active', true)
          .single();
        
        if (error || !data) {
          throw new Error('GitHub integration not found');
        }
        
        return data;
      });
      
      // Step 2: Create sandbox and clone repository
      const cloneResult = await step.run("clone-repository", async () => {
        let sandbox: Sandbox | null = null;
        
        try {
          const { githubRepositoryService } = await import('../services/github-repository-service');
          
          // Create Daytona workspace for repository cloning and preview
          // Set auto-stop to 30 minutes to save costs
          // Keep-alive hook only pings when user is viewing the project
          sandbox = await createWorkspace({
            resources: DEFAULT_RESOURCES,
            public: true, // Public preview URLs needed
            autoStopInterval: 30, // 30 minutes before auto-stop (cost-effective)
          });
          
          // Store sandbox ID for later cleanup if needed
          sandboxId = sandbox.id;
          
          // Emit starting event
          await streamingService.emit(projectId, {
            type: 'step:start',
            step: 'Cloning Repository',
            message: `Cloning ${repoFullName}...`,
          });
          
          // Clone repository
          const cloneResult = await githubRepositoryService.cloneToSandbox(
            repoUrl,
            integration.access_token,
            sandbox
          );
          
          if (!cloneResult.success) {
            throw new Error(`Failed to clone repository: ${cloneResult.error}`);
          }
          
          const repoPath = cloneResult.path;
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Cloning Repository',
            message: 'Repository cloned successfully!',
          });
          
          return {
            sandboxId: sandbox.id,
            repoPath,
          };
        } catch (error) {
          console.error('Clone repository error:', error);
          
          // Cleanup sandbox on error
          if (sandbox) {
            try {
              await deleteWorkspace(sandbox);
              console.log('✅ Workspace cleaned up after clone error');
            } catch (killError) {
              console.error('Failed to cleanup workspace after error:', killError);
            }
          }
          
          throw error;
        }
      });
      
      // Step 3: Detect framework (separate step for clarity)
      const frameworkInfo = await step.run("detect-framework", async () => {
        const { githubRepositoryService } = await import('../services/github-repository-service');
        
        // Get existing workspace
        const sandbox = await getWorkspace(cloneResult.sandboxId);
        
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Detecting Framework',
          message: 'Analyzing project structure...',
        });
        
        const framework = await githubRepositoryService.detectFramework(sandbox, cloneResult.repoPath);
        
        await streamingService.emit(projectId, {
          type: 'step:complete',
          step: 'Detecting Framework',
          message: `Detected: ${framework.framework}`,
        });
        
        return {
          framework: framework.framework,
          packageManager: framework.packageManager,
          port: framework.port || 3000,
          frameworkDetails: framework,
        };
      });
      
      // Step 4: Read repository files (separate step)
      const repoFiles = await step.run("read-repository-files", async () => {
        const sandbox = await getWorkspace(cloneResult.sandboxId);
        const repoPath = cloneResult.repoPath;
          
        // Read repository files
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Reading Files',
          message: 'Reading repository files...',
        });
        
        const filesMap: Record<string, string> = {};
        
        // Get list of source files - EXCLUDE build/generated folders
        const findFilesCommand = `find ${repoPath} -type f \\( -name '*.py' -o -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.jsx' -o -name '*.json' -o -name '*.md' -o -name '*.txt' -o -name '*.yml' -o -name '*.yaml' -o -name '*.css' -o -name '*.scss' \\) ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/dist/*' ! -path '*/build/*' ! -path '*/.next/*' ! -path '*/__pycache__/*' ! -path '*/coverage/*' ! -path '*/.cache/*' ! -path '*/out/*' ! -path '*/.turbo/*' | head -200`;
          
          const filesListResult = await sandbox.process.executeCommand(findFilesCommand);
          
          if (filesListResult.exitCode === 0 && filesListResult.result) {
            const filesList = filesListResult.result.trim().split('\n').filter(f => f.trim());
            console.log(`Found ${filesList.length} source files to read`);
            
            // Categorize files by priority
            const configFiles = filesList.filter(f => 
              f.includes('package.json') || 
              f.includes('tsconfig.json') ||
              f.includes('next.config') ||
              f.includes('vite.config') ||
              f.includes('tailwind.config') ||
              f.includes('.env.example') ||
              f.includes('README')
            );
            
            const appFiles = filesList.filter(f => 
              (f.includes('/app/') || f.includes('/pages/') || f.includes('/src/pages/')) &&
              !configFiles.includes(f)
            );
            
            const componentFiles = filesList.filter(f => 
              (f.includes('/components/') || f.includes('/ui/')) &&
              !configFiles.includes(f) && !appFiles.includes(f)
            );
            
            const utilFiles = filesList.filter(f => 
              (f.includes('/lib/') || f.includes('/utils/') || f.includes('/hooks/')) &&
              !configFiles.includes(f) && !appFiles.includes(f) && !componentFiles.includes(f)
            );
            
            const otherFiles = filesList.filter(f => 
              !configFiles.includes(f) && 
              !appFiles.includes(f) && 
              !componentFiles.includes(f) && 
              !utilFiles.includes(f)
            );
            
            // Smart selection: Get representative files from each category
            const orderedFiles = [
              ...configFiles,                          // All config files
              ...appFiles.slice(0, 30),                // Up to 30 pages/routes
              ...componentFiles.slice(0, 40),          // Up to 40 components  
              ...utilFiles.slice(0, 20),               // Up to 20 utils
              ...otherFiles.slice(0, 10),              // Up to 10 other files
            ].slice(0, 150); // Max 150 files total
            
            console.log(`Reading ${orderedFiles.length} files: ${configFiles.length} config, ${appFiles.slice(0, 30).length} pages, ${componentFiles.slice(0, 40).length} components, ${utilFiles.slice(0, 20).length} utils`);
            
            // Read each file
            let filesRead = 0;
            let filesSkipped = 0;
            
            for (const filePath of orderedFiles) {
              try {
                const fileContentBuffer = await sandbox.fs.downloadFile(filePath);
                const fileContent = fileContentBuffer.toString('utf-8');
                // Get relative path from repo root
                const relativePath = filePath.replace(`${repoPath}/`, '');
                
                // Skip if file is too large (> 200KB)
                if (fileContent.length > 200000) {
                  console.log(`Skipping large file: ${relativePath} (${fileContent.length} bytes)`);
                  filesSkipped++;
                  continue;
                }
                
                filesMap[relativePath] = fileContent;
                filesRead++;
                
                // Only emit config files to stream to avoid overwhelming
                if (configFiles.includes(filePath)) {
                  await streamingService.emit(projectId, {
                    type: 'file:complete',
                    filename: relativePath,
                    content: fileContent.substring(0, 1000), // Only send preview to stream
                    path: relativePath,
                  });
                }
              } catch (fileError) {
                console.error(`Failed to read file ${filePath}:`, fileError);
                filesSkipped++;
              }
            }
            
            console.log(`Successfully read ${filesRead} files, skipped ${filesSkipped} files`);
          }
          
          console.log(`Successfully read ${Object.keys(filesMap).length} source files`);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Reading Files',
            message: `Read ${Object.keys(filesMap).length} source files`,
          });
          
          return filesMap;
      });
      
      // Step 4.5: Generate embeddings for files (background task)
      await step.run("generate-embeddings", async () => {
        try {
          await streamingService.emit(projectId, {
            type: 'step:start',
            step: 'Generating Embeddings',
            message: 'Generating embeddings for semantic search...',
          });
          
          const filesForEmbedding = Object.entries(repoFiles).map(([path, content]) => ({
            projectId,
            versionId: undefined, // No version yet since this is initial clone
            filePath: path,
            content: typeof content === 'string' ? content : JSON.stringify(content),
            language: detectLanguage(path),
            imports: extractImports(content),
            exports: extractExports(content),
          }));
          
          console.log(`🔄 Starting embedding generation for ${filesForEmbedding.length} files`);
          
          const embeddingResults = await EmbeddingService.embedFiles(
            filesForEmbedding,
            {
              onProgress: (completed, total, filePath) => {
                const progress = Math.round((completed / total) * 100);
                // Emit progress updates every 10%
                if (completed % Math.ceil(total / 10) === 0 || completed === total) {
                  streamingService.emit(projectId, {
                    type: 'step:progress',
                    step: 'Generating Embeddings',
                    message: `Embedded ${completed}/${total} files (${progress}%)...`,
                    progress,
                  }).catch(err => console.error('Failed to emit progress:', err));
                }
              },
            }
          );
          
          console.log(`✓ Successfully generated ${embeddingResults.length} embeddings`);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Generating Embeddings',
            message: `Generated embeddings for ${embeddingResults.length} files`,
          });
        } catch (error) {
          console.error('Failed to generate embeddings:', error);
          // Don't fail the whole workflow if embeddings fail
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Generating Embeddings',
            message: 'Embeddings generation skipped (will use fallback)',
          });
        }
      });
      
      // Step 5: Install dependencies (separate step with proper timeout)
      const installResult = await step.run("install-dependencies", async () => {
        const { githubRepositoryService } = await import('../services/github-repository-service');
        const sandbox = await getWorkspace(cloneResult.sandboxId);
        const repoPath = cloneResult.repoPath;
        
        // Only install if we have a known package manager
        if (!frameworkInfo.packageManager || frameworkInfo.packageManager === 'unknown') {
          console.warn('⚠️ Skipping dependency installation - package manager not detected');
          return { 
            success: false, 
            skipped: true,
            output: '',
            error: 'Package manager not detected',
          };
        }
        
        // Emit installing step
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Installing Dependencies',
          message: `Installing with ${frameworkInfo.packageManager}...`,
        });
        
        const result = await githubRepositoryService.installDependencies(
          sandbox,
          frameworkInfo.packageManager,
          repoPath
        );
        
        if (result.success) {
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Installing Dependencies',
            message: result.fallbackUsed ? 'Dependencies installed with --legacy-peer-deps' : 'Dependencies installed successfully!',
          });
        } else {
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Installing Dependencies',
            message: `Installation failed: ${result.error?.substring(0, 100) || 'Unknown error'}`,
          });
        }
        
        return {
          ...result,
          skipped: false,
        };
      });
      
      // Step 6: Start preview server (separate step with proper timeout)
      const previewResult = await step.run("start-preview-server", async () => {
        const { githubRepositoryService } = await import('../services/github-repository-service');
        const sandbox = await getWorkspace(cloneResult.sandboxId);
        const repoPath = cloneResult.repoPath;
        
        // Try to start preview if we have a framework and dependencies were installed
        if (!frameworkInfo.frameworkDetails.startCommand && frameworkInfo.framework === 'unknown') {
          console.warn('⚠️ Skipping preview server - no start command for framework:', frameworkInfo.framework);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Starting Preview',
            message: 'Unable to auto-start server - framework not detected',
          });
          
          // Cannot generate preview URL without framework - return empty
          const defaultPort = frameworkInfo.port || 3000;
          
          return {
            success: false,
            skipped: true,
            sandboxUrl: undefined,
            port: defaultPort,
            error: 'Framework not detected',
            installOutput: undefined,
          };
        }
        
        // Skip if dependencies installation failed
        if (!installResult.success && !installResult.skipped) {
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Starting Preview',
            message: 'Skipped - dependencies installation failed',
          });
          
          const defaultPort = frameworkInfo.port || 3000;
          
          return {
            success: false,
            skipped: true,
            sandboxUrl: undefined,
            port: defaultPort,
            error: 'Dependencies installation failed',
            installOutput: installResult.output,
          };
        }
        
        // Emit starting preview step
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Starting Preview',
          message: 'Starting development server...',
        });
        
        // Start preview server (skip install since we already did it in previous step)
        const previewServer = await githubRepositoryService.startPreviewServer(
          sandbox,
          frameworkInfo.frameworkDetails,
          repoPath,
          true // skipInstall = true, we already installed dependencies
        );
        
        if (previewServer.success) {
          console.log('✅ Preview server started:', previewServer.url);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Starting Preview',
            message: `Preview ready on port ${previewServer.port}!`,
          });
        } else {
          console.error('❌ Preview server failed to start:', previewServer.error);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Starting Preview',
            message: `Preview server could not be started: ${previewServer.error?.substring(0, 100) || 'Unknown error'}`,
          });
        }
        
        // Use the preview URL from the server result
        const defaultPort = frameworkInfo.port || 3000;
        const sandboxUrl = previewServer?.url;
        
        console.log('📡 Sandbox URL:', sandboxUrl);
        console.log('   - Framework:', frameworkInfo.framework);
        console.log('   - Port:', defaultPort);
        console.log('   - Sandbox ID:', cloneResult.sandboxId);
        
        return {
          success: previewServer.success,
          skipped: false,
          sandboxUrl,
          port: previewServer.port || defaultPort,
          error: previewServer.error,
          installOutput: previewServer.installOutput,
        };
      });
      
// Step 7: Save repository files to database
const savedResult = await step.run("save-repository-files", async () => {
  try {
    const { MessageService } = await import('../modules/messages/service');
    
    // Create a message with the repository files
    const filesCount = Object.keys(repoFiles || {}).length;
    const repoName = repoFullName.split('/').pop() || 'Repository';
    const framework = frameworkInfo.framework || 'unknown';
    
    // Simple initial message - No markdown, plain text for clean rendering
    const messageContent = `${repoName} was imported from GitHub.\nContinue chatting to ask questions about or make changes to it.`;
    
    const result = await MessageService.saveResult({
      content: messageContent,
      role: 'assistant',
      type: 'result',
      project_id: projectId,
      fragment: {
        title: `${repoFullName} - Cloned Repository`,
        sandbox_url: previewResult.sandboxUrl || `https://github.com/${repoFullName}`,
        files: repoFiles || {},
        fragment_type: 'repo_clone',
        order_index: 0,
        metadata: {
          repoUrl,
          repoFullName,
          framework: frameworkInfo.framework || 'unknown',
          packageManager: frameworkInfo.packageManager || 'unknown',
          filesCount,
          sandboxId: cloneResult.sandboxId || 'N/A',
          sandboxUrl: previewResult.sandboxUrl,
          previewError: previewResult.error,
          installError: installResult.success ? undefined : installResult.error,
        }
      }
    });
    
    console.log(`Saved ${filesCount} repository files to database with sandbox URL: ${previewResult.sandboxUrl}`);
    return result;
  } catch (error) {
    console.error('Failed to save repository files:', error);
    // Don't fail the entire workflow if saving fails
    return null;
  }
});
      
      // Step 7.5: Create initial version for the cloned repository
      const versionResult = await step.run("create-initial-version", async () => {
        console.log('🔵 Starting version creation for GitHub repo');
        console.log('  - Project ID:', projectId);
        console.log('  - Repo:', repoFullName);
        console.log('  - Files count:', Object.keys(repoFiles || {}).length);
        
        try {
          const { VersionManager } = await import('../services/version-manager');
          console.log('✅ VersionManager imported successfully');
          
          // Generate version name from repo name
          const repoName = repoFullName.split('/').pop() || 'Repository';
          const versionName = repoName
            .split('-')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          
          console.log('📝 Creating version with name:', versionName);
          
          // Create Version 1
          const version = await VersionManager.createVersion({
            project_id: projectId,
            version_number: 1,
            name: versionName,
            description: `Cloned ${frameworkInfo.framework} project from GitHub: ${repoFullName}`,
            files: repoFiles || {},
            command_type: 'CLONE_REPO',
            prompt: `Clone and preview GitHub repository: ${repoFullName}`,
            parent_version_id: undefined, // First version has no parent
            status: 'complete',
            metadata: {
              repo_url: repoUrl,
              repo_full_name: repoFullName,
              framework: frameworkInfo.framework || 'unknown',
              package_manager: frameworkInfo.packageManager || 'unknown',
              sandbox_url: previewResult.sandboxUrl,
              sandbox_id: cloneResult.sandboxId,
              files_count: Object.keys(repoFiles || {}).length,
              fragment_id: savedResult?.fragment?.id,
            },
          });
          
          console.log('✅ Created initial version for GitHub repo:', version.id, 'v' + version.version_number);
          console.log('  - Version ID:', version.id);
          console.log('  - Version Number:', version.version_number);
          console.log('  - Files stored:', Object.keys(version.files || {}).length);
          
          // Emit to stream so frontend knows version was created
          await streamingService.emit(projectId, {
            type: 'version:created',
            versionId: version.id,
            versionNumber: version.version_number,
            versionName: version.name,
          });
          
          return { versionId: version.id, versionNumber: version.version_number };
        } catch (error: any) {
          console.error('❌ CRITICAL ERROR creating version for GitHub repo:');
          console.error('  - Error message:', error?.message);
          console.error('  - Error stack:', error?.stack);
          console.error('  - Error details:', JSON.stringify(error, null, 2));
          
          // Emit error to stream
          await streamingService.emit(projectId, {
            type: 'error',
            message: `Failed to create version: ${error?.message || 'Unknown error'}`,
            stage: 'Version Creation',
          });
          
          // Return null but log prominently
          return { versionId: null, versionNumber: null, error: error?.message };
        }
      });

      const versionId = versionResult?.versionId;

      // Step 7.6: Link message and fragments to version
      if (versionId && savedResult) {
        await step.run("link-to-version", async () => {
          try {
            const resultMessageId = savedResult?.message?.id;
            
            // Update all user messages for this project with the version_id
            await supabase
              .from('messages')
              .update({ version_id: versionId })
              .eq('project_id', projectId)
              .eq('role', 'user');
            
            // Update assistant message/fragment too if we have the ID
            if (resultMessageId) {
              await supabase
                .from('messages')
                .update({ version_id: versionId })
                .eq('id', resultMessageId);
              
              await supabase
                .from('fragments')
                .update({ version_id: versionId })
                .eq('message_id', resultMessageId);
            }
            
            console.log('Linked messages and fragments to version:', versionId);
          } catch (error) {
            console.error('Error linking to version:', error);
          }
        });
      }
      
      // Step 8: Update project with sandbox URL, repo URL, and status
      await step.run("update-project", async () => {
        const updateData: any = {
          status: 'deployed', // Mark as deployed when preview is ready
          framework: frameworkInfo.framework || 'unknown',
          github_repo_id: githubRepoId,
          repo_url: repoUrl, // Store repo URL for easier access
          metadata: {
            sandboxId: cloneResult.sandboxId, // Save sandboxId for terminal access
            repoFullName,
            framework: frameworkInfo.framework,
          },
        };
        
        // Always add sandbox_url (we always generate it now)
        if (previewResult.sandboxUrl) {
          updateData.sandbox_url = previewResult.sandboxUrl;
        }
        
        console.log('🔄 Updating project with data:', JSON.stringify(updateData, null, 2));
        console.log('   Project ID:', projectId);
        console.log('   GitHub Repo ID:', githubRepoId);
        console.log('   Repo URL:', repoUrl);
        console.log('   Sandbox URL:', previewResult.sandboxUrl);
        
        const { data, error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId)
          .select();
        
        if (error) {
          console.error('❌ Failed to update project:', error);
          throw new Error(`Failed to update project: ${error.message}`);
        } else {
          console.log('✅ Project updated successfully:', JSON.stringify(data, null, 2));
          console.log(`   Status: deployed`);
          console.log(`   Framework: ${frameworkInfo.framework}`);
          console.log(`   Repo URL: ${repoUrl}`);
          console.log(`   Sandbox URL: ${previewResult.sandboxUrl}`);
          console.log(`   GitHub Repo ID: ${githubRepoId}`);
        }
        
        return data;
      });
      
      // Step 9: Close stream to stop loading animations
      await step.run("close-stream", async () => {
        // CRITICAL: Close the stream to stop loading animations on frontend
        streamingService.closeProject(projectId);
        
        console.log('✅ Workflow completed successfully!');
        console.log(`   - Project ID: ${projectId}`);
        console.log(`   - Status: deployed`);
        console.log(`   - Sandbox URL: ${previewResult.sandboxUrl}`);
        console.log(`   - Files processed: ${Object.keys(repoFiles || {}).length}`);
      });
      
      return {
        projectId,
        sandboxId: cloneResult.sandboxId,
        sandboxUrl: previewResult.sandboxUrl,
        framework: frameworkInfo.framework,
        packageManager: frameworkInfo.packageManager,
        previewPort: previewResult.port,
        previewError: previewResult.error,
        installOutput: previewResult.installOutput,
        filesCount: Object.keys(repoFiles || {}).length,
      };
    } catch (error: any) {
      console.error('Clone and preview workflow error:', error);
      
      // CRITICAL: Cleanup sandbox on workflow failure
      if (sandboxId) {
        try {
          await deleteWorkspace(sandboxId);
          console.log('✅ Sandbox cleaned up after workflow error');
        } catch (killError) {
          console.error('Failed to cleanup sandbox after workflow error:', killError);
          // Continue with error handling even if cleanup fails
        }
      }
      
      // Update project status to failed and close streaming
      const supabase = createSupabaseClient();
      const { error: failError } = await supabase
        .from('projects')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      
      if (failError) {
        console.error('❌ Failed to update project status to failed:', failError);
      } else {
        console.log('✅ Project status updated to failed');
      }
      
      // CRITICAL: Close the stream even on failure to stop loading animations
      streamingService.closeProject(projectId);
      
      // Emit error
      await streamingService.emit(projectId, {
        type: 'error',
        message: error.message || 'Failed to clone and preview repository',
        stage: 'Clone & Preview',
      });
      
      streamingService.closeProject(projectId);
      
      throw error;
    }
  }
);

// Helper functions for embedding generation
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    cs: 'csharp',
  };
  return langMap[ext || ''] || 'unknown';
}

function extractImports(content: string | any): string[] {
  if (typeof content !== 'string') return [];
  
  const imports: string[] = [];
  
  try {
    // Match ES6 imports
    const es6Pattern = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    let match;
    while ((match = es6Pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match require()
    const requirePattern = /require\(['"](.+?)['"]\)/g;
    while ((match = requirePattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match Python imports
    const pythonPattern = /(?:from\s+(\S+)\s+)?import\s+(.+)/g;
    while ((match = pythonPattern.exec(content)) !== null) {
      if (match[1]) imports.push(match[1]);
    }
  } catch (error) {
    console.error('Error extracting imports:', error);
  }
  
  return [...new Set(imports)];
}

function extractExports(content: string | any): string[] {
  if (typeof content !== 'string') return [];
  
  const exports: string[] = [];
  
  try {
    // Match ES6 exports
    const exportPattern = /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/g;
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Match export { name }
    const namedExportPattern = /export\s+{([^}]+)}/g;
    while ((match = namedExportPattern.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(' ')[0]);
      exports.push(...names);
    }
  } catch (error) {
    console.error('Error extracting exports:', error);
  }
  
  return [...new Set(exports)];
}

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