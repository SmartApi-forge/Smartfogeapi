# SmartAPIForge API Generation Workflow

This document outlines the two approaches for API generation in SmartAPIForge: Direct Code Generation and GitHub Integration.

## Table of Contents
- [Overview](#overview)
- [User Flow](#user-flow)
- [Technical Implementation](#technical-implementation)
  - [Inngest Functions](#inngest-functions)
  - [Database Schema](#database-schema)
  - [UI Components](#ui-components)
- [Implementation Plan](#implementation-plan)

## Overview

SmartAPIForge offers two distinct approaches for API generation:

### 1. Direct Code Generation
This approach generates OpenAPI specifications and starter code directly within the platform. The generated code is validated in a sandbox environment to ensure it compiles correctly, passes linting, and meets the OpenAPI specification standards.

### 2. GitHub Integration
This approach extends the direct generation capabilities by integrating with the user's GitHub repository. It allows for cloning the repository, generating API code that fits within the existing codebase, and creating pull requests with the changes.

## User Flow

### Direct Code Generation Flow
1. User navigates to the dashboard
2. User enters a prompt describing the API they want to create
3. User selects "Direct Code Generation" mode
4. User submits the prompt
5. System returns a Job ID immediately
6. Backend processes the request asynchronously:
   - LLM generates OpenAPI specification and starter code
   - Sandbox environment validates the code
7. User can view the status of the job
8. Once complete, user can view and download the validated code

### GitHub Integration Flow
1. User navigates to the dashboard
2. User enters a prompt describing the API they want to create
3. User selects "GitHub Integration" mode
4. User clicks the "Connect to GitHub" button which initiates OAuth authentication
5. After authentication, user selects a repository from the dropdown list
6. User submits the prompt
7. System returns a Job ID immediately
8. Backend processes the request asynchronously:
   - Clones the repository in the sandbox environment
   - LLM analyzes the codebase
   - LLM generates OpenAPI specification and code that fits the existing codebase
   - Sandbox environment validates the code
   - Creates a pull request with the changes
9. User can view the status of the job
10. Once complete, user can preview the code changes directly in our app and access the pull request URL

## Technical Implementation

### Inngest Functions

The core of the API generation workflow is handled by Inngest functions, which manage the asynchronous processing of API generation requests.

#### Enhanced `generateAPI` Function

```typescript
// src/inngest/functions.ts
export const generateAPI = inngest.createFunction(
  { id: "generate-api" },
  { event: "api/generate" },
  async ({ event, step }) => {
    const { prompt, mode, repoUrl } = event.data;
    const userId = event.user.id;
    
    // Step 1: Create job record
    const jobId = await step.run("create-job", async () => {
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
    
    // Step 2: Create sandbox environment
    const sandbox = await step.run("create-sandbox", async () => {
      // Initialize E2B sandbox
      const sandbox = await e2b.Sandbox.create({
        template: "base",
        metadata: { jobId },
      });
      return sandbox;
    });
    
    // Step 3: Handle repository if GitHub mode
    if (mode === "github" && repoUrl) {
      await step.run("clone-repository", async () => {
        // Clone the repository in the sandbox
        await sandbox.process.start({
          cmd: `git clone ${repoUrl} /home/user/repo`,
        });
        
        // Analyze the repository structure
        const repoAnalysis = await step.run("analyze-repository", async () => {
          const result = await sandbox.process.start({
            cmd: "find /home/user/repo -type f -name '*.js' -o -name '*.ts' | xargs cat",
          });
          return result.stdout;
        });
        
        // Update job with repository analysis
        await supabase
          .from("jobs")
          .update({ repo_analysis: repoAnalysis })
          .eq("id", jobId);
      });
    }
    
    // Step 4: Generate API using OpenAI
    const apiResult = await step.run("generate-api-code", async () => {
      // Enhanced prompt that includes repository context if in GitHub mode
      const enhancedPrompt = mode === "github" 
        ? `Generate an API that fits within this existing codebase: ${repoAnalysis}\n\nUser request: ${prompt}` 
        : prompt;
      
      const completion = await openai.chat.completions.create({
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
    
    // Step 5: Validate in sandbox
    const validationResult = await step.run("validate-code", async () => {
      // Write OpenAPI spec to file in sandbox
      await sandbox.filesystem.write(
        "/home/user/api-spec.json",
        JSON.stringify(apiResult.openApiSpec, null, 2)
      );
      
      // Write implementation code files
      for (const [filename, content] of Object.entries(apiResult.implementationCode)) {
        await sandbox.filesystem.write(`/home/user/${filename}`, content);
      }
      
      // Validate OpenAPI spec
      const specValidation = await sandbox.process.start({
        cmd: "npx openapi-validator /home/user/api-spec.json",
      });
      
      // Install dependencies and run linting/tests if applicable
      await sandbox.process.start({
        cmd: "npm init -y && npm install eslint typescript @types/node --save-dev",
      });
      
      // Create tsconfig.json
      await sandbox.filesystem.write(
        "/home/user/tsconfig.json",
        JSON.stringify({
          compilerOptions: {
            target: "es2020",
            module: "commonjs",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            outDir: "./dist"
          },
          include: ["./**/*.ts"],
          exclude: ["node_modules"]
        }, null, 2)
      );
      
      // Run TypeScript compiler to check for errors
      const tsCheck = await sandbox.process.start({
        cmd: "npx tsc --noEmit",
      });
      
      return {
        specValid: specValidation.exitCode === 0,
        codeValid: tsCheck.exitCode === 0,
        specValidationOutput: specValidation.stdout + specValidation.stderr,
        codeValidationOutput: tsCheck.stdout + tsCheck.stderr
      };
    });
    
    // Step 6: Handle GitHub PR creation if in GitHub mode
    let prUrl = null;
    if (mode === "github" && repoUrl) {
      prUrl = await step.run("create-pull-request", async () => {
        // Implementation for creating a GitHub PR would go here
        // This would involve:
        // 1. Creating a new branch
        // 2. Committing the changes
        // 3. Pushing to GitHub
        // 4. Creating a PR via GitHub API
        
        // For now, we'll return a placeholder
        return `https://github.com/${repoUrl.split('/').slice(-2).join('/').replace('.git', '')}/pull/new`;
      });
    }
    
    // Step 7: Update job with results
    await step.run("update-job-status", async () => {
      await supabase
        .from("jobs")
        .update({
          status: validationResult.specValid && validationResult.codeValid ? "completed" : "failed",
          result: {
            apiSpec: apiResult.openApiSpec,
            code: apiResult.implementationCode,
            validation: validationResult,
            prUrl: prUrl,
            requirements: apiResult.requirements,
            description: apiResult.description
          }
        })
        .eq("id", jobId);
    });
    
    // Step 8: Clean up sandbox
    await step.run("cleanup-sandbox", async () => {
      await sandbox.close();
    });
    
    return {
      jobId,
      status: validationResult.specValid && validationResult.codeValid ? "completed" : "failed",
      mode,
      prUrl
    };
  }
);
```

### Database Schema

The database schema needs to be updated to support both API generation approaches:

```sql
-- jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  mode TEXT NOT NULL CHECK (mode IN ('direct', 'github')),
  repo_url TEXT,
  repo_analysis TEXT,
  result JSONB
);

-- api_fragments table (for storing generated API components)
CREATE TABLE api_fragments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fragment_type TEXT NOT NULL CHECK (fragment_type IN ('spec', 'code', 'test', 'documentation')),
  content TEXT NOT NULL,
  metadata JSONB
);
```

### UI Components

#### Dashboard Content Component

The dashboard content component needs to be updated to support both API generation approaches:

```tsx
// components/dashboard-content.tsx
import { useState } from 'react';
import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger, Input } from './ui';
import { AiPromptBox } from './ui/ai-prompt-box';
import { ApiPreview } from './api-preview'; // New component for API preview

