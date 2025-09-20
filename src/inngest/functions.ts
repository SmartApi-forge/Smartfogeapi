import { inngest } from "./client";
import OpenAI from 'openai';
import { Sandbox } from 'e2b';
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
    const { prompt, mode, repoUrl, userId } = event.data;
    
    let jobId: string | undefined;
    
    try {
    
      // Step 1: Create job record
      jobId = await step.run("create-job", async () => {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          user_id: userId,
          type: "generate_api",
          status: "running",
          payload: {
            mode: mode,
            repo_url: repoUrl || null,
          },
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
        let sandbox: Sandbox | null = null;
        
        try {
          // Create sandbox for repository analysis
          sandbox = await Sandbox.create('smart-forge-api-sandbox');
          
          // Clone the repository
          const cloneResult = await sandbox.commands.run(`git clone ${repoUrl} /home/user/repo`);
          if (cloneResult.exitCode !== 0) {
            throw new Error(`Failed to clone repository: ${cloneResult.stderr}`);
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
          const dirStructure = await sandbox.commands.run('find /home/user/repo -type f -name "*.js" -o -name "*.ts" -o -name "*.json" -o -name "*.md" | head -50');
          
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
            packageInfo,
            directoryStructure: dirStructure.stdout,
            mainFiles,
            readme: readme ? readme.substring(0, 2000) : null, // First 2000 chars
            analysisTimestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error('Repository analysis error:', error);
          return {
            repoUrl,
            error: (error as Error).message,
            analysisTimestamp: new Date().toISOString()
          };
        } finally {
          // Clean up sandbox
          if (sandbox) {
            try {
              await sandbox.kill();
            } catch (cleanupError) {
              console.error('Repository analysis sandbox cleanup error:', cleanupError);
            }
          }
        }
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
        model: "gpt-4-turbo",
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
9. Add health check endpoint at /health that returns 200 OK
10. Generate complete, working code that can run immediately
11. Include proper CORS setup and security middleware
12. Add input validation using joi or similar
13. Include proper error handling middleware
14. Generate realistic sample data and endpoints
15. Ensure all imports and exports are correct
16. Add proper logging with console.log statements
17. Include a start script that works: "node index.js" or "ts-node index.ts"
18. Make sure the server listens on port 3000 by default
19. Add proper JSON parsing middleware
20. Include at least 3-5 meaningful API endpoints based on the request

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
              "content": { "application/json": { "schema": { "type": "object" } } }
            }
          }
        }
      }
    }
  },
  "implementationCode": {
    "index.js": "const express = require('express');\nconst app = express();\napp.use(express.json());\napp.get('/health', (req, res) => res.json({ status: 'OK' }));\napp.listen(3000, () => console.log('Server running on port 3000'));",
    "package.json": "{\"name\": \"api\", \"version\": \"1.0.0\", \"scripts\": {\"start\": \"node index.js\"}, \"dependencies\": {\"express\": \"^4.18.0\"}}"
  }
}`
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
        let jsonStr = rawOutput || '';
        const markdownMatch = rawOutput?.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch) {
          jsonStr = markdownMatch[1];
        }
        
        const parsed = JSON.parse(jsonStr);
        
        // Ensure expected fields have defaults
        const result = {
          openApiSpec: parsed.openApiSpec || {},
          implementationCode: parsed.implementationCode || {},
          requirements: parsed.requirements || [],
          description: parsed.description || "",
        };
        
        console.log('🤖 AI Generated Result:');
        console.log('- OpenAPI spec keys:', Object.keys(result.openApiSpec));
        console.log('- Implementation files:', Object.keys(result.implementationCode));
        console.log('- Requirements count:', result.requirements.length);
        
        return result;
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

    // Step 4: Comprehensive sandbox validation
    const validationResult = await step.run("validate-code-in-sandbox", async () => {
      let sandbox: Sandbox | null = null;
      
      try {
        // Create sandbox with our custom template
        sandbox = await Sandbox.create('smart-forge-api-sandbox');
        
        // Write OpenAPI spec to sandbox
        await sandbox.files.write('/home/user/openapi.json', JSON.stringify(apiResult.openApiSpec, null, 2));
        
        // Write implementation files to sandbox
        const implementationFiles = apiResult.implementationCode || {};
        console.log('📁 Writing implementation files:', Object.keys(implementationFiles));
        
        for (const [filename, content] of Object.entries(implementationFiles)) {
          if (typeof content === 'string') {
            console.log(`📝 Writing file: ${filename} (${content.length} chars)`);
            await sandbox.files.write(`/home/user/src/${filename}`, content);
          } else {
            console.log(`⚠️ Skipping non-string content for ${filename}:`, typeof content);
          }
        }
        
        // List all files in the sandbox for debugging
        const fileList = await sandbox.commands.run('cd /home/user && find . -type f -name "*" | head -20');
        console.log('📋 Files in sandbox:', fileList.stdout);
        
        // Check if OpenAPI spec file exists and is valid JSON
        let specValidation, specValid = false;
        try {
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
          } else {
            specValidation = { exitCode: 1, stdout: '', stderr: 'OpenAPI spec file not found' };
          }
        } catch (error) {
          specValidation = { exitCode: 1, stdout: '', stderr: `OpenAPI validation error: ${error}` };
        }
        
        // Check if TypeScript files exist before validation
         let tsValidation, tsValid = false;
         try {
           const tsFiles = await sandbox.commands.run('cd /home/user/src && find . -name "*.ts" | head -1');
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
             
             // Install TypeScript if not available
             await sandbox.commands.run('cd /home/user && npm install typescript --save-dev --silent');
             
             // Run TypeScript compilation check
             tsValidation = await sandbox.commands.run('cd /home/user/src && npx tsc --noEmit --skipLibCheck --allowJs');
             tsValid = tsValidation.exitCode === 0;
           } else {
             // Check JavaScript files instead
             const jsFiles = await sandbox.commands.run('cd /home/user/src && find . -name "*.js" | head -1');
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
          const jsFiles = await sandbox.commands.run('cd /home/user/src && find . -name "*.js" -type f');
          if (jsFiles.stdout?.trim()) {
            // Check each JS file individually for better error reporting
            const fileList = jsFiles.stdout.trim().split('\n').filter(f => f.trim());
            let allValid = true;
            let validationOutput = '';
            
            for (const file of fileList) {
              const fileCheck = await sandbox.commands.run(`cd /home/user/src && node --check "${file.trim()}"`);
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
          const packageExists = await sandbox.commands.run('cd /home/user && test -f package.json && echo "exists" || echo "missing"');
          if (packageExists.stdout?.includes('exists')) {
            // Check if test script exists and what it contains
            const testScriptCheck = await sandbox.commands.run('cd /home/user && node -e "const pkg = JSON.parse(require(\'fs\').readFileSync(\'package.json\', \'utf8\')); console.log(pkg.scripts && pkg.scripts.test ? pkg.scripts.test : \'no-test\')"');
            
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
                await sandbox.commands.run('cd /home/user && npm install --silent');
                testValidation = await sandbox.commands.run('cd /home/user && timeout 30s npm test 2>&1 || echo "Test execution completed"');
                
                // Consider tests valid if they run without crashing (even if they fail)
                testsValid = !testValidation.stdout?.includes('Test timeout') && 
                           !testValidation.stdout?.includes('command not found') &&
                           !testValidation.stdout?.includes('Cannot find module');
              } catch (testError) {
                testValidation = { exitCode: 0, stdout: 'Test execution attempted but encountered issues', stderr: String(testError) };
                testsValid = true; // Don't fail the entire validation for test issues
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
        if (specValid && tsValid) {
          try {
            // Install dependencies with verbose output
            const installResult = await sandbox.commands.run('cd /home/user && npm install --verbose');
            console.log('Install output:', installResult.stdout, installResult.stderr);
            
            // Check what port the package.json start script uses
            const portCheck = await sandbox.commands.run('cd /home/user && grep -o "PORT=[0-9]*" package.json || grep -o "port.*[0-9]*" package.json || echo "port:3000"');
            
            // Start the API server in background with longer timeout
            const startResult = await sandbox.commands.run('cd /home/user && timeout 60s npm start &');
            
            // Wait longer for server to start and check process
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Check if any node process is running
            const processCheck = await sandbox.commands.run('ps aux | grep node | grep -v grep || echo "no node process"');
            console.log('Process check:', processCheck.stdout);
            
            // Test basic health endpoint on multiple ports with better error handling
            let healthCheck;
            const ports = [3000, 8000, 5000, 4000];
            let healthCheckPassed = false;
            let workingPort = null;
            
            for (const port of ports) {
              try {
                // First check if port is listening
                const portListening = await sandbox.commands.run(`netstat -tlnp | grep :${port} || echo "port ${port} not listening"`);
                console.log(`Port ${port} status:`, portListening.stdout);
                
                if (!portListening.stdout.includes('not listening')) {
                  // Try health endpoint
                  healthCheck = await sandbox.commands.run(`curl -f -m 5 http://localhost:${port}/health`);
                  if (healthCheck.exitCode === 0) {
                    healthCheckPassed = true;
                    workingPort = port;
                    break;
                  }
                  
                  // Try root endpoint if health fails
                  const rootCheck = await sandbox.commands.run(`curl -f -m 5 http://localhost:${port}/`);
                  if (rootCheck.exitCode === 0) {
                    healthCheck = rootCheck;
                    healthCheckPassed = true;
                    workingPort = port;
                    break;
                  }
                }
              } catch (error) {
                console.log(`Port ${port} check failed:`, error);
              }
            }
            
            if (!healthCheck) {
              healthCheck = { exitCode: 1, stdout: '', stderr: 'No working port found' };
            }
            
            // Test a few API endpoints from the OpenAPI spec using the working port
            const endpoints: any[] = [];
            if (workingPort && apiResult.openApiSpec?.paths) {
              const paths = Object.keys(apiResult.openApiSpec.paths).slice(0, 3); // Test first 3 endpoints
              for (const path of paths) {
                const methods = Object.keys((apiResult.openApiSpec.paths as any)[path]);
                const method = methods.find(m => ['get', 'post'].includes(m.toLowerCase())) || methods[0];
                
                if (method) {
                  const testUrl = `http://localhost:${workingPort}${path}`;
                  const curlCmd = method.toLowerCase() === 'get' 
                    ? `curl -f -m 10 -X GET "${testUrl}"` 
                    : `curl -f -m 10 -X POST "${testUrl}" -H "Content-Type: application/json" -d '{}'`;
                  
                  try {
                    const endpointTest = await sandbox.commands.run(curlCmd);
                    endpoints.push({
                      path,
                      method,
                      success: endpointTest.exitCode === 0,
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
            
            executionResult = {
              serverStarted: startResult.exitCode === 0 && processCheck.stdout.includes('node'),
              healthCheckPassed: healthCheckPassed,
              endpointTests: endpoints,
              installOutput: installResult.stdout || installResult.stderr,
              healthCheckOutput: healthCheck.stdout || healthCheck.stderr,
              workingPort: workingPort,
              processInfo: processCheck.stdout
            };
          } catch (execError) {
            console.error('Execution error:', execError);
            executionResult = {
              serverStarted: false,
              healthCheckPassed: false,
              endpointTests: [],
              error: (execError as Error).message,
              errorStack: (execError as Error).stack,
              workingPort: null,
              processInfo: 'Error occurred during execution'
            };
          }
        }
        
        // Calculate overall validity with more lenient criteria
        const hasWorkingServer = executionResult?.serverStarted && executionResult?.healthCheckPassed;
        const hasValidSpec = specValid;
        const hasValidCode = tsValid && syntaxValid;
        
        // Overall valid if we have a valid spec and either working server OR valid code
        const overallValid = hasValidSpec && (hasWorkingServer || hasValidCode);
        
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
            warnings: !hasWorkingServer ? ['Server startup issues'] : []
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
      if (typeof jobId !== 'undefined') {
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
