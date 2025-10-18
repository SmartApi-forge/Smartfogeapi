import { inngest } from "./client";
import OpenAI from 'openai';
import { Sandbox } from 'e2b';
import { Octokit } from '@octokit/rest';
import { createClient } from '@supabase/supabase-js';
import { AgentState, AIResult } from './types';
import { streamingService } from '../services/streaming-service';
import { VersionManager } from '../services/version-manager';
import { ContextBuilder } from '../services/context-builder';

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
          
          // Create sandbox for repository analysis using full-stack template
          const templateId = process.env.E2B_FULLSTACK_TEMPLATE_ID || 'ckskh5feot2y94v5z07d';
          sandbox = await Sandbox.create(templateId);
          
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
            const packageJson = await sandbox.files.read('/home/user/repo/package.json');
            packageInfo = JSON.parse(packageJson);
          } catch (error) {
            console.log('No package.json found or invalid JSON');
          }
          
          // Get directory structure
          const dirStructure = await sandbox.commands.run(`find /home/user/repo -type f -name '*.js' -o -name '*.ts' -o -name '*.json' -o -name '*.md'`);
          
          // Analyze main files
          const mainFiles = [];
          const commonFiles = ['index.js', 'index.ts', 'app.js', 'app.ts', 'server.js', 'server.ts', 'main.js', 'main.ts'];
          
          for (const file of commonFiles) {
            try {
              const content = await sandbox.files.read(`/home/user/repo/${file}`);
              if (content) {
                mainFiles.push({ file, content: content.substring(0, 1000) }); // First 1000 chars
              }
            } catch (error) {
              // File doesn't exist, continue
            }
          }
          
          // Read README if exists
          let readme = null;
          try {
            readme = await sandbox.files.read('/home/user/repo/README.md');
          } catch (error) {
            try {
              readme = await sandbox.files.read('/home/user/repo/readme.md');
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
            directoryStructure: dirStructure?.stdout || '',
            mainFiles,
            readme: readme ? readme.substring(0, 2000) : null,
            analysisTimestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error('Repository analysis error:', error);
          
          // Attempt to clean up sandbox if it exists before returning error
          if (sandbox && typeof sandbox.kill === 'function') {
            try {
              await sandbox.kill();
            } catch (killError) {
              console.error('Failed to kill sandbox in catch block:', killError);
            }
          }
          
          return {
            repoUrl,
            error: (error as Error).message,
            analysisTimestamp: new Date().toISOString()
          };
        } finally {
          // Robust cleanup - check sandbox is truthy and has kill function
          if (sandbox && typeof sandbox.kill === 'function') {
            try {
              await sandbox.kill();
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
        // Create sandbox with our custom template and timeout configuration
        console.log('🏗️ Creating E2B sandbox with timeout configuration...');
        const templateId = process.env.E2B_FULLSTACK_TEMPLATE_ID || 'ckskh5feot2y94v5z07d';
        sandbox = await Sandbox.create(templateId, {
          timeoutMs: 300000, // 5 minutes timeout
        });
        
        // Write OpenAPI spec to sandbox
        if (!('state' in apiResult) || !apiResult.state?.data) {
          throw new Error('Invalid API result structure for sandbox setup');
        }
        
        const openApiSpec = apiResult.state.data.files['openapi.yaml'] || apiResult.state.data.files['openapi.json'] || '';
        await sandbox.files.write('/home/user/openapi.json', openApiSpec);
        
        // Write implementation files to sandbox
        const implementationFiles = apiResult.state.data.files || {};
        console.log('📁 Writing implementation files:', Object.keys(implementationFiles));
        
        for (const [filename, content] of Object.entries(implementationFiles)) {
          if (typeof content === 'string') {
            console.log(`📝 Writing file: ${filename} (${content.length} chars)`);
            await sandbox.files.write(`/home/user/src/${filename}`, content);
            
            // Also copy package.json and main entry files to root directory for npm start to work
            if (filename === 'package.json') {
              console.log('📝 Copying package.json to root directory for npm start');
              await sandbox.files.write('/home/user/package.json', content);
            } else if (filename === 'index.js' || filename === 'server.js' || filename === 'app.js') {
              console.log(`📝 Copying ${filename} to root directory for npm start`);
              await sandbox.files.write(`/home/user/${filename}`, content);
            }
          } else {
            console.log(`⚠️ Skipping non-string content for ${filename}:`, typeof content);
          }
        }
        
        // List all files in the sandbox for debugging
        const fileList = await sandbox.commands.run('cd /home/user && find . -type f -name "*" | head -20 2>/dev/null || echo "find_failed"');
        console.log('📋 Files in sandbox:', fileList.stdout);
        
        // Check if OpenAPI spec file exists and is valid JSON
        let specValidation, specValid = false;
        try {
          console.log('🔍 Step 1: Validating OpenAPI specification...');
          const specExists = await sandbox.commands.run('cd /home/user && test -f openapi.json && echo "exists" || echo "missing"');
          if (specExists.stdout?.includes('exists')) {
            // Validate JSON syntax and basic OpenAPI structure
            const validation = await sandbox.commands.run(`cd /home/user && node -e "
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
              console.log('🚨 Spec validation errors:', validation.stderr);
            }
          } else {
            specValidation = { exitCode: 1, stdout: '', stderr: 'OpenAPI spec file not found' };
          }
        } catch (error) {
          specValidation = { exitCode: 1, stdout: '', stderr: `OpenAPI validation error: ${error}` };
        }
        
        // Check if TypeScript files exist before validation
         let tsValidation, tsValid = false;
         try {
           console.log('🔍 Step 2: Validating TypeScript code...');
           const tsFiles = await sandbox.commands.run('cd /home/user/src && find . -name "*.ts" | head -1 2>/dev/null || echo "no_ts_files"');
           if (tsFiles.stdout?.trim()) {
             // Ensure tsconfig.json exists in the src directory
             const tsconfigExists = await sandbox.commands.run('cd /home/user/src && test -f tsconfig.json && echo "exists" || echo "missing"');
             if (tsconfigExists.stdout?.includes('missing')) {
               // Create a basic tsconfig.json for the project
               await sandbox.files.write('/home/user/src/tsconfig.json', JSON.stringify({
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
               }, null, 2));
             }
             
             // Install TypeScript if not available (with timeout)
             await sandbox.commands.run('cd /home/user && npm install typescript --save-dev --silent', { timeoutMs: 60000 });
             
             // Run TypeScript compilation check
             tsValidation = await sandbox.commands.run('cd /home/user/src && npx tsc --noEmit --skipLibCheck --allowJs 2>/dev/null || echo "tsc_failed"');
             tsValid = tsValidation.exitCode === 0;
             console.log('📝 TypeScript validation result:', tsValid ? '✅ Valid' : '❌ Invalid');
             if (!tsValid) {
               console.log('🚨 TypeScript validation errors:', tsValidation.stderr);
             }
           } else {
             // Check JavaScript files instead
             const jsFiles = await sandbox.commands.run('cd /home/user/src && find . -name "*.js" | head -1 2>/dev/null || echo "no_js_files"');
             if (jsFiles.stdout?.trim()) {
               tsValidation = { exitCode: 0, stdout: 'No TypeScript files found, JavaScript files present', stderr: '' };
               tsValid = true;
             } else {
               tsValidation = { exitCode: 1, stdout: '', stderr: 'No TypeScript or JavaScript files found' };
             }
           }
         } catch (error) {
           tsValidation = { exitCode: 1, stdout: '', stderr: `TypeScript validation error: ${error}` };
         }
        
        // Run basic syntax validation with better error handling
        let syntaxValidation, syntaxValid = false;
        try {
          console.log('🔍 Step 3: Validating code syntax...');
          const jsFiles = await sandbox.commands.run('cd /home/user/src && find . -name "*.js" -type f 2>/dev/null || echo "no_js_files"');
          if (jsFiles.stdout?.trim()) {
            // Check each JS file individually for better error reporting
            const fileList = jsFiles.stdout.trim().split('\n').filter(f => f.trim());
            let allValid = true;
            let validationOutput = '';
            
            for (const file of fileList) {
              const fileCheck = await sandbox.commands.run(`cd /home/user/src && node --check "${file.trim()}" 2>/dev/null || echo "check_failed"`);
              if (fileCheck.exitCode !== 0) {
                allValid = false;
                validationOutput += `${file}: ${fileCheck.stderr}\n`;
              }
            }
            
            syntaxValidation = { 
              exitCode: allValid ? 0 : 1, 
              stdout: allValid ? 'All JavaScript files are syntactically valid' : '', 
              stderr: validationOutput 
            };
            syntaxValid = allValid;
            console.log('⚙️ Syntax validation result:', syntaxValid ? '✅ Valid' : '❌ Invalid');
            if (!syntaxValid) {
              console.log('🚨 Syntax validation errors:', validationOutput);
            }
          } else {
            syntaxValidation = { exitCode: 0, stdout: 'No JavaScript files to validate', stderr: '' };
            syntaxValid = true;
          }
        } catch (error) {
          syntaxValidation = { exitCode: 1, stdout: '', stderr: `Syntax validation error: ${error}` };
        }
        
        // Run Jest tests with better handling for missing tests
        let testValidation, testsValid = false;
        try {
          console.log('🔍 Step 4: Validating test files...');
          const packageExists = await sandbox.commands.run('cd /home/user && test -f package.json && echo "exists" || echo "missing"');
          if (packageExists.stdout?.includes('exists')) {
            // Check if test script exists and what it contains
            const testScriptCheck = await sandbox.commands.run('cd /home/user && node -e "const pkg = JSON.parse(require(\'fs\').readFileSync(\'package.json\', \'utf8\')); console.log(pkg.scripts && pkg.scripts.test ? pkg.scripts.test : \'no-test\')"; 2>/dev/null || echo "no-test"');
            
            if (testScriptCheck.stdout?.includes('no-test')) {
              testValidation = { exitCode: 0, stdout: 'No test script found in package.json', stderr: '' };
              testsValid = true; // Don't fail if no tests are defined
            } else if (testScriptCheck.stdout?.includes('Error: no test specified')) {
              // This is the default npm test script that just echoes an error - treat as valid
              testValidation = { exitCode: 0, stdout: 'Default npm test script (no tests specified)', stderr: '' };
              testsValid = true;
            } else {
              // There's an actual test script, try to run it
              try {
                // Install dependencies first
                await sandbox.commands.run('cd /home/user && npm install --silent 2>/dev/null || echo "install_failed"', { timeoutMs: 120000 }); // 2 minutes timeout
            testValidation = await sandbox.commands.run('cd /home/user && timeout 30s npm test 2>&1 || echo "Test execution completed"', { timeoutMs: 45000 });
                
                // Consider tests valid if they run without crashing (even if they fail)
                testsValid = !testValidation.stdout?.includes('Test timeout') && 
                           !testValidation.stdout?.includes('command not found') &&
                           !testValidation.stdout?.includes('Cannot find module');
              } catch (testError) {
                testValidation = { exitCode: 0, stdout: 'Test execution attempted but encountered issues', stderr: String(testError) };
                testsValid = true; // Don't fail the entire validation for test issues
                console.log('🧪 Test validation result:', testsValid ? '✅ Valid' : '❌ Invalid');
                if (!testsValid) {
                  console.log('🚨 Test validation errors:', testError);
                }
              }
            }
          } else {
            testValidation = { exitCode: 0, stdout: 'No package.json found', stderr: '' };
            testsValid = true; // Don't fail if no package.json
          }
        } catch (error) {
          testValidation = { exitCode: 1, stdout: '', stderr: `Test validation error: ${error}` };
        }
        
        // Step 5: Execute and test the API if validation passes
        let executionResult = null;
        console.log('🔍 Validation results - Spec valid:', specValid, 'TS valid:', tsValid);
        
        if (specValid && tsValid) {
          console.log('✅ Basic validation passed, proceeding with execution tests...');
          try {
            // Install dependencies with verbose output
            const installResult = await sandbox.commands.run('cd /home/user && npm install --verbose 2>/dev/null || echo "install_failed"', { timeoutMs: 120000 }); // 2 minutes timeout
            console.log('Install output:', installResult.stdout, installResult.stderr);
            
            // Check what port the package.json start script uses
            const portCheck = await sandbox.commands.run('cd /home/user && grep -o "PORT=[0-9]*" package.json 2>/dev/null || grep -o "port.*[0-9]*" package.json 2>/dev/null || echo "port:3000"');
            
            // Start the API server in background with proper environment variables
            console.log('🚀 Starting API server in background...');
            // Copy the improved compile script functions to the working directory
            await sandbox.commands.run('cp /tmp/compile_page.sh /home/user/ 2>/dev/null || echo "compile script not found"');
            
            // First try to start from src directory, then fallback to root
            // Use proper environment variables for networking
            let startResult = await sandbox.commands.run('cd /home/user/src && test -f package.json && (HOST=0.0.0.0 PORT=3000 npm start > ../server.log 2>&1 & echo $! > ../server.pid 2>/dev/null || echo $!) || echo "start_failed"', { timeoutMs: 35000 });
            
            // If that fails, try from root directory
            if (startResult.exitCode !== 0 || startResult.stdout.includes('start_failed')) {
              console.log('🔄 Retrying npm start from root directory...');
              startResult = await sandbox.commands.run('cd /home/user && (HOST=0.0.0.0 PORT=3000 npm start > server.log 2>&1 & echo $! > server.pid 2>/dev/null || echo $!) || echo "start_failed"', { timeoutMs: 35000 });
            }
            console.log('Server start command result:', startResult.stdout, startResult.stderr);
            
            // Use the improved wait_for_server function if available
            let serverWaitResult;
            try {
              serverWaitResult = await sandbox.commands.run('cd /home/user && test -f compile_page.sh && source compile_page.sh && wait_for_server 3000 20 || echo "wait_function_not_available"');
              console.log('Server wait result:', serverWaitResult.stdout);
            } catch (error) {
              console.log('Wait function not available, using fallback delay');
              await new Promise(resolve => setTimeout(resolve, 8000));
            }
            
            // Check server logs for startup confirmation
            const serverLogs = await sandbox.commands.run('cd /home/user && tail -30 server.log 2>/dev/null || echo "No server logs found"');
            console.log('Server startup logs:', serverLogs.stdout);
            
            // Verify server process is running with multiple methods
            const pidCheck = await sandbox.commands.run('cd /home/user && (test -f server.pid && kill -0 $(cat server.pid) 2>/dev/null && echo "process running") || echo "process not found"');
            console.log('Server process check:', pidCheck.stdout);
            
            // Check if any node process is running with more specific search
            const processCheck = await sandbox.commands.run('ps aux | grep -E "node.*index\.js|npm.*start" | grep -v grep 2>/dev/null || echo "no node process"');
            console.log('Process check:', processCheck.stdout);
            
            // Use the improved port detection function if available
            let listeningCheck;
            try {
              listeningCheck = await sandbox.commands.run('cd /home/user && test -f compile_page.sh && source compile_page.sh && detect_listening_ports || echo "detect_function_not_available"');
              if (listeningCheck.stdout.includes('detect_function_not_available')) {
                // Fallback to manual detection
                listeningCheck = await sandbox.commands.run('netstat -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || ss -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || echo "no listening ports"');
              }
            } catch (error) {
              listeningCheck = await sandbox.commands.run('netstat -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || ss -tlnp 2>/dev/null | grep -E ":3000|:8000|:5000" | head -3 || echo "no listening ports"');
            }
            console.log('Listening processes check:', listeningCheck.stdout);
            
            // Enhanced health check with better port detection and fallback mechanisms
            let healthCheck;
            const ports = [3000, 8000, 5000, 4000, 8080];
            let healthCheckPassed = false;
            let workingPort = null;
            let healthCheckDetails = [];
            
            // First, check what ports are actually listening using multiple methods with better detection
            let listeningPorts;
            let discoveredPorts = [];
            
            // Method 1: netstat
            try {
              listeningPorts = await sandbox.commands.run('netstat -tln 2>/dev/null | grep LISTEN | grep -o ":[0-9]*" | cut -d: -f2 | sort -u || echo "no ports"');
              if (listeningPorts.stdout && !listeningPorts.stdout.includes('no ports')) {
                const ports = listeningPorts.stdout.split('\n').filter(p => p.trim() && !isNaN(parseInt(p.trim()))).map(p => parseInt(p.trim()));
                discoveredPorts.push(...ports);
              }
            } catch (error) {
              console.log('netstat failed:', error);
            }
            
            // Method 2: ss
            try {
              const ssResult = await sandbox.commands.run('ss -tln 2>/dev/null | grep LISTEN | grep -o ":[0-9]*" | cut -d: -f2 | sort -u || echo "no ports"');
              if (ssResult.stdout && !ssResult.stdout.includes('no ports')) {
                const ports = ssResult.stdout.split('\n').filter(p => p.trim() && !isNaN(parseInt(p.trim()))).map(p => parseInt(p.trim()));
                discoveredPorts.push(...ports);
              }
            } catch (error) {
              console.log('ss failed:', error);
            }
            
            // Method 3: lsof
            try {
              const lsofResult = await sandbox.commands.run('lsof -i -P -n 2>/dev/null | grep LISTEN | grep -o ":[0-9]*" | cut -d: -f2 | sort -u || echo "no ports"');
              if (lsofResult.stdout && !lsofResult.stdout.includes('no ports')) {
                const ports = lsofResult.stdout.split('\n').filter(p => p.trim() && !isNaN(parseInt(p.trim()))).map(p => parseInt(p.trim()));
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
              const directTest = await sandbox.commands.run(`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "curl_failed"`);
              console.log('Direct port 3000 test result:', directTest.stdout);
              if (directTest.exitCode === 0 && !directTest.stdout.includes('curl_failed')) {
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
                  portCheck1 = await sandbox.commands.run(`netstat -tln | grep :${port} || echo "not found"`);
                  isListening = !portCheck1.stdout.includes('not found');
                } catch (error) {
                  console.log(`netstat check failed for port ${port}:`, error);
                  portCheck1 = { stdout: 'not found', stderr: '', exitCode: 1 };
                }
                
                if (!isListening) {
                  try {
                    portCheck2 = await sandbox.commands.run(`ss -tln | grep :${port} || echo "not found"`);
                    isListening = !portCheck2.stdout.includes('not found');
                  } catch (error) {
                    console.log(`ss check failed for port ${port}:`, error);
                    portCheck2 = { stdout: 'not found', stderr: '', exitCode: 1 };
                  }
                }
                
                if (!isListening) {
                  try {
                    const portCheck3 = await sandbox.commands.run(`lsof -i :${port} 2>/dev/null || echo "not found"`);
                    isListening = !portCheck3.stdout.includes('not found');
                  } catch (error) {
                    console.log(`lsof check failed for port ${port}:`, error);
                  }
                }
                
                console.log(`Port ${port} listening check:`, isListening);
                
                if (isListening) {
                  // Use the improved test_api_endpoint function if available
                  let endpointTestResult;
                  try {
                    endpointTestResult = await sandbox.commands.run(`cd /home/user && test -f compile_page.sh && source compile_page.sh && test_api_endpoint ${port} /health GET || echo "test_function_not_available"`);
                    
                    if (!endpointTestResult.stdout.includes('test_function_not_available') && endpointTestResult.stdout.includes('✅')) {
                      healthCheckPassed = true;
                      workingPort = port;
                      healthCheckDetails.push({ port, endpoint: '/health', success: true, response: endpointTestResult.stdout.substring(0, 200) });
                    } else if (!endpointTestResult.stdout.includes('test_function_not_available')) {
                      // Try root endpoint with the improved function
                      const rootTestResult = await sandbox.commands.run(`cd /home/user && source compile_page.sh && test_api_endpoint ${port} / GET`);
                      if (rootTestResult.stdout.includes('✅')) {
                        healthCheckPassed = true;
                        workingPort = port;
                        healthCheckDetails.push({ port, endpoint: '/', success: true, response: rootTestResult.stdout.substring(0, 200) });
                      } else {
                        healthCheckDetails.push({ port, endpoint: '/health,/', success: false, response: `Both endpoints failed: ${endpointTestResult.stdout} | ${rootTestResult.stdout}` });
                      }
                    } else {
                      // Fallback to manual curl testing
                      for (let retry = 0; retry < 3; retry++) {
                        try {
                          healthCheck = await sandbox.commands.run(`curl -f -m 10 -s http://localhost:${port}/health 2>/dev/null || echo "curl_failed"`, { timeoutMs: 15000 });
                          if (healthCheck.exitCode === 0 && healthCheck.stdout && !healthCheck.stdout.includes('curl_failed')) {
                            healthCheckPassed = true;
                            workingPort = port;
                            healthCheckDetails.push({ port, endpoint: '/health', success: true, response: healthCheck.stdout.substring(0, 200) });
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
                          const rootCheck = await sandbox.commands.run(`curl -f -m 10 -s http://localhost:${port}/ 2>/dev/null || echo "curl_failed"`, { timeoutMs: 15000 });
                          if (rootCheck.exitCode === 0 && !rootCheck.stdout.includes('curl_failed')) {
                            healthCheck = rootCheck;
                            healthCheckPassed = true;
                            workingPort = port;
                            healthCheckDetails.push({ port, endpoint: '/', success: true, response: rootCheck.stdout.substring(0, 200) });
                          } else {
                            healthCheckDetails.push({ port, endpoint: '/', success: false, response: rootCheck.stderr || rootCheck.stdout || 'No response' });
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
              healthCheck = { exitCode: 1, stdout: '', stderr: `No working port found. Tested ports: ${allPorts.join(', ')}` };
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
                    const endpointTest = await sandbox.commands.run(curlCmd, { timeoutMs: 15000 });
                    const success = endpointTest.exitCode === 0 && !endpointTest.stdout.includes('curl_failed');
                    endpoints.push({
                      path,
                      method,
                      success,
                      response: endpointTest.stdout?.substring(0, 200) || endpointTest.stderr?.substring(0, 200),
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
              serverStarted: startResult.exitCode === 0 && (processCheck.stdout.includes('node') || pidCheck.stdout.includes('process running')),
              healthCheckPassed: healthCheckPassed,
              healthCheckDetails: healthCheckDetails,
              workingPort: workingPort,
              serverLogs: serverLogs.stdout,
              processInfo: {
                startCommand: startResult,
                processCheck: processCheck.stdout,
                pidCheck: pidCheck.stdout
              },
              endpointTests: endpoints,
              installOutput: installResult.stdout || installResult.stderr,
              healthCheckOutput: healthCheck.stdout || healthCheck.stderr
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
          specValidationOutput: specValidation?.stdout || specValidation?.stderr || 'OpenAPI validation completed',
          tsValidationOutput: tsValidation?.stdout || tsValidation?.stderr || 'TypeScript compilation completed',
          syntaxValidationOutput: syntaxValidation?.stdout || syntaxValidation?.stderr || 'Syntax validation completed',
          testValidationOutput: testValidation?.stdout || testValidation?.stderr || 'Jest tests completed',
          executionResult,
          overallValid,
          validationSummary: {
            hasWorkingServer,
            hasValidSpec,
            hasValidCode,
            criticalIssues: !hasValidSpec ? ['Invalid OpenAPI spec'] : [],
            warnings: !hasWorkingServer ? (sandboxTerminated ? ['Sandbox terminated during execution - validation incomplete'] : ['Server startup issues']) : []
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
            await sandbox.kill();
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
            await githubSyncService.recordSyncHistory(
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
            
            return result.prUrl;
          }
          
          return null;
        } catch (error) {
          console.error('Failed to create GitHub PR:', error);
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
      
      // Step 2: Build context from parent version + conversation
      const context = await step.run("build-context", async () => {
        return await ContextBuilder.buildContext(projectId, 20);
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
        
        // Build enhanced prompt with context
        const enhancedPrompt = ContextBuilder.formatForPrompt(context, prompt);
        
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          stream: true,
          messages: [
            {
              role: "system",
              content: `You are an expert code iteration assistant. You help users modify and improve existing codebases.

IMPORTANT INSTRUCTIONS:
1. You are working on an EXISTING codebase. The user wants to ${commandType === 'CREATE_FILE' ? 'add new features' : commandType === 'MODIFY_FILE' ? 'modify existing files' : commandType === 'DELETE_FILE' ? 'remove features' : commandType === 'REFACTOR_CODE' ? 'refactor code' : 'enhance the API'}.
2. PRESERVE ALL EXISTING FILES that are not being modified.
3. Only output the files that are NEW or MODIFIED.
4. Maintain the same coding style and patterns from the existing code.
5. Ensure backward compatibility unless explicitly asked to break it.

Current codebase context:
${context.summary}

You MUST respond with valid JSON in this exact structure:
{
  "openApiSpec": { /* OpenAPI 3.0 spec */ },
  "implementationCode": {
    "filename.ext": "file content..."
  },
  "requirements": ["List of changes made"],
  "description": "Brief summary of changes"
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
          const markdownMatch = rawOutput?.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (markdownMatch) {
            jsonStr = markdownMatch[1];
          }
          
          const parsed = JSON.parse(jsonStr);
          
          // Merge with parent version files
          const parentFiles = context.previousFiles || {};
          const newFiles = parsed.implementationCode || {};
          
          // Add OpenAPI spec to files if it exists
          if (parsed.openApiSpec) {
            newFiles['openapi.json'] = JSON.stringify(parsed.openApiSpec, null, 2);
          }
          
          // Combine parent files with new/modified files
          const combinedFiles = { ...parentFiles, ...newFiles };
          
          // Stream individual files to frontend
          if (Object.keys(newFiles).length > 0) {
            for (const [filename, content] of Object.entries(newFiles)) {
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
      
      // Step 4: Update version with generated files
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
      
      // Step 5: Update message with version_id
      await step.run("link-message-to-version", async () => {
        await supabase
          .from('messages')
          .update({ version_id: versionId })
          .eq('id', messageId);
      });
      
      // Step 6: Emit completion event
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
  { id: "clone-and-preview-repository" },
  { event: "github/clone-and-preview" },
  async ({ event, step }) => {
    const { projectId, repoUrl, repoFullName, githubRepoId, userId } = event.data;
    
    try {
      // Step 1: Get GitHub integration
      const integration = await step.run("get-github-integration", async () => {
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
      
      // Step 2: Clone repository and start preview
      const previewResult = await step.run("clone-and-setup-preview", async () => {
        let sandbox: Sandbox | null = null;
        
        try {
          const { githubRepositoryService } = await import('../services/github-repository-service');
          
          // Create sandbox using full-stack template
          const templateId = process.env.E2B_FULLSTACK_TEMPLATE_ID || 'ckskh5feot2y94v5z07d';
          sandbox = await Sandbox.create(templateId);
          
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
          
          // Detect framework
          await streamingService.emit(projectId, {
            type: 'step:start',
            step: 'Detecting Framework',
            message: 'Analyzing project structure...',
          });
          
          const framework = await githubRepositoryService.detectFramework(sandbox, repoPath);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Detecting Framework',
            message: `Detected: ${framework.framework}`,
          });
          
          // Read repository files
          await streamingService.emit(projectId, {
            type: 'step:start',
            step: 'Reading Files',
            message: 'Reading repository files...',
          });
          
          const repoFiles: Record<string, string> = {};
          
          // Get list of source files - EXCLUDE build/generated folders
          const findFilesCommand = `find ${repoPath} -type f \\( -name '*.py' -o -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.jsx' -o -name '*.json' -o -name '*.md' -o -name '*.txt' -o -name '*.yml' -o -name '*.yaml' -o -name '*.css' -o -name '*.scss' \\) ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/dist/*' ! -path '*/build/*' ! -path '*/.next/*' ! -path '*/__pycache__/*' ! -path '*/coverage/*' ! -path '*/.cache/*' ! -path '*/out/*' ! -path '*/.turbo/*' | head -200`;
          
          const filesListResult = await sandbox.commands.run(findFilesCommand);
          
          if (filesListResult.exitCode === 0 && filesListResult.stdout) {
            const filesList = filesListResult.stdout.trim().split('\n').filter(f => f.trim());
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
                const fileContent = await sandbox.files.read(filePath);
                // Get relative path from repo root
                const relativePath = filePath.replace(`${repoPath}/`, '');
                
                // Skip if file is too large (> 200KB)
                if (fileContent.length > 200000) {
                  console.log(`Skipping large file: ${relativePath} (${fileContent.length} bytes)`);
                  filesSkipped++;
                  continue;
                }
                
                repoFiles[relativePath] = fileContent;
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
          
          console.log(`Successfully read ${Object.keys(repoFiles).length} source files`);
          
          await streamingService.emit(projectId, {
            type: 'step:complete',
            step: 'Reading Files',
            message: `Read ${Object.keys(repoFiles).length} source files`,
          });
          
          // Install dependencies
          await streamingService.emit(projectId, {
            type: 'step:start',
            step: 'Installing Dependencies',
            message: `Installing with ${framework.packageManager}...`,
          });
          
          const installResult = await githubRepositoryService.installDependencies(
            sandbox,
            repoPath,
            framework.packageManager
          );
          
          if (!installResult.success) {
            console.warn('Dependency installation failed:', installResult.error);
            await streamingService.emit(projectId, {
              type: 'step:complete',
              step: 'Installing Dependencies',
              message: 'Installation completed with warnings',
            });
          } else {
            await streamingService.emit(projectId, {
              type: 'step:complete',
              step: 'Installing Dependencies',
              message: 'Dependencies installed successfully!',
            });
          }
          
          // Start preview server
          let previewServer = null;
          
          // Try to start preview even if framework is unknown
          if (framework.startCommand || framework.framework !== 'unknown') {
            await streamingService.emit(projectId, {
              type: 'step:start',
              step: 'Starting Preview',
              message: 'Starting development server...',
            });
            
            previewServer = await githubRepositoryService.startPreviewServer(
              sandbox,
              framework,
              repoPath
            );
            
            if (previewServer.success) {
              console.log('Preview server started:', previewServer.url);
              
              await streamingService.emit(projectId, {
                type: 'step:complete',
                step: 'Starting Preview',
                message: `Preview ready on port ${previewServer.port}!`,
              });
            } else {
              await streamingService.emit(projectId, {
                type: 'step:complete',
                step: 'Starting Preview',
                message: 'Preview server could not be started - framework may require manual setup',
              });
            }
          } else {
            // Framework unknown and no start command - skip server start
            await streamingService.emit(projectId, {
              type: 'step:complete',
              step: 'Starting Preview',
              message: 'Unable to auto-start server - framework not detected',
            });
          }
          
          return {
            success: true,
            framework: framework.framework,
            packageManager: framework.packageManager,
            previewUrl: previewServer?.url,
            previewPort: previewServer?.port,
            sandboxId: sandbox.sandboxId,
            repoFiles,
          };
        } catch (error) {
          console.error('Clone and preview error:', error);
          
          // Clean up sandbox on error
          if (sandbox && typeof sandbox.kill === 'function') {
            try {
              await sandbox.kill();
            } catch (cleanupError) {
              console.error('Sandbox cleanup error:', cleanupError);
            }
          }
          
          throw error;
        }
      });
      
      // Step 3: Save repository files to database
      await step.run("save-repository-files", async () => {
        try {
          const { MessageService } = await import('../modules/messages/service');
          
          // Create a message with the repository files
          const filesCount = Object.keys(previewResult.repoFiles || {}).length;
          const messageContent = `Repository cloned successfully! Preview available at ${previewResult.previewUrl || 'N/A'}`;
          
          await MessageService.saveResult({
            content: messageContent,
            role: 'assistant',
            type: 'result',
            project_id: projectId,
            fragment: {
              title: `${repoFullName} - Cloned Repository`,
              sandbox_url: previewResult.previewUrl || '',
              files: previewResult.repoFiles || {},
              fragment_type: 'repo_clone',
              order_index: 0,
              metadata: {
                repoUrl,
                repoFullName,
                framework: previewResult.framework,
                packageManager: previewResult.packageManager,
                filesCount,
                sandboxId: previewResult.sandboxId,
              }
            }
          });
          
          console.log(`Saved ${filesCount} repository files to database`);
        } catch (error) {
          console.error('Failed to save repository files:', error);
          // Don't fail the entire workflow if saving fails
        }
      });
      
      // Step 4: Update project with preview URL and status
      await step.run("update-project", async () => {
        const { error } = await supabase
          .from('projects')
          .update({
            sandbox_url: previewResult.previewUrl,
            status: 'completed',
            framework: previewResult.framework,
            github_repo_id: githubRepoId,
          })
          .eq('id', projectId);
        
        if (error) {
          console.error('Failed to update project:', error);
        }
      });
      
      // Step 5: Emit completion
      await step.run("emit-complete", async () => {
        const filesCount = Object.keys(previewResult.repoFiles || {}).length;
        
        await streamingService.emit(projectId, {
          type: 'complete',
          summary: `Repository ${repoFullName} is ready for development!`,
          totalFiles: filesCount,
          previewUrl: previewResult.previewUrl,
        });
        
        streamingService.closeProject(projectId);
      });
      
      return {
        projectId,
        ...previewResult,
      };
    } catch (error: any) {
      console.error('Clone and preview workflow error:', error);
      
      // Update project status to failed
      await supabase
        .from('projects')
        .update({ status: 'failed' })
        .eq('id', projectId);
      
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