export function DashboardContent() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'direct' | 'github'>('direct');
  const [repoUrl, setRepoUrl] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, repoUrl: mode === 'github' ? repoUrl : undefined }),
      });
      
      const data = await response.json();
      setJobId(data.jobId);
      
      // Start polling for job status
      pollJobStatus(data.jobId);
    } catch (error) {
      console.error('Error submitting prompt:', error);
    }
  };
  
  const pollJobStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`);
        const data = await response.json();
        
        if (data.status === 'completed' || data.status === 'failed') {
          setIsLoading(false);
          setResult(data.result);
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Generator</h1>
      
      <Card className="p-4 mb-4">
        <Tabs defaultValue="direct" onValueChange={(value) => setMode(value as 'direct' | 'github')}>
          <TabsList className="mb-4">
            <TabsTrigger value="direct">Direct Code Generation</TabsTrigger>
            <TabsTrigger value="github">GitHub Integration</TabsTrigger>
          </TabsList>
          
          <TabsContent value="direct">
            <p className="mb-4">Generate API code directly in the platform.</p>
          </TabsContent>
          
          <TabsContent value="github">
            <p className="mb-4">Generate API code integrated with your GitHub repository.</p>
            <Input
              placeholder="GitHub Repository URL (e.g., https://github.com/username/repo)"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="mb-4"
            />
          </TabsContent>
        </Tabs>
        
        <AiPromptBox
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          placeholder="Describe the API you want to create..."
          isLoading={isLoading}
        />
      </Card>
      
      {jobId && !result && (
        <Card className="p-4 mb-4">
          <p>Processing your request... Job ID: {jobId}</p>
          {/* Add loading animation here */}
        </Card>
      )}
      
      {result && (
        <ApiPreview
          result={result}
          mode={mode}
          repoUrl={repoUrl}
        />
      )}
    </div>
  );
}
```

#### API Preview Component

A new component for previewing the generated API:

```tsx
// components/api-preview.tsx
import { useState } from 'react';
import { Card, Tabs, TabsContent, TabsList, TabsTrigger, Button } from './ui';

interface ApiPreviewProps {
  result: any;
  mode: 'direct' | 'github';
  repoUrl?: string;
}

export function ApiPreview({ result, mode, repoUrl }: ApiPreviewProps) {
  const [activeTab, setActiveTab] = useState('spec');
  
  if (!result) return null;
  
  return (
    <Card className="p-4">
      <h2 className="text-xl font-bold mb-4">Generated API</h2>
      
      <div className="mb-4">
        <p><strong>Status:</strong> {result.validation.specValid && result.validation.codeValid ? 'Valid' : 'Invalid'}</p>
        {result.description && (
          <p className="mt-2"><strong>Description:</strong> {result.description}</p>
        )}
        {result.requirements && result.requirements.length > 0 && (
          <div className="mt-2">
            <strong>Requirements:</strong>
            <ul className="list-disc pl-5">
              {result.requirements.map((req: string, i: number) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <Tabs defaultValue="spec" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="spec">OpenAPI Spec</TabsTrigger>
          <TabsTrigger value="code">Implementation Code</TabsTrigger>
          {mode === 'github' && <TabsTrigger value="diff">Changes</TabsTrigger>}
          {result.validation.specValid && <TabsTrigger value="preview">Live Preview</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="spec">
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(result.apiSpec, null, 2)}
          </pre>
          <Button className="mt-4" onClick={() => downloadFile('api-spec.json', JSON.stringify(result.apiSpec, null, 2))}>
            Download Spec
          </Button>
        </TabsContent>
        
        <TabsContent value="code">
          {Object.entries(result.code).map(([filename, content]: [string, any]) => (
            <div key={filename} className="mb-4">
              <h3 className="font-bold">{filename}</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
                {content}
              </pre>
              <Button className="mt-2" onClick={() => downloadFile(filename, content)}>
                Download File
              </Button>
            </div>
          ))}
        </TabsContent>
        
        {mode === 'github' && (
          <TabsContent value="diff">
            <p className="mb-4">Changes to be applied to your repository:</p>
            {/* Display diff visualization here */}
            {result.prUrl && (
              <Button className="mt-4" onClick={() => window.open(result.prUrl, '_blank')}>
                View Pull Request
              </Button>
            )}
          </TabsContent>
        )}
        
        {result.validation.specValid && (
          <TabsContent value="preview">
            <p className="mb-4">API Documentation Preview:</p>
            <iframe
              src={`/api/preview/${result.jobId}`}
              className="w-full h-96 border rounded"
              title="API Preview"
            />
          </TabsContent>
        )}
      </Tabs>
      
      {result.validation.specValidationOutput && (
        <div className="mt-4">
          <h3 className="font-bold">Validation Output:</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-48">
            {result.validation.specValidationOutput}
          </pre>
        </div>
      )}
      
      {result.validation.codeValidationOutput && (
        <div className="mt-4">
          <h3 className="font-bold">Code Validation Output:</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-48">
            {result.validation.codeValidationOutput}
          </pre>
        </div>
      )}
    </Card>
  );
}

function downloadFile(filename: string, content: string) {
  const element = document.createElement('a');
  const file = new Blob([content], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
```

## Implementation Plan

### Week 1-2: Core Infrastructure
- Set up Inngest functions for API generation
- Create database schema for jobs and API fragments
- Implement E2B sandbox integration for code validation
- Develop basic UI for direct code generation

### Week 3-4: Direct Code Generation
- Enhance OpenAI prompt for API generation
- Implement code validation in sandbox
- Create API preview component
- Add download functionality for generated code

### Week 5-6: GitHub Integration
- Implement repository cloning in sandbox
- Develop code analysis for existing repositories
- Create GitHub service for PR creation
- Update UI to support GitHub integration mode

### Week 7-8: Testing and Refinement
- End-to-end testing of both workflows
- Performance optimization
- User feedback integration
- Documentation and tutorials